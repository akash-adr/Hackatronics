"""
Point-in-polygon containment test.

Isolated and dependency-free on purpose: it performs no physics and no
geometry construction, it only answers whether a coordinate lies inside a
polygon that some other module already computed.
"""


def point_in_polygon(lat, lon, polygon_points):
    """
    Ray-casting point-in-polygon test. polygon_points is a list of (lat, lon)
    tuples forming a closed polygon (first point repeated as last, per the
    existing convention already used throughout this codebase -- e.g. Module 2's
    wind_warped_polygon output).

    Returns True if (lat, lon) falls inside the polygon, False otherwise.

    Standard ray-casting algorithm: cast a ray from the point to infinity in
    one direction, count how many polygon edges it crosses. Odd count = inside,
    even count = outside.

    The straddle test guarantees lon_i != lon_j whenever the division runs, so
    the edge case of a horizontal edge cannot divide by zero.
    """
    n = len(polygon_points)
    inside = False
    j = n - 1
    for i in range(n):
        lat_i, lon_i = polygon_points[i]
        lat_j, lon_j = polygon_points[j]
        if ((lon_i > lon) != (lon_j > lon)) and (
            lat < (lat_j - lat_i) * (lon - lon_i) / (lon_j - lon_i) + lat_i
        ):
            inside = not inside
        j = i
    return inside
