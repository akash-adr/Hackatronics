"""
Tests for the pure trigonometric core.

These cover the two failure modes that would be invisible in code review but
obvious on screen: a wraparound glitch at the compass boundary, and the
wind from/to flip being applied backwards.
"""

import pytest

from geometry.wind_scaling import angle_diff, wind_scaling_factor

# Wind out of the west, so the hazard travels toward 90 degrees (east).
WIND_FROM = 270
DOWNWIND = 90
UPWIND = 270
SPEED = 30
K = 0.0075
ALPHA_MAX = 0.6
ALPHA_AT_SPEED = K * SPEED  # 0.225, well below the ceiling


def test_angle_diff_wraps_correctly():
    assert angle_diff(5, 355) == 10
    assert angle_diff(355, 5) == -10
    assert angle_diff(0, 0) == 0
    assert angle_diff(90, 0) == 90
    assert angle_diff(0, 90) == -90


def test_downwind_gives_maximum_scaling():
    downwind = wind_scaling_factor(DOWNWIND, WIND_FROM, SPEED)
    others = [
        wind_scaling_factor(theta, WIND_FROM, SPEED) for theta in (0, 45, 180, 270)
    ]

    assert downwind == pytest.approx(1 + ALPHA_AT_SPEED)
    assert all(downwind > other for other in others)


def test_upwind_gives_minimum_scaling():
    upwind = wind_scaling_factor(UPWIND, WIND_FROM, SPEED)
    others = [
        wind_scaling_factor(theta, WIND_FROM, SPEED) for theta in (0, 45, 90, 180)
    ]

    assert upwind == pytest.approx(1 - ALPHA_AT_SPEED)
    assert all(upwind < other for other in others)


@pytest.mark.parametrize("theta", [0, 180])
def test_crosswind_is_neutral(theta):
    # 90 degrees either side of the downwind bearing: cos(+-90) = 0.
    result = wind_scaling_factor(theta, WIND_FROM, SPEED)

    assert abs(result - 1.0) < 0.0001


def test_alpha_is_capped():
    S_extreme = wind_scaling_factor(
        theta_deg=0, wind_from_deg=270, wind_speed=9999, k=K, alpha_max=ALPHA_MAX
    )

    assert S_extreme <= 1.6  # 1 + alpha_max


def test_alpha_cap_binds_at_the_downwind_bearing():
    # theta=0 above is crosswind, where S is 1.0 whatever alpha does. The cap
    # is only actually exercised downwind, where cos(delta) = 1.
    S_downwind = wind_scaling_factor(
        theta_deg=DOWNWIND, wind_from_deg=270, wind_speed=9999, k=K, alpha_max=ALPHA_MAX
    )
    S_upwind = wind_scaling_factor(
        theta_deg=UPWIND, wind_from_deg=270, wind_speed=9999, k=K, alpha_max=ALPHA_MAX
    )

    assert S_downwind == pytest.approx(1.6)
    assert S_upwind == pytest.approx(0.4)  # never zero or negative


@pytest.mark.parametrize("theta", [0, 37, 90, 123, 180, 270, 359, 360])
def test_zero_wind_speed_gives_uniform_factor(theta):
    assert wind_scaling_factor(theta, WIND_FROM, 0) == 1.0


def test_no_discontinuity_across_the_compass_boundary():
    # Stepping across 0/360 must not jump. Without angle_diff's wrapping this
    # is exactly where the rendered polygon would kink.
    before = wind_scaling_factor(359.9, WIND_FROM, SPEED)
    after = wind_scaling_factor(0.1, WIND_FROM, SPEED)

    assert abs(after - before) < 0.001


def test_wind_direction_flip_is_not_inverted():
    # The single most likely sign error: if from/to were flipped, the zone
    # would stretch back toward where the wind came from.
    stretches_downwind = wind_scaling_factor(DOWNWIND, WIND_FROM, SPEED)
    compresses_upwind = wind_scaling_factor(UPWIND, WIND_FROM, SPEED)

    assert stretches_downwind > 1.0
    assert compresses_upwind < 1.0
