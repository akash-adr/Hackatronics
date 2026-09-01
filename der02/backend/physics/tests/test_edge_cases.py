"""
Edge-case sweeps across the full substance table.

These are robustness tests, not accuracy tests: the hazard models are called
by a solver that sweeps distances and by an API that accepts user input, so
no input in the plausible range may raise or produce NaN.
"""

import math

import pytest

from physics.blast_model import blast_overpressure_at
from physics.engine import compute_zone, normalize_wind_dir
from physics.substances import SUBSTANCES
from physics.thermal_model import flame_height, flame_tilt, thermal_flux, view_factor

# 200 km/h, roughly a category-3 hurricane -- the upper bound of plausible input.
MAX_WIND_MS = 200 / 3.6


@pytest.mark.parametrize("substance_key", sorted(SUBSTANCES))
def test_all_substances_thermal_no_crash(substance_key):
    result = thermal_flux(50, substance_key, 10)

    assert math.isfinite(result)
    assert result >= 0


@pytest.mark.parametrize("substance_key", sorted(SUBSTANCES))
def test_all_substances_blast_no_crash(substance_key):
    p_psi, w_tnt = blast_overpressure_at(50, substance_key, 500)

    assert math.isfinite(p_psi)
    assert math.isfinite(w_tnt)
    assert p_psi >= 0
    assert w_tnt >= 0


@pytest.mark.parametrize("substance_key", sorted(SUBSTANCES))
def test_max_wind_no_crash(substance_key):
    burn_rate = SUBSTANCES[substance_key]["burn_rate_kg_m2_s"]

    tilt = flame_tilt(MAX_WIND_MS, burn_rate, 10)
    assert math.isfinite(tilt)
    assert 0 <= tilt <= math.pi / 2

    flux = thermal_flux(50, substance_key, 10, wind_speed_ms=MAX_WIND_MS)
    assert math.isfinite(flux)
    assert flux >= 0


@pytest.mark.parametrize("D", [0, 1e-12, 1e-9, 1e-6, 0.001, 0.1])
def test_zero_tank_diameter_handled(D):
    # A vanishing pool must degrade to zero flux, never NaN or a divide by
    # zero. flame_height and view_factor are guarded at the same threshold.
    H = flame_height(D, 0.099)
    assert math.isfinite(H)
    assert H >= 0

    F = view_factor(50, D, max(H, 0.0))
    assert math.isfinite(F)
    assert 0 <= F <= 1

    flux = thermal_flux(50, "propane", D)
    assert math.isfinite(flux)
    assert flux >= 0

    assert math.isfinite(flame_tilt(10, 0.099, D))


@pytest.mark.parametrize("D", [0, 1e-12])
def test_degenerate_diameter_gives_zero_flux(D):
    assert thermal_flux(50, "propane", D) == 0.0


def test_zero_volume_tank_gives_no_blast():
    # An empty tank has no charge, so overpressure must vanish rather than
    # divide by a zero charge mass.
    p_psi, w_tnt = blast_overpressure_at(50, "propane", 0)

    assert w_tnt == 0
    assert p_psi == pytest.approx(0.0)


@pytest.mark.parametrize("x", [0.001, 1, 10, 100, 1000, 2000])
def test_thermal_flux_finite_across_full_solver_range(x):
    # The solver sweeps x from 0.5 to 2000 m; every point must be evaluable.
    result = thermal_flux(x, "propane", 10)

    assert math.isfinite(result)
    assert result >= 0


# --- orchestrator (engine.compute_zone) ----------------------------------


def test_compute_zone_idempotent():
    # compute_zone is documented as pure; identical inputs must give an
    # identical dict, or downstream caching and reruns are unsafe.
    first = compute_zone("propane", 500, 8, 18, 60, "both")
    second = compute_zone("propane", 500, 8, 18, 60, "both")

    assert first == second


def test_compute_zone_both_hazard_types():
    result = compute_zone("propane", 500, 8, 18, 60, "both")

    assert "thermal" in result
    assert "blast" in result
    assert result["thermal"]["bands"]
    assert result["blast"]["bands"]
    assert result["thermal"]["flame_height_m"] > 0
    assert result["blast"]["tnt_equiv_kg"] > 0
    assert result["sources"]


def test_compute_zone_thermal_only():
    result = compute_zone("propane", 500, 8, 18, 60, "thermal")

    assert "thermal" in result
    assert "blast" not in result


def test_compute_zone_blast_only():
    result = compute_zone("propane", 500, 8, 18, 60, "blast")

    assert "blast" in result
    assert "thermal" not in result


@pytest.mark.parametrize("substance_key", sorted(SUBSTANCES))
def test_compute_zone_all_substances_no_crash(substance_key):
    result = compute_zone(substance_key, 500, 8, 18, 60, "both")

    assert set(result) == {"thermal", "blast", "sources"}
    for band in result["thermal"]["bands"]:
        assert math.isfinite(band["radius_no_wind_m"])
        assert isinstance(band["clipped"], bool)
    for band in result["blast"]["bands"]:
        assert math.isfinite(band["radius_m"])
        assert isinstance(band["clipped"], bool)


@pytest.mark.parametrize("raw, expected", [(450, 90), (-30, 330)])
def test_wind_dir_normalization(raw, expected):
    assert normalize_wind_dir(raw) == expected


def test_compute_zone_band_shape_matches_contract():
    result = compute_zone("propane", 500, 8, 18, 60, "both")

    for band in result["thermal"]["bands"]:
        assert set(band) == {"threshold_kw_m2", "label", "radius_no_wind_m", "clipped"}
    for band in result["blast"]["bands"]:
        assert set(band) == {"threshold_psi", "label", "radius_m", "clipped"}
    assert len(result["sources"]) == 4


def test_compute_zone_radii_ordered_by_severity():
    # A more severe threshold must sit closer in than a milder one.
    result = compute_zone("propane", 500, 8, 18, 60, "both")

    thermal = [b["radius_no_wind_m"] for b in result["thermal"]["bands"]]
    blast = [b["radius_m"] for b in result["blast"]["bands"]]

    assert thermal == sorted(thermal)
    assert blast == sorted(blast)
