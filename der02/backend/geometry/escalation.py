"""
Multi-tank domino / escalation detection (Module 3, Section 6 stretch item).

Purely additive: this reads hazard polygons Modules 1-2 already produced and
answers a containment question about them. It recomputes no physics and no
geometry, consistent with the project's rule that no module repeats another's
calculation.
"""

from geometry.point_in_polygon import point_in_polygon


def check_escalation_risk(second_lat, second_lon, tank_a_thermal_bands):
    """
    Checks whether a second facility location falls inside any of Tank A's
    thermal hazard bands. If so, returns escalation risk info identifying the
    MOST SEVERE band the second facility falls within (not just any band --
    if it's inside both the 'pain' and 'serious' bands, report 'serious' since
    that's the more severe/informative classification).

    tank_a_thermal_bands: the existing "bands" list from Module 1/2's response
    for the thermal hazard type, each with "polygon" and "label" fields already
    present -- this function does NOT recompute anything, only checks containment
    against already-computed polygons.

    Returns:
    {
        "at_risk": bool,
        "band_label": str or None,   # the most severe band it falls within, if any
        "threshold_kw_m2": float or None,
        "message": str or None
    }
    """
    # Sort bands by severity (most severe = smallest radius = checked first,
    # since we want to report the MOST severe band the point falls within)
    sorted_bands = sorted(
        tank_a_thermal_bands, key=lambda b: b.get("radius_no_wind_m", float("inf"))
    )

    for band in sorted_bands:
        if band.get("clipped", False):
            continue  # don't base an escalation claim on an untrustworthy, out-of-range radius
        if point_in_polygon(second_lat, second_lon, band["polygon"]):
            return {
                "at_risk": True,
                "band_label": band["label"],
                "threshold_kw_m2": band["threshold_kw_m2"],
                "message": f"Second facility lies within the {band['threshold_kw_m2']} kW/m² "
                f"({band['label']}) zone of the primary facility — possible escalation risk.",
            }

    return {"at_risk": False, "band_label": None, "threshold_kw_m2": None, "message": None}
