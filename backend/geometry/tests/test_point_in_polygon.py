"""Tests for the ray-casting containment check."""

from geometry.point_in_polygon import point_in_polygon


def test_point_clearly_inside_square():
    square = [(0, 0), (0, 10), (10, 10), (10, 0), (0, 0)]
    assert point_in_polygon(5, 5, square) == True


def test_point_clearly_outside_square():
    square = [(0, 0), (0, 10), (10, 10), (10, 0), (0, 0)]
    assert point_in_polygon(50, 50, square) == False


def test_point_on_boundary_does_not_crash():
    # Boundary behavior can go either way for ray-casting -- just confirm no crash/exception
    square = [(0, 0), (0, 10), (10, 10), (10, 0), (0, 0)]
    result = point_in_polygon(0, 5, square)
    assert result in (True, False)


def test_point_inside_realistic_hazard_polygon():
    # Use a real-shaped polygon similar to what wind_warped_polygon produces --
    # a roughly circular/egg-shaped set of ~73 points
    from geometry.polygon_builder import wind_warped_polygon

    polygon = wind_warped_polygon(
        R0_m=200, wind_from_deg=270, wind_speed=20, center_lat=13.0827, center_lon=80.2707
    )
    # Center point should always be inside
    assert point_in_polygon(13.0827, 80.2707, polygon) == True
    # A point very far away should be outside
    assert point_in_polygon(20.0, 90.0, polygon) == False
