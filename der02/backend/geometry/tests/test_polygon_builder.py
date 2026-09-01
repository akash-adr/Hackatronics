"""
Tests for the geography half.

Distances are measured with an independent haversine implementation rather
than by inverting polygon_builder's own equirectangular projection, so a bug
in that projection cannot hide itself by being used on both sides of the
assertion.
"""

import math

import pytest

from geometry.polygon_builder import wind_warped_polygon
from geometry.wind_scaling import angle_diff

CENTER_LAT = 13.0
CENTER_LON = 80.2
EARTH_RADIUS_M = 6371008.8


def haversine_m(lat1, lon1, lat2, lon2):
    """Great-circle distance in metres -- independent of the module's math."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def radii_from_center(poly, lat=CENTER_LAT, lon=CENTER_LON):
    """Distance to each sample point, excluding the closing duplicate."""
    return [haversine_m(lat, lon, p[0], p[1]) for p in poly[:-1]]


def test_zero_wind_is_circle():
    poly = wind_warped_polygon(
        R0_m=100, wind_from_deg=270, wind_speed=0, center_lat=CENTER_LAT, center_lon=CENTER_LON
    )
    distances = radii_from_center(poly)

    assert len(distances) == 72
    assert max(distances) - min(distances) < 0.5


def test_downwind_point_is_longest():
    # wind from 270 -> downwind 90 -> theta 90 is sample index 18 of 72.
    poly = wind_warped_polygon(
        R0_m=100, wind_from_deg=270, wind_speed=30, center_lat=CENTER_LAT, center_lon=CENTER_LON
    )
    distances = radii_from_center(poly)

    assert distances.index(max(distances)) == 18


def test_upwind_point_is_shortest():
    # wind from 270 -> upwind is 270 -> theta 270 is sample index 54 of 72.
    poly = wind_warped_polygon(
        R0_m=100, wind_from_deg=270, wind_speed=30, center_lat=CENTER_LAT, center_lon=CENTER_LON
    )
    distances = radii_from_center(poly)

    assert distances.index(min(distances)) == 54


def test_no_negative_or_null_radius():
    poly = wind_warped_polygon(
        R0_m=5, wind_from_deg=0, wind_speed=200, center_lat=CENTER_LAT, center_lon=CENTER_LON
    )

    assert len(poly) == 73
    for point in poly:
        assert isinstance(point, tuple) and len(point) == 2
        lat, lon = point
        assert lat is not None and lon is not None
        assert math.isfinite(lat) and math.isfinite(lon)
        assert -90 <= lat <= 90 and -180 <= lon <= 180

    # Every radius stays strictly positive even at this extreme.
    assert min(radii_from_center(poly)) > 0


def test_radius_never_falls_below_one_metre_floor():
    # A degenerate base radius must still clear the 1 m safety floor.
    poly = wind_warped_polygon(
        R0_m=0, wind_from_deg=0, wind_speed=50, center_lat=CENTER_LAT, center_lon=CENTER_LON
    )

    assert min(radii_from_center(poly)) >= 0.9  # 1 m floor, less rounding


def test_polygon_is_closed():
    poly = wind_warped_polygon(
        R0_m=100, wind_from_deg=180, wind_speed=15, center_lat=CENTER_LAT, center_lon=CENTER_LON
    )

    assert poly[0] == poly[-1]


def test_correct_point_count():
    poly = wind_warped_polygon(
        R0_m=100,
        wind_from_deg=45,
        wind_speed=10,
        center_lat=CENTER_LAT,
        center_lon=CENTER_LON,
        n_samples=72,
    )

    assert len(poly) == 73  # 72 samples + 1 closing duplicate


@pytest.mark.parametrize("wind_from", [0, 45, 90, 180, 270, 359])
def test_longest_point_always_lies_downwind(wind_from):
    # Holds for every wind bearing, including across the 0/360 boundary.
    # With 72 samples the grid is 5 degrees, so the longest point is the
    # sample nearest true downwind -- within half a step (2.5 degrees).
    poly = wind_warped_polygon(
        R0_m=200, wind_from_deg=wind_from, wind_speed=40, center_lat=CENTER_LAT, center_lon=CENTER_LON
    )
    distances = radii_from_center(poly)
    longest_theta = distances.index(max(distances)) * 5
    downwind = (wind_from + 180) % 360

    assert abs(angle_diff(longest_theta, downwind)) <= 2.5
