"""
Tests for the dual-facility decision layer.

The single-facility path is not exercised or altered here -- these only cover
the new joint safe-approach and cross-facility exposure logic.
"""

import copy

from geometry.engine import compute_warped_zones
from physics.engine import compute_zone
from safe_approach.dual_facility import (
    _project_point,
    check_cross_facility_exposure,
    compute_joint_safe_approach,
    haversine_distance,
)

# Two centres ~300 m apart (0.0027 deg lat is about 300 m).
CENTER_A = {"lat": 13.0827, "lng": 80.2707}
CENTER_B_NEAR = {"lat": 13.0830, "lng": 80.2707}  # ~33 m north
CENTER_B_FAR = {"lat": 13.1827, "lng": 80.2707}  # ~11 km north


def _warped(substance, volume, diameter, center, wind_speed=15, wind_dir=90, humidity=50):
    """Run the real, unmodified pipeline for one facility."""
    zones = compute_zone(substance, volume, diameter, wind_speed, humidity, "thermal")
    return compute_warped_zones(zones, wind_dir, wind_speed, center["lat"], center["lng"])


def build_test_radii(radius):
    """72 (bearing, radius) pairs at one constant radius -- a circular zone."""
    return [(360.0 * i / 72, radius) for i in range(72)]


def _uniform_bands(radius_m, label="pain"):
    """A synthetic band whose reach is the same at every bearing."""
    return [
        {
            "label": label,
            "clipped": False,
            "radius_no_wind_m": radius_m,
            "per_angle_radii": [(float(t), radius_m) for t in range(0, 360, 5)],
        }
    ]


def test_two_different_substances_produce_different_zones():
    """CRITICAL test: confirms facility B's own substance genuinely drives
    its own independent zone, not a copy of facility A's."""
    zones_propane = compute_zone("propane", 500, 8, 15, 50, "thermal")
    zones_crude = compute_zone("crude_oil", 500, 8, 15, 50, "thermal")
    fatal_propane = next(
        b["radius_no_wind_m"] for b in zones_propane["thermal"]["bands"] if b["label"] == "fatal"
    )
    fatal_crude = next(
        b["radius_no_wind_m"] for b in zones_crude["thermal"]["bands"] if b["label"] == "fatal"
    )
    assert fatal_propane != fatal_crude  # different substances MUST produce different radii


def test_joint_safe_approach_returns_valid_structure():
    warped_a = _warped("propane", 500, 8, CENTER_A)
    warped_b = _warped("crude_oil", 20000, 35, CENTER_B_FAR)

    result = compute_joint_safe_approach(
        CENTER_A,
        warped_a["thermal"]["bands"],
        CENTER_B_FAR,
        warped_b["thermal"]["bands"],
    )

    # Contract after the clearing-distance fix: a bearing, a standoff, and an
    # explicit availability flag. best_bearing_range_deg is deliberately gone
    # -- a range cannot be claimed safe without clearing-testing every bearing
    # in it, which is the bug this fix removed.
    assert result["available"] is True
    assert "best_bearing_deg" in result
    assert "min_standoff_m" in result
    assert result["verified_outside_both_zones"] is True
    # NOTE: for well-separated facilities the midpoint is ALREADY outside both
    # zones, so the clearing walk returns 0 m and the standoff is 0.0. That is
    # geometrically safe but operationally empty -- see the report; it is
    # asserted here as the current contract, not endorsed as good behaviour.
    assert result["min_standoff_m"] >= 0


def test_joint_safe_approach_uses_larger_of_two_radii():
    """Confirms the conservative max() combination rule, not an average."""
    # Both facilities at the SAME centre, so the projection offset is zero and
    # the combined reach at every bearing is exactly max(r_A, r_B).
    small, large = 100.0, 200.0
    result = compute_joint_safe_approach(
        CENTER_A, _uniform_bands(small), CENTER_A, _uniform_bands(large)
    )

    # The clearing walk must escape the LARGER zone (200 m), so the standoff
    # is 200 * 1.2 = 240 m plus at most one 5 m search step of slack. An
    # average-based rule would give 150 m -> 180 m, which must NOT happen.
    assert 240.0 <= result["min_standoff_m"] <= 246.0
    assert result["min_standoff_m"] != 180.0


