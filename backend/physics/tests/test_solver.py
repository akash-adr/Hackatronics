"""
Tests for the generic bisection solver.

The solver is validated against a function whose crossing point is known
analytically, so a failure here means the solver itself is wrong rather than
some hazard correlation built on top of it.
"""

import pytest

from physics.solver import find_radius_for_threshold


# f(x) = 100 / x is strictly decreasing on x > 0, and crosses any positive
# threshold t at exactly x = 100 / t.
def inverse_law(x):
    return 100.0 / x


@pytest.mark.parametrize(
    "threshold, expected_radius",
    [
        (2.0, 50.0),    # crossing near the middle of the search range
        (8.0, 12.5),    # crossing nearer the inner edge
        (3.0, 33.3),    # non-terminating crossing (33.333...), tests rounding
        (0.1, 1000.0),  # crossing near the outer edge
    ],
)
def test_finds_known_crossing_point(threshold, expected_radius):
    result = find_radius_for_threshold(inverse_law, threshold)

    assert result["clipped"] is False
    assert "reason" not in result
    assert abs(result["radius_m"] - expected_radius) < 0.01


def test_below_min_range_branch():
    # At x_min = 0.5 the function is only 200, far under this threshold, so the
    # hazard never reaches it and the solver must say so rather than guess.
    result = find_radius_for_threshold(inverse_law, 1e9)

    assert result["clipped"] is True
    assert result["reason"] == "below_min_range"
    assert result["radius_m"] == 0.5


def test_beyond_max_range_branch():
    # At x_max = 2000 the function is still 0.05, above this threshold, so the
    # true crossing lies outside the search range.
    result = find_radius_for_threshold(inverse_law, 1e-9)

    assert result["clipped"] is True
    assert result["reason"] == "beyond_max_range"
    assert result["radius_m"] == 2000.0


def test_clipped_flag_distinguishes_boundary_from_real_crossing():
    # A real crossing that happens to land exactly on a boundary value must
    # still be reported as unclipped -- clipped is about whether a crossing was
    # found, not about where the answer sits.
    at_max = find_radius_for_threshold(inverse_law, 100.0 / 2000)
    assert at_max["radius_m"] == 2000.0
    assert at_max["clipped"] is False


@pytest.mark.parametrize("iterations", [30, 60, 100, 200])
def test_result_converges_as_iterations_increase(iterations):
    # 60 iterations already halves the 2000 m range far below the 0.1 m
    # rounding granularity, so more iterations must not move the answer.
    baseline = find_radius_for_threshold(inverse_law, 3.0, iterations=60)
    result = find_radius_for_threshold(inverse_law, 3.0, iterations=iterations)

    assert result["radius_m"] == baseline["radius_m"]


def test_solver_is_side_effect_free():
    # The solver must only read from value_func, never retain or mutate state:
    # two identical calls return equal results and the call count is stable.
    calls = []

    def counting(x):
        calls.append(x)
        return inverse_law(x)

    first = find_radius_for_threshold(counting, 2.0, iterations=20)
    count_after_first = len(calls)
    second = find_radius_for_threshold(counting, 2.0, iterations=20)

    assert first == second
    assert len(calls) - count_after_first == count_after_first
