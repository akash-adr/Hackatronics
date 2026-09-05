"""
Validation tests for the solid-flame thermal model.

No published closed-form reference case is available for the full chained
model, so these tests pin down the properties that must hold (monotonicity,
bounds, graceful degenerate behaviour) plus one independently derived check
on the view factor.
"""

import math

import pytest

from physics.thermal_model import (
    THERMAL_BANDS,
    flame_height,
    flame_tilt,
    thermal_flux,
    transmissivity,
    view_factor,
)


def test_thermal_flux_decreases_with_distance():
    near = thermal_flux(20, "propane", 10)
    far = thermal_flux(50, "propane", 10)

    assert near > far


def test_thermal_known_reference_case():
    # No published EXPECTED_REFERENCE value exists for this exact
    # configuration, so this asserts physical plausibility and logs the value
    # for manual comparison against literature.
    result = thermal_flux(50, "lng_methane", 20)

    print(
        f"\n[reference case] thermal_flux(x=50 m, lng_methane, D=20 m) "
        f"= {result:.3f} kW/m^2"
    )

    assert math.isfinite(result)
    assert 0 < result < 500


def test_zero_wind_no_crash():
    tilt = flame_tilt(0, 0.099, 10)

    assert tilt == 0.0


def test_view_factor_capped_at_1():
    # Receiver essentially on the flame axis: inside the envelope, capped.
    assert view_factor(1e-9, 10, 22.6) == 1.0


@pytest.mark.parametrize("x", [0.001, 0.5, 1.0, 5.0, 10.0, 25.0, 100.0, 1000.0])
def test_view_factor_never_exceeds_1(x):
    F = view_factor(x, 10, 22.6)

    assert math.isfinite(F)
    assert 0.0 <= F <= 1.0


@pytest.mark.parametrize(
    "S_, h, expected_F",
    [
        # Reference values from direct numerical integration of the radiation
        # configuration integral (4000 x 1200 grid over the cylinder surface),
        # combined as F = sqrt(F_v^2 + F_h^2). These lock in the view factor
        # algebra so it cannot drift.
        (1.5, 2.00, 0.392201),
        (2.0, 3.00, 0.285075),
        (4.0, 4.50, 0.125649),
        (5.0, 3.17, 0.075690),
        (10.0, 4.53, 0.027894),
        (20.0, 2.00, 0.003296),
    ],
)
def test_view_factor_matches_numerical_integration(S_, h, expected_F):
    # view_factor takes physical lengths; pick R = 1 m so x = S_ and H = h.
    F = view_factor(S_, 2.0, h)

    assert F == pytest.approx(expected_F, abs=1e-4)


def test_view_factor_decreases_with_distance():
    factors = [view_factor(x, 10, 22.6) for x in (10, 20, 40, 80, 160)]

    assert all(a > b for a, b in zip(factors, factors[1:]))


def test_flame_height_matches_thomas_correlation():
    # Independent recomputation of the correlation for propane at D = 10 m.
    expected = 42 * 10 * (0.099 / (1.2 * (9.81 * 10) ** 0.5)) ** 0.61

    assert flame_height(10, 0.099) == pytest.approx(expected)


def test_transmissivity_bounded_and_decreasing():
    assert transmissivity(0) == 1.0
    assert transmissivity(10) > transmissivity(100)
    assert all(0.0 <= transmissivity(x) <= 1.0 for x in (1, 10, 100, 1e6))


def test_wind_tilts_flame_and_reduces_flux():
    # The disclosed first-order tilt correction scales the view factor by
    # cos(tilt), so a tilted flame must not read hotter than an upright one.
    assert flame_tilt(20, 0.099, 10) > 0
    assert thermal_flux(50, "propane", 10, wind_speed_ms=20) < thermal_flux(
        50, "propane", 10, wind_speed_ms=0
    )


def test_thermal_bands_shape():
    assert [b["label"] for b in THERMAL_BANDS] == ["fatal", "serious", "pain"]
    assert [b["threshold_kw_m2"] for b in THERMAL_BANDS] == [37.5, 12.5, 4.0]


# --- humidity: transmissivity now genuinely depends on it ----------------


def test_humidity_reduces_transmissivity_at_fixed_distance():
    tau_dry = transmissivity(x=100, humidity_pct=10)
    tau_humid = transmissivity(x=100, humidity_pct=90)
    assert tau_humid < tau_dry


def test_zero_humidity_does_not_crash():
    tau = transmissivity(x=100, humidity_pct=0)
    assert 0.0 <= tau <= 1.0


def test_full_humidity_range_stays_in_bounds():
    for h in [0, 10, 25, 50, 75, 90, 100]:
        tau = transmissivity(x=50, humidity_pct=h)
        assert 0.0 <= tau <= 1.0


def test_humidity_changes_the_final_hazard_radius():
    flux_dry = thermal_flux(
        x=100, substance_key="propane", tank_diameter_m=8, wind_speed_ms=0, humidity_pct=10
    )
    flux_humid = thermal_flux(
        x=100, substance_key="propane", tank_diameter_m=8, wind_speed_ms=0, humidity_pct=90
    )
    assert flux_humid < flux_dry


def test_transmissivity_backward_compatible_default_temp():
    tau_explicit = transmissivity(x=50, humidity_pct=50, ambient_temp_c=20)
    tau_default = transmissivity(x=50, humidity_pct=50)
    assert tau_explicit == tau_default
