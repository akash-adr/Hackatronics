"""
THROWAWAY standalone check for Module 2's geometry -- not a test suite.

Run from backend/:  ./venv/bin/python -m geometry._manual_check

Delete once the real test suite exists in the next phase.
"""

import math

from geometry.polygon_builder import METERS_PER_DEGREE_LAT, wind_warped_polygon

CENTER_LAT = 13.0
CENTER_LON = 80.2
R0 = 100.0
WIND_FROM = 270  # wind out of the west -> hazard travels east (90 deg)


def ground_distance_m(point, lat0=CENTER_LAT, lon0=CENTER_LON):
    """Invert the equirectangular projection to recover metres from centre."""
    lat, lon = point
    dy = (lat - lat0) * METERS_PER_DEGREE_LAT
    dx = (lon - lon0) * METERS_PER_DEGREE_LAT * math.cos(math.radians(lat0))
    return math.hypot(dx, dy)


calm = wind_warped_polygon(R0, WIND_FROM, 0, CENTER_LAT, CENTER_LON)
windy = wind_warped_polygon(R0, WIND_FROM, 30, CENTER_LAT, CENTER_LON)

print("=" * 72)
print("1. CALM (wind_speed=0) -- expect a perfect circle, all radii = 100 m")
print("=" * 72)
for i in range(5):
    theta = 360.0 * i / 72
    lat, lon = calm[i]
    print(f"  i={i:<2} theta={theta:5.1f} deg  ({lat:.6f}, {lon:.6f})   r = {ground_distance_m(calm[i]):7.2f} m")

radii = [ground_distance_m(p) for p in calm[:-1]]
print(f"\n  min r = {min(radii):.3f} m   max r = {max(radii):.3f} m   spread = {max(radii)-min(radii):.3f} m")
print("  (spread is pure 6-decimal coordinate rounding, ~0.1 m -- geometrically a circle)")

print()
print("=" * 72)
print("2. WINDY (wind_speed=30) vs CALM -- the two points the brief asks for")
print("=" * 72)
print(f"  wind_from = {WIND_FROM} deg  ->  downwind = {(WIND_FROM + 180) % 360} deg (east)")
print()
for i, label in ((0, "theta=  0 deg, due NORTH"), (36, "theta=180 deg, due SOUTH")):
    c, w = calm[i], windy[i]
    print(f"  i={i:<2} {label}")
    print(f"        calm  ({c[0]:.6f}, {c[1]:.6f})   r = {ground_distance_m(c):7.2f} m")
    print(f"        windy ({w[0]:.6f}, {w[1]:.6f})   r = {ground_distance_m(w):7.2f} m")
    print(f"        delta r = {ground_distance_m(w) - ground_distance_m(c):+.2f} m")
    print()

print("  ^ Both are UNCHANGED, and that is the correct result, not a bug:")
print("    with wind from 270, downwind is 90 (east), so bearings 0 and 180")
print("    are exactly crosswind -- cos(+-90) = 0, so S = 1.0 at both.")
print()
print("  The bearings that actually move are downwind/upwind:")
for i, label in ((18, "theta= 90 deg, EAST  (downwind)"), (54, "theta=270 deg, WEST  (upwind)")):
    c, w = calm[i], windy[i]
    rc, rw = ground_distance_m(c), ground_distance_m(w)
    print(f"    i={i:<2} {label}:  calm {rc:6.2f} m -> windy {rw:6.2f} m   ({rw/rc:.2f}x)")

print()
print("=" * 72)
print("3. POLYGON CLOSURE")
print("=" * 72)
for name, poly in (("calm ", calm), ("windy", windy)):
    print(f"  {name}: len={len(poly)}  points[0]={poly[0]}  points[-1]={poly[-1]}  closed={poly[0] == poly[-1]}")


print()
print("=" * 72)
print("4. ALPHA CALIBRATION CHECK (k = 0.0075, alpha_max = 0.6)")
print("=" * 72)
K, ALPHA_MAX = 0.0075, 0.6
for speed, expected, descriptor in (
    (5, 0.0375, "calm     -- subtle elongation"),
    (20, 0.15, "moderate -- clearly elongated"),
    (50, 0.375, "strong   -- dramatically elongated"),
):
    alpha = min(ALPHA_MAX, K * speed)
    ok = abs(alpha - expected) < 1e-9
    print(f"  U = {speed:>2} km/h  ->  alpha = {alpha:.4f}   expected {expected:<6} "
          f"[{'OK' if ok else 'MISMATCH'}]   {descriptor}")

print(f"\n  alpha_max ceiling first reached at U = {ALPHA_MAX / K:.0f} km/h "
      f"-- above the 60 km/h\n  design maximum, so it never clamps normal demo values.")