def test_joint_safe_approach_is_conservative_against_each_alone():
    """The joint standoff must clear the larger facility, never undercut it."""
    small, large = 100.0, 200.0
    joint = compute_joint_safe_approach(
        CENTER_A, _uniform_bands(small), CENTER_A, _uniform_bands(large)
    )
    larger_alone = compute_joint_safe_approach(
        CENTER_A, _uniform_bands(large), CENTER_A, _uniform_bands(large)
    )
    assert joint["min_standoff_m"] >= larger_alone["min_standoff_m"]


def test_cross_exposure_detects_when_facilities_are_close():
    # 33 m apart: inside crude oil's outer thermal bands.
    warped_a = _warped("crude_oil", 20000, 35, CENTER_A)
    warped_b = _warped("crude_oil", 20000, 35, CENTER_B_NEAR)

    exposures = check_cross_facility_exposure(
        warped_a, CENTER_A, warped_b, CENTER_B_NEAR
    )
    assert len(exposures) > 0
    assert {e["exposed_facility"] for e in exposures} <= {"A", "B"}
    assert all("band_label" in e and "distance_m" in e for e in exposures)


def test_cross_exposure_empty_when_facilities_are_far_apart():
    warped_a = _warped("propane", 500, 8, CENTER_A)
    warped_b = _warped("propane", 500, 8, CENTER_B_FAR)

    exposures = check_cross_facility_exposure(
        warped_a, CENTER_A, warped_b, CENTER_B_FAR
    )
    assert exposures == []


def test_clipped_bands_excluded_from_cross_exposure():
    """A clipped band's radius is a search boundary, not a real threshold
    crossing -- must never be used to claim exposure."""
    warped_a = _warped("crude_oil", 20000, 35, CENTER_A)
    warped_b = _warped("crude_oil", 20000, 35, CENTER_B_NEAR)

    # Sanity: with real (unclipped) bands there IS exposure to detect.
    assert check_cross_facility_exposure(warped_a, CENTER_A, warped_b, CENTER_B_NEAR)

    clipped_a = copy.deepcopy(warped_a)
    clipped_b = copy.deepcopy(warped_b)
    for warped in (clipped_a, clipped_b):
        for band in warped["thermal"]["bands"]:
            band["clipped"] = True

    # Same geometry, but every band is now untrustworthy -> no claim at all.
    assert check_cross_facility_exposure(clipped_a, CENTER_A, clipped_b, CENTER_B_NEAR) == []


def test_facility_b_config_drives_its_own_warped_zone():
    """End-to-end: two facilities, different configs, genuinely different bands."""
    warped_a = _warped("propane", 500, 8, CENTER_A)
    warped_b = _warped("crude_oil", 20000, 35, CENTER_B_FAR)

    radii_a = [b["radius_no_wind_m"] for b in warped_a["thermal"]["bands"]]
    radii_b = [b["radius_no_wind_m"] for b in warped_b["thermal"]["bands"]]

    assert radii_a != radii_b
    # And each carries its own polygon geometry, centred on its own location.
    assert warped_a["thermal"]["bands"][0]["polygon"][0] != warped_b["thermal"]["bands"][0]["polygon"][0]


# --- clearing-distance fix: the recommendation must be geometrically outside
# --- BOTH zones, not merely "locally small" by the old max-radius proxy.


