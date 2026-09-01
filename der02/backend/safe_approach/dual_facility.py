"""
Second facility & combined threat assessment.

Purely additive. Nothing in physics/engine.py, geometry/engine.py, or
safe_approach/engine.py is modified: each facility is computed by calling the
existing, unmodified pipeline independently, and only the decision layer on
top -- a joint safe-approach bearing and a cross-facility exposure check -- is
new.
"""

import math

from geometry.wind_scaling import angle_diff
from safe_approach.engine import compute_safe_approach_for_response

# haversine_distance already exists in validation.py (added with the
# second-facility placement validator), so it is imported rather than
# redefined -- the spec's instruction to reuse an existing implementation if
# one is found. Re-exported here so callers of this module can use it.
from validation import haversine_distance  # noqa: F401

EARTH_RADIUS_M = 6371000.0


def _radius_at_bearing_from_point(
    per_angle_radii, facility_center, reference_point, bearing_deg
):
    """Projects a facility's own (bearing-from-itself, radius) data onto a
    distance-from-a-shared-reference-point measurement. This is a coordinate
    transform of already-computed numbers -- no new physics or geometry."""
    closest = min(per_angle_radii, key=lambda pr: abs(angle_diff(pr[0], bearing_deg)))
    facility_radius = closest[1]

    dx = (
        (facility_center["lng"] - reference_point["lng"])
        * 111320.0
        * math.cos(math.radians(reference_point["lat"]))
    )
    dy = (facility_center["lat"] - reference_point["lat"]) * 111320.0
    offset_along_bearing = dx * math.sin(math.radians(bearing_deg)) + dy * math.cos(
        math.radians(bearing_deg)
    )

    return facility_radius + offset_along_bearing


def compute_joint_safe_approach(
    facility_A_center,
    facility_A_thermal_bands,
    facility_B_center,
    facility_B_thermal_bands,
):
    """
    Joint safe-approach recommendation clearing BOTH facilities' zones.
    Uses each facility's outermost (largest, least severe) thermal band.
    The combination rule at each bearing is the CONSERVATIVE choice -- the
    LARGER of the two hazard reaches -- never an average, since a bearing is
    only genuinely safe if it clears the more dangerous of the two zones at
    that specific angle.
    """
    midpoint = {
        "lat": (facility_A_center["lat"] + facility_B_center["lat"]) / 2,
        "lng": (facility_A_center["lng"] + facility_B_center["lng"]) / 2,
    }

    outer_band_A = max(facility_A_thermal_bands, key=lambda b: b["radius_no_wind_m"])
    outer_band_B = max(facility_B_thermal_bands, key=lambda b: b["radius_no_wind_m"])

    combined_radii = []
    for bearing_deg, _ in outer_band_A["per_angle_radii"]:
        r_A = _radius_at_bearing_from_point(
            outer_band_A["per_angle_radii"], facility_A_center, midpoint, bearing_deg
        )
        r_B = _radius_at_bearing_from_point(
            outer_band_B["per_angle_radii"], facility_B_center, midpoint, bearing_deg
        )
        combined_radii.append((bearing_deg, max(r_A, r_B)))

    # Reuses the EXISTING single-facility selector unmodified, by handing it a
    # synthetic one-band response describing the combined envelope.
    result = compute_safe_approach_for_response(
        {
            "thermal": {
                "bands": [
                    {
                        "label": "combined_outer",
                        "clipped": False,
                        "per_angle_radii": combined_radii,
                        "radius_no_wind_m": max(r for _, r in combined_radii),
                    }
                ]
            }
        }
    )

    # The selector names a band after its threshold, but the combined envelope
    # is the max of two facilities' outer bands and has no single threshold --
    # so it would come back as "..._Nonekw". Name it for what it actually is.
    if result:
        result["based_on_band"] = "combined_outer_thermal_envelope"
    return result


def check_cross_facility_exposure(
    facility_A_warped, facility_A_center, facility_B_warped, facility_B_center
):
    """
    Does either facility's thermal zone reach the other facility's location?
    Reuses haversine_distance and each facility's already-computed band radii
    -- no new geometric primitive, just a distance-to-centre check.
    """
    exposures = []

    for band in facility_A_warped["thermal"]["bands"]:
        if band["clipped"]:
            continue
        distance_A_to_B = haversine_distance(
            facility_A_center["lat"],
            facility_A_center["lng"],
            facility_B_center["lat"],
            facility_B_center["lng"],
        )
        if distance_A_to_B <= band["radius_no_wind_m"]:
            exposures.append(
                {
                    "exposed_facility": "B",
                    "source_facility": "A",
                    "band_label": band["label"],
                    "distance_m": round(distance_A_to_B, 1),
                }
            )

    for band in facility_B_warped["thermal"]["bands"]:
        if band["clipped"]:
            continue
        distance_B_to_A = haversine_distance(
            facility_B_center["lat"],
            facility_B_center["lng"],
            facility_A_center["lat"],
            facility_A_center["lng"],
        )
        if distance_B_to_A <= band["radius_no_wind_m"]:
            exposures.append(
                {
                    "exposed_facility": "A",
                    "source_facility": "B",
                    "band_label": band["label"],
                    "distance_m": round(distance_B_to_A, 1),
                }
            )

    return exposures
