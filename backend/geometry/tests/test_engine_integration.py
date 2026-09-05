"""
Tests for the Module 1 -> Module 2 seam.

The contract under test is narrow and strict: Module 2 may ADD fields, and
may never drop, overwrite, or recompute anything Module 1 produced.
"""

import copy

import pytest

from geometry.engine import compute_warped_zones

MODULE2_CITATION = "Cosine-based directional scaling model (Module 2)"

# Shaped exactly like physics.engine.compute_zone()'s real propane output.
REALISTIC_MODULE1_RESPONSE = {
    "thermal": {
        "flame_height_m": 19.4,
        "bands": [
            {"threshold_kw_m2": 37.5, "label": "fatal", "radius_no_wind_m": 7.8, "clipped": False},
            {"threshold_kw_m2": 12.5, "label": "serious", "radius_no_wind_m": 18.3, "clipped": False},
            {"threshold_kw_m2": 4.0, "label": "pain", "radius_no_wind_m": 35.9, "clipped": False},
        ],
    },
    "blast": {
        "tnt_equiv_kg": 271008.6,
        "bands": [
            {"threshold_psi": 8, "label": "fatal", "radius_m": 234.0, "clipped": False},
            {"threshold_psi": 3, "label": "structural", "radius_m": 394.8, "clipped": False},
            {"threshold_psi": 1, "label": "glass_breakage", "radius_m": 870.3, "clipped": True},
        ],
    },
    "sources": [
        "Thomas flame height correlation",
        "Mudan and Croce cylindrical solid-flame view factor method",
        "Kinney-Graham blast overpressure approximation",
        "Substance data: NFPA 30 / CHRIS Manual reference tables",
    ],
}


@pytest.fixture
def module1_response():
    # Deep copy so a mutation bug in the engine cannot leak between tests.
    return copy.deepcopy(REALISTIC_MODULE1_RESPONSE)


def test_clipped_flag_passes_through_unmodified(module1_response):
    result = compute_warped_zones(module1_response, 45, 18, 13.0827, 80.2707)

    # The glass_breakage band is the clipped one in the fixture.
    clipped_band = result["blast"]["bands"][2]
    assert clipped_band["label"] == "glass_breakage"
    assert clipped_band["clipped"] is True

    # And the unclipped ones stay unclipped.
    assert all(b["clipped"] is False for b in result["thermal"]["bands"])


def test_all_original_band_fields_preserved(module1_response):
    result = compute_warped_zones(module1_response, 45, 18, 13.0827, 80.2707)

    original = module1_response["thermal"]["bands"][0]
    warped = result["thermal"]["bands"][0]

    for key, value in original.items():
        assert key in warped, f"field {key} was dropped"
        assert warped[key] == value, f"field {key} was modified"

    assert "polygon" in warped
    assert "per_angle_radii" in warped
    # Module 2 adds exactly these two fields and drops nothing.
    assert set(warped) == set(original) | {"polygon", "per_angle_radii"}


def test_sibling_fields_outside_bands_are_preserved(module1_response):
    # flame_height_m / tnt_equiv_kg live alongside "bands" and must survive.
    result = compute_warped_zones(module1_response, 45, 18, 13.0827, 80.2707)

    assert result["thermal"]["flame_height_m"] == 19.4
    assert result["blast"]["tnt_equiv_kg"] == 271008.6


def test_module1_response_is_not_mutated(module1_response):
    before = copy.deepcopy(module1_response)
    compute_warped_zones(module1_response, 45, 18, 13.0827, 80.2707)

    assert module1_response == before


def test_wind_block_correctness(module1_response):
    result = compute_warped_zones(module1_response, 45, 18, 13.0827, 80.2707)

    assert result["wind"] == {"from_deg": 45, "speed_kmh": 18, "to_deg": 225}


def test_sources_array_extended_not_replaced(module1_response):
    result = compute_warped_zones(module1_response, 45, 18, 13.0827, 80.2707)

    for original_source in module1_response["sources"]:
        assert original_source in result["sources"]
    assert MODULE2_CITATION in result["sources"]
    assert len(result["sources"]) == len(module1_response["sources"]) + 1


def test_full_pipeline_realistic_case(module1_response):
    result = compute_warped_zones(
        module1_response,
        wind_from_deg=45,
        wind_speed_kmh=18,
        center_lat=13.0827,
        center_lon=80.2707,
    )

    all_bands = result["thermal"]["bands"] + result["blast"]["bands"]
    assert len(all_bands) == 6

    for band in all_bands:
        polygon = band["polygon"]
        assert len(polygon) == 73
        assert polygon[0] == polygon[-1]
        assert all(len(p) == 2 for p in polygon)


def test_missing_hazard_type_stays_none(module1_response):
    # A thermal-only Module 1 response must not fabricate a blast section.
    del module1_response["blast"]
    result = compute_warped_zones(module1_response, 45, 18, 13.0827, 80.2707)

    assert result["blast"] is None
    assert result["thermal"] is not None


def test_no_physics_is_recomputed(module1_response):
    # Radii must be carried across verbatim -- Module 2 warps geometry, it
    # does not adjust the numbers Module 1 produced.
    result = compute_warped_zones(module1_response, 45, 18, 13.0827, 80.2707)

    assert [b["radius_no_wind_m"] for b in result["thermal"]["bands"]] == [7.8, 18.3, 35.9]
    assert [b["radius_m"] for b in result["blast"]["bands"]] == [234.0, 394.8, 870.3]