def test_recommendation_never_falls_inside_either_zone():
    facility_A_center = {"lat": 13.0827, "lng": 80.2707}
    facility_B_center = {"lat": 13.0830, "lng": 80.2715}
    thermal_bands_A = [
        {
            "label": "fatal",
            "radius_no_wind_m": 150,
            "clipped": False,
            "per_angle_radii": build_test_radii(150),
        }
    ]
    thermal_bands_B = [
        {
            "label": "fatal",
            "radius_no_wind_m": 140,
            "clipped": False,
            "per_angle_radii": build_test_radii(140),
        }
    ]
    result = compute_joint_safe_approach(
        facility_A_center, thermal_bands_A, facility_B_center, thermal_bands_B
    )
    assert result["available"] is True
    midpoint = {
        "lat": (facility_A_center["lat"] + facility_B_center["lat"]) / 2,
        "lng": (facility_A_center["lng"] + facility_B_center["lng"]) / 2,
    }
    point = _project_point(midpoint, result["best_bearing_deg"], result["min_standoff_m"])
    dist_to_A = haversine_distance(
        point["lat"], point["lng"], facility_A_center["lat"], facility_A_center["lng"]
    )
    dist_to_B = haversine_distance(
        point["lat"], point["lng"], facility_B_center["lat"], facility_B_center["lng"]
    )
    assert dist_to_A >= thermal_bands_A[0]["radius_no_wind_m"]
    assert dist_to_B >= thermal_bands_B[0]["radius_no_wind_m"]


def test_recommendation_not_in_the_overlap_gap():
    facility_A_center = {"lat": 13.0827, "lng": 80.2707}
    facility_B_center = {"lat": 13.0827, "lng": 80.2712}
    thermal_bands_A = [
        {
            "label": "fatal",
            "radius_no_wind_m": 120,
            "clipped": False,
            "per_angle_radii": build_test_radii(120),
        }
    ]
    thermal_bands_B = [
        {
            "label": "fatal",
            "radius_no_wind_m": 120,
            "clipped": False,
            "per_angle_radii": build_test_radii(120),
        }
    ]
    result = compute_joint_safe_approach(
        facility_A_center, thermal_bands_A, facility_B_center, thermal_bands_B
    )
    assert result["available"] is True
    bearing = result["best_bearing_deg"]
    in_the_gap = (80 <= bearing <= 100) or (260 <= bearing <= 280)
    assert not in_the_gap


def test_no_safe_bearing_returns_unavailable_not_a_bad_answer():
    facility_A_center = {"lat": 13.0827, "lng": 80.2707}
    facility_B_center = {"lat": 13.0827, "lng": 80.2708}
    # Must exceed CLEARING_SEARCH_MAX_M (3000 m): with 2000 m zones every
    # bearing clears inside the search range, so "unavailable" is unreachable.
    huge_bands = [
        {
            "label": "fatal",
            "radius_no_wind_m": 3200,
            "clipped": False,
            "per_angle_radii": build_test_radii(2000),
        }
    ]
    result = compute_joint_safe_approach(
        facility_A_center, huge_bands, facility_B_center, huge_bands
    )
    assert result["available"] is False
    assert "reason" in result


def test_well_separated_facilities_still_work_normally():
    facility_A_center = {"lat": 13.0827, "lng": 80.2707}
    facility_B_center = {"lat": 13.1200, "lng": 80.3200}
    small_bands = [
        {
            "label": "fatal",
            "radius_no_wind_m": 80,
            "clipped": False,
            "per_angle_radii": build_test_radii(80),
        }
    ]
    result = compute_joint_safe_approach(
        facility_A_center, small_bands, facility_B_center, small_bands
    )
    assert result["available"] is True
    assert result["min_standoff_m"] < 200


def test_well_separated_facilities_never_produce_zero_standoff():
    """Regression test: when facilities are far apart enough that the midpoint
    is already clear, the recommendation must still be a real, visible standoff
    distance, never 0m (which produces an unusable zero-area wedge on the map)."""
    facility_A_center = {"lat": 13.0827, "lng": 80.2707}
    facility_B_center = {"lat": 13.0900, "lng": 80.2900}  # well separated
    small_bands_A = [
        {
            "label": "fatal",
            "radius_no_wind_m": 80,
            "clipped": False,
            "per_angle_radii": build_test_radii(80),
        }
    ]
    small_bands_B = [
        {
            "label": "fatal",
            "radius_no_wind_m": 80,
            "clipped": False,
            "per_angle_radii": build_test_radii(80),
        }
    ]
    result = compute_joint_safe_approach(
        facility_A_center, small_bands_A, facility_B_center, small_bands_B
    )
    assert result["available"] is True
    assert result["min_standoff_m"] > 0, (
        "Standoff must never be zero -- produces an unusable zero-area wedge"
    )
