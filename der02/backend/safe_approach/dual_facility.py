"""
Second facility & combined threat assessment.

Purely additive. Nothing in physics/engine.py, geometry/engine.py, or
safe_approach/engine.py is modified: each facility is computed by calling the
existing, unmodified pipeline independently, and only the decision layer on
top -- a joint safe-approach bearing and a cross-facility exposure check -- is
new.
"""

import math

from geometry.polygon_builder import METERS_PER_DEGREE_LAT
from geometry.wind_scaling import angle_diff

# haversine_distance already exists in validation.py (added with the
# second-facility placement validator), so it is imported rather than
# redefined -- the spec's instruction to reuse an existing implementation if
# one is found. Re-exported here so callers of this module can use it.
from validation import haversine_distance  # noqa: F401

EARTH_RADIUS_M = 6371000.0

# Outward walk used to find where a bearing actually clears both zones.
CLEARING_SEARCH_STEP_M = 5.0
CLEARING_SEARCH_MAX_M = 3000.0
N_CANDIDATE_BEARINGS = 72


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


def _project_point(origin, bearing_deg, distance_m):
    """Move distance_m metres from origin along bearing_deg. Same flat-earth
    approximation already used throughout Module 2's polygon builder."""
    dx = distance_m * math.sin(math.radians(bearing_deg))
    dy = distance_m * math.cos(math.radians(bearing_deg))
    lat = origin["lat"] + (dy / METERS_PER_DEGREE_LAT)
    lon = origin["lng"] + (
        dx / (METERS_PER_DEGREE_LAT * math.cos(math.radians(origin["lat"])))
    )
    return {"lat": lat, "lng": lon}


def _is_inside_zone(point, facility_center, band):
    """True if point is within this facility's outer thermal band radius of its own centre."""
    distance = haversine_distance(
        point["lat"], point["lng"], facility_center["lat"], facility_center["lng"]
    )
    return distance < band["radius_no_wind_m"]


def _find_minimum_clearing_distance(
    bearing_deg,
    origin,
    facility_A_center,
    outer_band_A,
    facility_B_center,
    outer_band_B,
    start_distance=0.0,
):
    """Walk outward from origin along bearing_deg until the point is OUTSIDE
    BOTH zones simultaneously -- the hard constraint the old proxy was missing.

    start_distance sets where the walk BEGINS, not what it accepts: every
    returned distance is still tested against both zones, so moving the start
    outward cannot weaken the guarantee. It exists because starting at the
    midpoint returns 0 m whenever the midpoint is already clear, which is a
    correct but unusable recommendation -- a zero-area wedge on the map."""
    distance = start_distance
    while distance < CLEARING_SEARCH_MAX_M:
        point = _project_point(origin, bearing_deg, distance)
        if not _is_inside_zone(
            point, facility_A_center, outer_band_A
        ) and not _is_inside_zone(point, facility_B_center, outer_band_B):
            return distance
        distance += CLEARING_SEARCH_STEP_M
    return None


def compute_joint_safe_approach(
    facility_A_center, facility_A_thermal_bands, facility_B_center, facility_B_thermal_bands
):
    """Joint safe-approach recommendation GUARANTEED to sit outside both
    facilities' outer thermal zones -- not merely 'locally small' by the
    old, buggy max-radius proxy."""
    midpoint = {
        "lat": (facility_A_center["lat"] + facility_B_center["lat"]) / 2,
        "lng": (facility_A_center["lng"] + facility_B_center["lng"]) / 2,
    }

    outer_band_A = max(facility_A_thermal_bands, key=lambda b: b["radius_no_wind_m"])
    outer_band_B = max(facility_B_thermal_bands, key=lambda b: b["radius_no_wind_m"])

    # Never start the search at the midpoint itself: for facilities far enough
    # apart the midpoint is already clear, and the walk would return 0 m --
    # a standoff no responder can act on and a wedge with no area. Starting at
    # the larger of the two hazard radii guarantees a real distance while the
    # per-point zone test (and the assertions below) keep it genuinely safe.
    minimum_starting_distance = max(
        outer_band_A["radius_no_wind_m"], outer_band_B["radius_no_wind_m"]
    )

    candidates = []
    for i in range(N_CANDIDATE_BEARINGS):
        bearing_deg = 360.0 * i / N_CANDIDATE_BEARINGS
        clearing_distance = _find_minimum_clearing_distance(
            bearing_deg,
            midpoint,
            facility_A_center,
            outer_band_A,
            facility_B_center,
            outer_band_B,
            start_distance=minimum_starting_distance,
        )
        if clearing_distance is not None:
            candidates.append((bearing_deg, clearing_distance))

    if not candidates:
        return {
            "available": False,
            "reason": (
                f"No approach bearing clears both facilities' hazard zones "
                f"within {CLEARING_SEARCH_MAX_M:.0f}m. The two facilities' "
                f"combined footprint may be too large or too close together "
                f"for a single safe standoff point to exist at this wind condition."
            ),
        }

    best_bearing_deg, best_standoff_m = min(candidates, key=lambda c: c[1])

    # MANDATORY VERIFICATION -- do not remove. Fails loudly if a logic error
    # is ever reintroduced, rather than silently returning an unsafe recommendation.
    recommended_point = _project_point(midpoint, best_bearing_deg, best_standoff_m)
    assert not _is_inside_zone(recommended_point, facility_A_center, outer_band_A), (
        "Joint safe-approach verification failed: recommended point is inside "
        "Facility A's zone. This must never happen -- do not remove this check."
    )
    assert not _is_inside_zone(recommended_point, facility_B_center, outer_band_B), (
        "Joint safe-approach verification failed: recommended point is inside "
        "Facility B's zone. This must never happen -- do not remove this check."
    )

    min_standoff_m = best_standoff_m * 1.20

    return {
        "available": True,
        "best_bearing_deg": best_bearing_deg,
        "min_standoff_m": round(min_standoff_m, 1),
        "verified_outside_both_zones": True,
    }


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
