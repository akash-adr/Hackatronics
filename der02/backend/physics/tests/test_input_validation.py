"""
Tests for scenario input validation.

validate_inputs is the only thing standing between user-supplied numbers and
the correlations, so each bound is tested from both sides.
"""

import pytest

from physics.engine import normalize_wind_dir, validate_inputs


def test_rejects_negative_volume():
    assert validate_inputs("propane", -10, 8, 15, 50) != []


def test_rejects_unknown_substance():
    assert validate_inputs("unobtainium", 500, 8, 15, 50) != []


def test_rejects_oversized_tank():
    assert validate_inputs("propane", 300000, 8, 15, 50) != []


def test_rejects_negative_wind():
    assert validate_inputs("propane", 500, 8, -5, 50) != []


def test_rejects_invalid_humidity():
    assert validate_inputs("propane", 500, 8, 15, 150) != []


def test_accepts_valid_input():
    assert validate_inputs("propane", 500, 8, 15, 50) == []


def test_rejects_zero_volume_and_zero_diameter():
    # Zero is out of range at the open lower bound, not merely "small".
    assert validate_inputs("propane", 0, 8, 15, 50) != []
    assert validate_inputs("propane", 500, 0, 15, 50) != []


def test_rejects_oversized_diameter_and_wind():
    assert validate_inputs("propane", 500, 151, 15, 50) != []
    assert validate_inputs("propane", 500, 8, 201, 50) != []


@pytest.mark.parametrize(
    "volume, diameter, wind, humidity",
    [
        (200000, 150, 200, 100),  # every input exactly at its upper bound
        (0.001, 0.001, 0, 0),     # every input at its lower bound
    ],
)
def test_accepts_boundary_values(volume, diameter, wind, humidity):
    assert validate_inputs("propane", volume, diameter, wind, humidity) == []


def test_reports_every_problem_at_once():
    # A caller fixing a form should see all five failures in one response,
    # not discover them one request at a time.
    errors = validate_inputs("unobtainium", -10, -1, -5, 150)

    assert len(errors) == 5


def test_error_messages_are_strings():
    errors = validate_inputs("unobtainium", -10, 8, 15, 50)

    assert all(isinstance(e, str) and e for e in errors)


@pytest.mark.parametrize(
    "raw, expected",
    [(450, 90), (-30, 330), (0, 0), (359.9, 359.9), (360, 0), (720, 0), (-390, 330)],
)
def test_wind_dir_normalization_helper(raw, expected):
    assert normalize_wind_dir(raw) == pytest.approx(expected)
