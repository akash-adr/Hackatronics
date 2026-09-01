"""
Safe-approach corridor computation.

Reuses the per-angle hazard radii Module 2 already produced -- the exact
numbers behind the drawn polygon -- and answers two questions:

    which bearing should a responder approach from, and
    how far back should they stay?

Nothing here recomputes physics or geometry. The only imported logic is
angle_diff, deliberately reused from geometry/wind_scaling.py rather than
reimplemented, so there is exactly one wraparound implementation in the
codebase and no chance of two subtly different ones disagreeing.


WHICH BEARING IS "BEST": A CORRECTION TO THE MODULE 3 BRIEF
-----------------------------------------------------------
The brief's step (b) says to pick the bearing with the MAXIMUM radius,
glossed as "max clearance from hazard boundary". Those two are opposites,
and the maximum is the dangerous one:

    per_angle_radii holds how far the HAZARD reaches at each bearing. The
    largest radius is the direction the hazard travels FURTHEST -- straight
    downwind. Approaching from there walks a responder up the long axis of the
    plume.

    The safest bearing is the one where the hazard reaches LEAST far, i.e.
    the MINIMUM radius -- upwind. Standing at a given distance, your
    clearance from the boundary is (your distance - radius at that bearing),
    which is maximised exactly where the radius is smallest.

The brief's own test agrees with the minimum, not the maximum: with wind
from 270, test_safe_bearing_is_roughly_upwind_in_simple_case expects a best
bearing near 270 (upwind, minimum radius). argmax returns 90 -- 180 degrees
away, and outside the test's 20 degree tolerance.

This module therefore selects argmin. Consequently the qualifying-bearing
test in step (e) is also inverted: with a minimum-based basis, "radius >=
best * tolerance" would be true at every bearing and the corridor would
always degenerate to the 90 degree cap. A bearing instead qualifies when its
radius is within 1/tolerance_pct of the smallest -- i.e. it is at least
tolerance_pct as good as the best one.
"""

from geometry.wind_scaling import angle_diff

# Ceiling on how wide a reported corridor may be. A "safe" arc covering half
# the compass is not actionable advice.
MAX_RANGE_WIDTH_DEG = 90.0

# Fallback angular spacing when it cannot be inferred from the data.
DEFAULT_STEP_DEG = 5.0


def _normalize(theta):
    """Wrap a bearing into [0, 360) and round off float sampling noise."""
    return round(theta % 360, 6)


def _infer_step_deg(sorted_thetas):
    """
    Smallest positive gap between qualifying bearings, wraparound included.

    With 72 samples every 5 degrees, any two adjacent qualifying bearings are
    5 degrees apart, so the minimum gap recovers the sample spacing without
    the caller having to state it.
    """
    if len(sorted_thetas) < 2:
        return DEFAULT_STEP_DEG

    gaps = []
    for i in range(len(sorted_thetas)):
        a = sorted_thetas[i]
        b = sorted_thetas[(i + 1) % len(sorted_thetas)]
        gap = (b - a) % 360
        if gap > 0:
            gaps.append(gap)

    return min(gaps) if gaps else DEFAULT_STEP_DEG


def find_contiguous_range(qualifying_thetas, best_theta, step_deg=None):
    """
    Grow a contiguous arc outward from best_theta through qualifying bearings.

    Args:
        qualifying_thetas: bearings (degrees) that met the tolerance test
        best_theta:        bearing to grow outward from
        step_deg:          angular sample spacing; inferred from the data when
                           not given

    Returns:
        (range_start_deg, range_end_deg), walking clockwise from start to end.

    WRAPAROUND REPRESENTATION: the tuple is always read as "clockwise from
    start to end". When start > end the arc crosses the 0/360 boundary --
    e.g. (350, 10) means 350 -> 355 -> 0 -> 5 -> 10, a 20 degree arc, NOT a
    340 degree one. Callers must not compare start and end numerically; the
    width is (end - start) % 360.

    Walking outward stops at the first gap in either direction. All angular
    stepping goes through the shared angle_diff/modulo logic rather than any
    new comparison written here.
    """
    if not qualifying_thetas:
        return (_normalize(best_theta), _normalize(best_theta))

    thetas = sorted({_normalize(t) for t in qualifying_thetas})
    qualifying = set(thetas)

    if step_deg is None:
        step_deg = _infer_step_deg(thetas)

    best = _normalize(best_theta)
    if best not in qualifying:
        # Grow from the nearest qualifying bearing instead, measured with the
        # shared wraparound helper.
        best = min(thetas, key=lambda t: abs(angle_diff(t, best)))

    start = end = best

    # Walk clockwise, then anticlockwise. The `!= start` / `!= end` guards
    # stop a fully-qualifying circle from wrapping onto itself forever.
    for _ in range(len(thetas) - 1):
        nxt = _normalize(end + step_deg)
        if nxt in qualifying and nxt != start:
            end = nxt
        else:
            break

    for _ in range(len(thetas) - 1):
        prv = _normalize(start - step_deg)
        if prv in qualifying and prv != end:
            start = prv
        else:
            break

    return (start, end)


