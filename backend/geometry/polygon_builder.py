"""
Geography half of Module 2: turns scaled radii into map coordinates.

wind_scaling.py decides HOW FAR to reach at each bearing; this file decides
WHERE that lands on the Earth. Keeping the two apart means a bug in the
scaling curve and a bug in the coordinate conversion show up as different,
separately diagnosable symptoms.

No physics is performed or re-derived here -- R0_m arrives already computed
by Module 1 and is only transformed geometrically.
"""

import math

from geometry.wind_scaling import wind_scaling_factor

# One degree of latitude is very nearly this many metres everywhere on Earth.
# One degree of longitude shrinks by cos(latitude) as you move off the equator.
METERS_PER_DEGREE_LAT = 111320.0


# WHY A FLAT-EARTH (EQUIRECTANGULAR) APPROXIMATION RATHER THAN A GEODESIC ONE
# --------------------------------------------------------------------------
# Hazard zones here span tens to a few thousand metres. Over distances that
# short the Earth's curvature is genuinely negligible -- the error against a
# full great-circle calculation is far below the precision of the underlying
# hazard model itself, and well below the ~0.1 m rounding applied to each
# output coordinate. Reaching for a geodesic library (pyproj, geographiclib)
# would add a dependency and implementation risk while buying no meaningful
# accuracy at this scale. This is a deliberate, defensible engineering
# trade-off, not an oversight: the approximation is chosen because it is
# sufficient, and it is documented here so it can be defended rather than
# discovered.
def wind_warped_polygon(
    R0_m,
    wind_from_deg,
    wind_speed,
    center_lat,
    center_lon,
    n_samples=72,
    k=0.0075,  # kept in step with wind_scaling.py's calibrated default
    alpha_max=0.6,
    return_radii=False,
):
    """
    Build a wind-warped hazard polygon around a facility.

    Args:
        R0_m:          base (no-wind) hazard radius in metres, from Module 1
        wind_from_deg: direction the wind is blowing FROM
        wind_speed:    wind speed in km/h
        center_lat:    facility latitude
        center_lon:    facility longitude
        n_samples:     angular samples around the circle (72 = every 5 deg)
        k:             stretch growth rate with wind speed
        alpha_max:     ceiling on stretch/compression
        return_radii:  also return the per-angle radii used to build the points

    Returns:
        If return_radii is False (the default): a list of (lat, lon) tuples
        forming a CLOSED polygon -- the first point is repeated as the last.
        This is the original behaviour, unchanged.

        If return_radii is True: a tuple (polygon_points, per_angle_radii),
        where per_angle_radii is a list of (theta_deg, radius_m) pairs holding
        the exact scaled radius behind each point, taken BEFORE the closing
        duplicate is appended -- so it has length n_samples, not n_samples + 1.

    The per-angle radii are captured as they are computed rather than being
    re-derived from the returned coordinates: Module 3 consumes the same
    numbers that drew the shape, never a second, separately-computed set.

    Every sample point is an independent evaluation of the same formula. No
    ellipse or spline is fitted to control points; the shape is simply what
    n_samples independent evaluations produce.
    """
    points = []
    per_angle_radii = []
    for i in range(n_samples):
        theta = 360.0 * i / n_samples
        S = wind_scaling_factor(theta, wind_from_deg, wind_speed, k, alpha_max)

        # Floor at 1 metre. alpha_max already guarantees S >= 0.4 upstream,
        # but this is a second, independent safety net: a zero or negative
        # radius must never reach the polygon regardless of what callers pass
        # for k or alpha_max.
        R = max(R0_m * S, 1.0)
        per_angle_radii.append((theta, R))

        dx = R * math.sin(math.radians(theta))  # eastward offset in metres
        dy = R * math.cos(math.radians(theta))  # northward offset in metres

        lat2 = center_lat + (dy / METERS_PER_DEGREE_LAT)
        lon2 = center_lon + (
            dx / (METERS_PER_DEGREE_LAT * math.cos(math.radians(center_lat)))
        )

        points.append((round(lat2, 6), round(lon2, 6)))

    # Close the polygon explicitly. Leaflet and several other renderers draw
    # an open path rather than a closed shape without this repeated point.
    points.append(points[0])

    # Default path returns exactly what it always did, so every existing
    # caller and test is unaffected.
    if return_radii:
        return points, per_angle_radii
    return points
