"""
Tests for the dual-facility decision layer.

The single-facility path is not exercised or altered here -- these only cover
the new joint safe-approach and cross-facility exposure logic.
"""

import copy

from geometry.engine import compute_warped_zones
from physics.engine import compute_zone
from safe_approach.dual_facility import (
    check_cross_facility_exposure,
    compute_joint_safe_approach,
)

# Two centres ~300 m apart (0.0027 deg lat is about 300 m).
CENTER_A = {"lat": 13.0827, "lng": 80.2707}
CENTER_B_NEAR = {"lat": 13.0830, "lng": 80.2707}  # ~33 m north
CENTER_B_FAR = {"lat": 13.1827, "lng": 80.2707}  # ~11 km north


def _warped(substance, volume, diameter, center, wind_speed=15, wind_dir=90, humidity=50):
    """Run the real, unmodified pipeline for one facility."""
    zones = compute_zone(substance, volume, diameter, wind_speed, humidity, "thermal")
    return compute_warped_zones(zones, wind_dir, wind_speed, center["lat"], center["lng"])


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

    assert "best_bearing_deg" in result
    assert "min_standoff_m" in result
    assert "best_bearing_range_deg" in result
    assert result["min_standoff_m"] > 0


def test_joint_safe_approach_uses_larger_of_two_radii():
    """Confirms the conservative max() combination rule, not an average."""
    # Both facilities at the SAME centre, so the projection offset is zero and
    # the combined reach at every bearing is exactly max(r_A, r_B).
    small, large = 100.0, 200.0
    result = compute_joint_safe_approach(
        CENTER_A, _uniform_bands(small), CENTER_A, _uniform_bands(large)
    )

    # max() -> 200 m everywhere -> standoff = max(200*1.2, 200+20) = 240.0
    # An average would give 150 m -> 180.0, which must NOT happen.
    assert result["min_standoff_m"] == 240.0
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
