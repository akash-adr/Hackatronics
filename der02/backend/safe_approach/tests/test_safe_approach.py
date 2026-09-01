"""
Tests for the safe-approach engine.

Test data is generated with the real wind_scaling_factor rather than
hand-written numbers, so these exercise the actual geometry the live system
uses instead of a fabricated stand-in that could drift away from it.
"""

import pytest

from geometry.wind_scaling import angle_diff, wind_scaling_factor
from safe_approach.engine import (
    compute_safe_approach,
    compute_safe_approach_for_response,
    find_contiguous_range,
    select_outer_band_with_fallback,
)


def build_test_per_angle_radii(wind_from_deg, wind_speed, R0_m=100, k=0.0075, alpha_max=0.6):
    """Realistic (theta, radius) pairs built from the real scaling function."""
    return [
        (
            float(theta),
            R0_m * wind_scaling_factor(theta, wind_from_deg, wind_speed, k, alpha_max),
        )
        for theta in range(0, 360, 5)
    ]


def _width(bearing_range):
    """Clockwise width of a [start, end] arc, wraparound included."""
    start, end = bearing_range
    return (end - start) % 360


# --- core bearing selection ---------------------------------------------


def test_safe_bearing_is_roughly_upwind_in_simple_case():
    # Wind FROM 270: the zone stretches downwind to 90, so 90 is the LEAST
    # safe bearing and 270 (upwind, least hazard reach) is the safest.
    radii = build_test_per_angle_radii(wind_from_deg=270, wind_speed=30)
    result = compute_safe_approach(radii, center_lat=13.0, center_lon=80.2)

    assert abs(angle_diff(result["best_bearing_deg"], 270)) < 20


@pytest.mark.parametrize("wind_from", [0, 45, 90, 180, 270, 315])
def test_safe_bearing_is_upwind_for_every_wind_direction(wind_from):
    # The safest bearing must track the wind around the whole compass,
    # including across the 0/360 boundary.
    radii = build_test_per_angle_radii(wind_from_deg=wind_from, wind_speed=30)
    result = compute_safe_approach(radii, center_lat=13.0, center_lon=80.2)

    assert abs(angle_diff(result["best_bearing_deg"], wind_from)) < 20


def test_best_bearing_is_the_minimum_radius_not_the_maximum():
    # Guards the correction documented in the module docstring: picking the
    # maximum radius would recommend approaching straight up the plume.
    radii = build_test_per_angle_radii(wind_from_deg=270, wind_speed=30)
    result = compute_safe_approach(radii, center_lat=13.0, center_lon=80.2)

    distances = dict(radii)
    chosen = distances[result["best_bearing_deg"]]

    assert chosen == pytest.approx(min(distances.values()))
    assert chosen < max(distances.values())


def test_zero_wind_safe_bearing_is_stable():
    radii = build_test_per_angle_radii(wind_from_deg=0, wind_speed=0)
    result = compute_safe_approach(radii, center_lat=13.0, center_lon=80.2)

    assert result["best_bearing_range_deg"] is not None
    assert result["min_standoff_m"] > 0


# --- standoff margin -----------------------------------------------------


def test_standoff_includes_margin():
    radii = build_test_per_angle_radii(wind_from_deg=180, wind_speed=20)
    result = compute_safe_approach(radii, center_lat=13.0, center_lon=80.2)

    # The standoff is built from the radius at the chosen bearing, which is
    # the minimum. (The brief compared against max(...), which belongs to the
    # argmax reading corrected in the module docstring.)
    basis = min(dict(radii).values())

    assert result["min_standoff_m"] > basis


def test_absolute_margin_floor_wins_for_small_zones():
    # 20% of a tiny radius is a negligible buffer, so the +20 m floor applies.
    radii = build_test_per_angle_radii(wind_from_deg=180, wind_speed=20, R0_m=10)
    result = compute_safe_approach(radii, center_lat=13.0, center_lon=80.2)

    basis = min(dict(radii).values())

    assert result["min_standoff_m"] == pytest.approx(round(basis + 20, 1))


def test_proportional_margin_wins_for_large_zones():
    radii = build_test_per_angle_radii(wind_from_deg=180, wind_speed=20, R0_m=1000)
    result = compute_safe_approach(radii, center_lat=13.0, center_lon=80.2)

    basis = min(dict(radii).values())

    assert result["min_standoff_m"] == pytest.approx(round(basis * 1.2, 1))


# --- corridor width ------------------------------------------------------


def test_degenerate_wide_range_is_capped():
    # Almost-circular zone: nearly every bearing qualifies, so a naive
    # tolerance check would report a "safe" arc across most of the compass.
    radii = build_test_per_angle_radii(wind_from_deg=90, wind_speed=0.5, R0_m=10)
    result = compute_safe_approach(radii, center_lat=13.0, center_lon=80.2)

    assert _width(result["best_bearing_range_deg"]) <= 90


def test_zero_wind_range_is_capped_too():
    radii = build_test_per_angle_radii(wind_from_deg=0, wind_speed=0)
    result = compute_safe_approach(radii, center_lat=13.0, center_lon=80.2)

    assert _width(result["best_bearing_range_deg"]) <= 90


