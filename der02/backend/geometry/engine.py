"""
The single integration point between Module 1 and Module 2.

Module 1 (backend/physics/) is frozen. This module reads its output and does
exactly one thing to it: converts each band's already-correct no-wind radius
into a wind-warped polygon. It performs no physics, recomputes nothing, and
re-derives nothing -- every number it does not create itself passes through
untouched.
"""

from geometry.polygon_builder import wind_warped_polygon


def compute_warped_zones(
    module1_response, wind_from_deg, wind_speed_kmh, center_lat, center_lon
):
    """
    Attach wind-warped polygons to Module 1's hazard bands.

    Args:
        module1_response: the dict returned by physics.engine.compute_zone()
                          (keys: "thermal" and/or "blast", plus "sources")
        wind_from_deg:    direction the wind blows FROM
        wind_speed_kmh:   wind speed, km/h
        center_lat:       facility latitude
        center_lon:       facility longitude

    Returns:
        The same structure with a "polygon" field added inside every band, a
        new top-level "wind" block, and this module's citation appended to
        "sources".
    """
    warped = {"thermal": None, "blast": None}

    for hazard_type in ("thermal", "blast"):
        if module1_response.get(hazard_type) is None:
            continue

        bands_out = []
        for band in module1_response[hazard_type]["bands"]:
            # Module 1 names the thermal radius differently from the blast one
            # (radius_no_wind_m vs radius_m); read whichever this band carries.
            radius_key = "radius_no_wind_m" if hazard_type == "thermal" else "radius_m"
            R0 = band[radius_key]

            # return_radii=True hands back the same per-angle radii that built
            # the polygon, so Module 3's safe-approach search reads the exact
            # numbers behind the drawn shape instead of recomputing them.
            polygon, per_angle_radii = wind_warped_polygon(
                R0, wind_from_deg, wind_speed_kmh, center_lat, center_lon,
                return_radii=True,
            )

            # Spread the original band and add one key. The band dict is never
            # reconstructed field by field: doing so risks silently dropping
            # "clipped" -- or any field added later -- which the map renderer
            # and explainability panel rely on to show an honest "beyond
            # modelled range" notice instead of presenting a clipped radius as
            # though it were a normal one.
            bands_out.append(
                {**band, "polygon": polygon, "per_angle_radii": per_angle_radii}
            )

        warped[hazard_type] = {**module1_response[hazard_type], "bands": bands_out}

    # Publish the downwind bearing so the frontend never re-derives the
    # from/to flip itself -- one definition of downwind, computed once.
    wind_to = (wind_from_deg + 180) % 360
    warped["wind"] = {
        "from_deg": wind_from_deg,
        "speed_kmh": wind_speed_kmh,
        "to_deg": wind_to,
    }

    # Append, never replace: Module 1's citations must survive intact.
    warped["sources"] = module1_response["sources"] + [
        "Cosine-based directional scaling model (Module 2)"
    ]

    return warped