def compute_safe_approach(
    outer_band_per_angle_radii,
    center_lat,
    center_lon,
    margin_pct=0.20,
    min_margin_m=20,
    tolerance_pct=0.90,
):
    """
    Find the safest approach bearing, its corridor, and a minimum standoff.

    Args:
        outer_band_per_angle_radii: (theta_deg, radius_m) pairs for the single
                                    outermost trustworthy band, straight from
                                    Module 2's per_angle_radii
        center_lat, center_lon:     facility location, carried for interface
                                    completeness; the corridor is expressed in
                                    bearings and metres, so no coordinate
                                    conversion happens here
        margin_pct:                 proportional safety margin on the standoff
        min_margin_m:               absolute floor on that margin, metres
        tolerance_pct:              how close to the best bearing another
                                    bearing must be to join the corridor

    Returns:
        {"best_bearing_deg", "best_bearing_range_deg", "min_standoff_m"}
    """
    distances = {
        _normalize(theta): radius for theta, radius in outer_band_per_angle_radii
    }

    # The safest bearing is where the hazard reaches LEAST far. See the
    # module docstring for why this is a minimum, not a maximum.
    best_theta = min(distances, key=lambda t: (distances[t], t))
    best_distance = distances[best_theta]

    # Stand beyond the hazard boundary by the larger of the two margins: a
    # proportional one, and an absolute floor that keeps small zones from
    # producing a uselessly thin buffer.
    min_standoff = best_distance * (1 + margin_pct)
    min_standoff = max(min_standoff, best_distance + min_margin_m)

    # A bearing joins the corridor when it is at least tolerance_pct as good
    # as the best one. "Good" means a short hazard reach, so the comparison
    # is an upper bound on radius, not a lower one.
    threshold = best_distance / tolerance_pct if tolerance_pct > 0 else float("inf")
    qualifying = sorted(t for t in distances if distances[t] <= threshold)

    range_start, range_end = find_contiguous_range(qualifying, best_theta)

    # Degenerate case: when the zone is nearly circular almost every bearing
    # qualifies, and the honest-but-useless answer is "anywhere". Cap the
    # advice at a practical width centred on the best bearing rather than
    # reporting a safe arc across half the compass.
    width = (range_end - range_start) % 360
    if width > 180:
        half = MAX_RANGE_WIDTH_DEG / 2
        range_start = _normalize(best_theta - half)
        range_end = _normalize(best_theta + half)

    return {
        "best_bearing_deg": best_theta,
        "best_bearing_range_deg": [range_start, range_end],
        "min_standoff_m": round(min_standoff, 1),
    }


def select_outer_band_with_fallback(bands_list, radius_key):
    """
    Pick the outermost band whose radius can actually be trusted.

    Module 1 sets clipped=True when a threshold was never crossed inside the
    solver's search range -- the radius is then a search boundary, not a real
    crossing. Basing a safe-approach recommendation on such a value would
    quietly present a boundary artefact as a measured distance.

    So: sort by radius descending and return the first band with
    clipped=False, skipping clipped ones however large they look. If every
    band is clipped, return None -- the caller must omit the recommendation
    and say why, rather than compute one from untrustworthy data.
    """
    ordered = sorted(bands_list, key=lambda b: b[radius_key], reverse=True)

    for band in ordered:
        if not band.get("clipped", False):
            return band

    return None


def _band_label(hazard_type, band):
    """Descriptive id, e.g. 'thermal_pain_4kw' or 'blast_glass_breakage_1psi'."""
    if hazard_type == "thermal":
        threshold, unit = band.get("threshold_kw_m2"), "kw"
    else:
        threshold, unit = band.get("threshold_psi"), "psi"

    # Drop a trailing .0 so 4.0 reads as "4kw", not "4.0kw".
    if isinstance(threshold, float) and threshold.is_integer():
        threshold = int(threshold)

    return f"{hazard_type}_{band.get('label')}_{threshold}{unit}"


def compute_safe_approach_for_response(warped_zones_response):
    """
    Top-level entry point: derive the safe approach from Module 2's output.

    Considers thermal and blast bands together, since a responder must clear
    whichever hazard extends furthest, not whichever type is listed first.

    Returns:
        The safe-approach dict with an added "based_on_band" field, or None
        when every band is clipped and no trustworthy radius exists.
    """
    combined = []

    for hazard_type in ("thermal", "blast"):
        section = warped_zones_response.get(hazard_type)
        if section is None:
            continue

        for band in section["bands"]:
            # Thermal and blast name their radius differently; normalise onto
            # one comparable field so the two can be ranked against each other.
            radius_key = "radius_no_wind_m" if hazard_type == "thermal" else "radius_m"
            combined.append(
                {
                    **band,
                    "radius_m": band[radius_key],
                    "hazard_type": hazard_type,
                    "based_on_band": _band_label(hazard_type, band),
                }
            )

    if not combined:
        return None

    outer = select_outer_band_with_fallback(combined, "radius_m")
    if outer is None:
        return None

    result = compute_safe_approach(
        outer["per_angle_radii"],
        center_lat=None,
        center_lon=None,
    )
    result["based_on_band"] = outer["based_on_band"]

    return result