def test_corridor_contains_the_best_bearing():
    radii = build_test_per_angle_radii(wind_from_deg=45, wind_speed=25)
    result = compute_safe_approach(radii, center_lat=13.0, center_lon=80.2)

    start, end = result["best_bearing_range_deg"]
    offset = (result["best_bearing_deg"] - start) % 360

    assert offset <= _width([start, end])


# --- contiguous range ----------------------------------------------------


def test_contiguous_range_wraparound():
    qualifying = [350, 355, 0, 5, 10]
    start, end = find_contiguous_range(qualifying, best_theta=0)

    # One arc across the boundary, not two broken pieces.
    assert (start, end) == (350, 10)
    assert (end - start) % 360 == 20


def test_contiguous_range_stops_at_a_gap():
    # 25 is missing, so the arc must not jump across it to 30.
    qualifying = [0, 5, 10, 15, 20, 30, 35]
    start, end = find_contiguous_range(qualifying, best_theta=10)

    assert (start, end) == (0, 20)


def test_contiguous_range_single_bearing():
    start, end = find_contiguous_range([90], best_theta=90)

    assert (start, end) == (90, 90)


# --- band selection and clipping ----------------------------------------


CLIPPED_OUTER_BANDS = [
    {"label": "pain", "radius_m": 900.0, "clipped": True},
    {"label": "serious", "radius_m": 400.0, "clipped": False},
    {"label": "fatal", "radius_m": 100.0, "clipped": False},
]


def test_clipped_band_falls_back():
    chosen = select_outer_band_with_fallback(CLIPPED_OUTER_BANDS, "radius_m")

    assert chosen is not None
    assert chosen["label"] == "serious"
    assert chosen["clipped"] is False


def test_all_bands_clipped_returns_none():
    all_clipped = [{**b, "clipped": True} for b in CLIPPED_OUTER_BANDS]

    assert select_outer_band_with_fallback(all_clipped, "radius_m") is None


def test_unclipped_outermost_band_is_chosen_directly():
    bands = [{**b, "clipped": False} for b in CLIPPED_OUTER_BANDS]
    chosen = select_outer_band_with_fallback(bands, "radius_m")

    assert chosen["label"] == "pain"


# --- full integration ----------------------------------------------------


def build_warped_response(wind_from_deg=45, wind_speed=18, clipped_outermost=False):
    """Mimics the shape compute_warped_zones() actually produces."""

    def band(extra, R0, clipped=False):
        return {
            **extra,
            "clipped": clipped,
            "polygon": [],
            "per_angle_radii": build_test_per_angle_radii(
                wind_from_deg, wind_speed, R0_m=R0
            ),
        }

    return {
        "thermal": {
            "flame_height_m": 19.4,
            "bands": [
                band({"threshold_kw_m2": 37.5, "label": "fatal", "radius_no_wind_m": 7.8}, 7.8),
                band({"threshold_kw_m2": 12.5, "label": "serious", "radius_no_wind_m": 18.3}, 18.3),
                band({"threshold_kw_m2": 4.0, "label": "pain", "radius_no_wind_m": 35.9}, 35.9),
            ],
        },
        "blast": {
            "tnt_equiv_kg": 271008.6,
            "bands": [
                band({"threshold_psi": 8, "label": "fatal", "radius_m": 234.0}, 234.0),
                band({"threshold_psi": 3, "label": "structural", "radius_m": 394.8}, 394.8),
                band(
                    {"threshold_psi": 1, "label": "glass_breakage", "radius_m": 870.3},
                    870.3,
                    clipped=clipped_outermost,
                ),
            ],
        },
        "sources": ["Module 1 source"],
    }


def test_full_integration_realistic_case():
    result = compute_safe_approach_for_response(build_warped_response())

    assert result is not None
    assert set(result) == {
        "best_bearing_deg",
        "best_bearing_range_deg",
        "min_standoff_m",
        "based_on_band",
    }
    # Blast reaches furthest, so the corridor is based on its outermost band.
    assert result["based_on_band"] == "blast_glass_breakage_1psi"
    assert result["min_standoff_m"] > 0


def test_integration_considers_both_hazard_types():
    # Thermal bands are far smaller here; the chosen band must still be the
    # globally outermost one rather than the first hazard type encountered.
    result = compute_safe_approach_for_response(build_warped_response())

    assert result["based_on_band"].startswith("blast_")


def test_integration_falls_back_when_outermost_is_clipped():
    response = build_warped_response(clipped_outermost=True)
    result = compute_safe_approach_for_response(response)

    assert result["based_on_band"] == "blast_structural_3psi"


def test_integration_returns_none_when_every_band_is_clipped():
    response = build_warped_response()
    for hazard_type in ("thermal", "blast"):
        for band in response[hazard_type]["bands"]:
            band["clipped"] = True

    assert compute_safe_approach_for_response(response) is None


def test_integration_bearing_is_upwind():
    result = compute_safe_approach_for_response(
        build_warped_response(wind_from_deg=45, wind_speed=18)
    )

    assert abs(angle_diff(result["best_bearing_deg"], 45)) < 20


def test_integration_handles_missing_hazard_type():
    response = build_warped_response()
    response["blast"] = None
    result = compute_safe_approach_for_response(response)

    assert result is not None
    assert result["based_on_band"] == "thermal_pain_4kw"
