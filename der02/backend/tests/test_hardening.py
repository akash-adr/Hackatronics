"""
Module 7 hardening tests.

These cut across modules rather than testing one engine: rate limiting,
the shared validation surface, CORS configuration, and a repository-wide
scan for accidentally committed credentials.
"""

import pathlib
import re
import time

import pytest

from main import ALLOWED_ORIGINS
from rate_limiter import RATE_LIMIT_PER_SECOND, WINDOW_SECONDS, check_rate_limit
from validation import validate_facility_coordinates, validate_wind_direction

BACKEND_ROOT = pathlib.Path(__file__).resolve().parent.parent


# --- rate limiting -------------------------------------------------------


def test_rate_limit_rejects_excessive_requests():
    client_id = "test-client-unique-1"

    for _ in range(RATE_LIMIT_PER_SECOND):
        assert check_rate_limit(client_id) is True

    assert check_rate_limit(client_id) is False


def test_rate_limit_resets_after_window():
    client_id = "test-client-unique-2"

    for _ in range(RATE_LIMIT_PER_SECOND):
        check_rate_limit(client_id)

    time.sleep(WINDOW_SECONDS + 0.1)

    assert check_rate_limit(client_id) is True


def test_rate_limit_is_per_client():
    # One noisy client must not consume another client's budget.
    noisy = "test-client-noisy"
    quiet = "test-client-quiet"

    for _ in range(RATE_LIMIT_PER_SECOND + 5):
        check_rate_limit(noisy)

    assert check_rate_limit(noisy) is False
    assert check_rate_limit(quiet) is True


# --- validation surface --------------------------------------------------


def test_wind_direction_normalizes_rather_than_rejects():
    assert validate_wind_direction(400) == 40
    assert validate_wind_direction(-30) == 330


@pytest.mark.parametrize(
    "raw, expected", [(0, 0), (360, 0), (720, 0), (45, 45), (-390, 330), (359.5, 359.5)]
)
def test_wind_direction_wraps_every_case(raw, expected):
    assert validate_wind_direction(raw) == pytest.approx(expected)


def test_facility_coordinates_reject_invalid_lat():
    errors = validate_facility_coordinates(91, 80.2)
    assert len(errors) > 0


def test_facility_coordinates_reject_invalid_lon():
    errors = validate_facility_coordinates(13.0, 181)
    assert len(errors) > 0


def test_facility_coordinates_accept_valid():
    errors = validate_facility_coordinates(13.0827, 80.2707)
    assert len(errors) == 0


def test_facility_coordinates_accept_exact_bounds():
    assert validate_facility_coordinates(-90, -180) == []
    assert validate_facility_coordinates(90, 180) == []


def test_facility_coordinates_report_both_failures_at_once():
    errors = validate_facility_coordinates(91, 181)
    assert len(errors) == 2


# --- CORS ----------------------------------------------------------------


def test_cors_does_not_allow_wildcard():
    assert "*" not in ALLOWED_ORIGINS


def test_cors_origins_are_explicit_http_urls():
    assert ALLOWED_ORIGINS, "allow-list must not be empty"
    for origin in ALLOWED_ORIGINS:
        assert origin.startswith("http://") or origin.startswith("https://")


# --- secrets scan --------------------------------------------------------


# A string literal of 20+ characters assigned to a credential-sounding name.
SECRET_PATTERN = re.compile(
    r"""(?ix)
    \b\w*(?:api_?key|secret|token|password|passwd|access_?key)\w*\s*=\s*
    ['"][^'"]{20,}['"]
    """
)

SCAN_EXCLUDED = ("venv", "__pycache__", "tests", "node_modules")


def _python_files():
    for path in BACKEND_ROOT.rglob("*.py"):
        if any(part in SCAN_EXCLUDED for part in path.parts):
            continue
        yield path


def test_no_hardcoded_secrets_pattern_scan():
    findings = []

    for path in _python_files():
        for lineno, line in enumerate(
            path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1
        ):
            if SECRET_PATTERN.search(line):
                findings.append(f"{path.relative_to(BACKEND_ROOT)}:{lineno}: {line.strip()}")

    assert findings == [], "Possible hardcoded credentials:\n" + "\n".join(findings)


def test_scan_actually_inspects_files():
    # Guards the test above from silently passing because it found nothing to
    # read (a wrong root would make the secrets scan vacuously green).
    assert len(list(_python_files())) > 5


def test_env_example_contains_no_real_looking_values():
    example = BACKEND_ROOT / ".env.example"
    assert example.exists(), ".env.example must document required variables"

    for line in example.read_text().splitlines():
        if "=" not in line or line.strip().startswith("#"):
            continue
        _, _, value = line.partition("=")
        # A template must not carry anything long enough to be a real secret.
        assert len(value.strip()) < 20, f"suspiciously long value in .env.example: {line}"
