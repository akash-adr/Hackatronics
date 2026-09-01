"""
Orchestrator for the DER-02 physics engine.

Takes validated scenario inputs, runs the thermal and blast hazard models
through the bisection solver at each hazard band, and assembles the response
contract consumed by the API layer.

Pure computation: no I/O, no database access, no framework imports, no
randomness, no hidden state. compute_zone() is referentially transparent --
identical inputs always yield an identical dict.
"""

from physics.blast_model import BLAST_BANDS, blast_overpressure_at
from physics.solver import find_radius_for_threshold
from physics.substances import SUBSTANCES
from physics.thermal_model import THERMAL_BANDS, flame_height, thermal_flux

# Accepted input ranges, named so that validate_inputs() below and the
# schema endpoint that advertises these limits to the frontend read the exact
# same values and cannot drift apart.
#
# NOTE ON THE LOWER BOUNDS: tank volume and diameter are checked with a
# STRICT inequality (MIN < x), because a tank with no volume or no diameter is
# not a scenario. Wind speed and humidity are checked INCLUSIVELY (MIN <= x),
# because zero wind and zero humidity are both perfectly valid. The constants
# are all 0; the difference lives in the comparison operators below.
MIN_TANK_VOLUME_M3 = 0
MAX_TANK_VOLUME_M3 = 200000
MIN_TANK_DIAMETER_M = 0
MAX_TANK_DIAMETER_M = 150
MIN_WIND_SPEED_KMH = 0
MAX_WIND_SPEED_KMH = 200
MIN_HUMIDITY_PCT = 0
MAX_HUMIDITY_PCT = 100

# The fields whose lower bound is STRICT, matching the `MIN < x` comparisons
# in validate_inputs() below. Declared here so the schema endpoint can
# advertise the exclusivity instead of clients having to rediscover it by
# getting a 400 back. Any field not listed here accepts its minimum.
EXCLUSIVE_MIN_FIELDS = ("tank_volume_m3", "tank_diameter_m")

# Wind direction is never rejected -- normalize_wind_dir() wraps any bearing
# into [0, 360), so these are not validation bounds. They exist so the UI can
# render a full-compass control over the same range the wrapping produces.
MIN_WIND_DIR_DEG = 0
MAX_WIND_DIR_DEG = 360

HAZARD_TYPES = ("thermal", "blast", "both")


def validate_inputs(
    substance_key, tank_volume_m3, tank_diameter_m, wind_speed_kmh, humidity_pct
):
    """
    Check scenario inputs against accepted ranges.

    Returns:
        list[str] -- one human-readable message per failed check, empty when
        every input is acceptable. All inputs are checked so the caller can
        report every problem at once rather than one per round trip.
    """
    errors = []

    if substance_key not in SUBSTANCES:
        known = ", ".join(sorted(SUBSTANCES))
        errors.append(f"Unknown substance '{substance_key}'. Expected one of: {known}.")

    if not MIN_TANK_VOLUME_M3 < tank_volume_m3 <= MAX_TANK_VOLUME_M3:
        errors.append(
            f"tank_volume_m3 must be greater than {MIN_TANK_VOLUME_M3} and at most "
            f"{MAX_TANK_VOLUME_M3}, got {tank_volume_m3}."
        )

    if not MIN_TANK_DIAMETER_M < tank_diameter_m <= MAX_TANK_DIAMETER_M:
        errors.append(
            f"tank_diameter_m must be greater than {MIN_TANK_DIAMETER_M} and at most "
            f"{MAX_TANK_DIAMETER_M}, got {tank_diameter_m}."
        )

    if not MIN_WIND_SPEED_KMH <= wind_speed_kmh <= MAX_WIND_SPEED_KMH:
        errors.append(
            f"wind_speed_kmh must be between {MIN_WIND_SPEED_KMH} and "
            f"{MAX_WIND_SPEED_KMH}, got {wind_speed_kmh}."
        )

    if not MIN_HUMIDITY_PCT <= humidity_pct <= MAX_HUMIDITY_PCT:
        errors.append(
            f"humidity_pct must be between {MIN_HUMIDITY_PCT} and "
            f"{MAX_HUMIDITY_PCT}, got {humidity_pct}."
        )

    return errors


def normalize_wind_dir(wind_dir_deg):
    """
    Wrap a wind bearing into [0, 360).

    A direction is never invalid, only unwrapped: 450 deg and 90 deg name the
    same bearing, as do -30 deg and 330 deg. Python's modulo returns a
    non-negative result for a positive divisor, so negative bearings wrap
    correctly. Module 2 consumes this when orienting the zone downwind.
    """
    return wind_dir_deg % 360


def compute_zone(
    substance_key,
    tank_volume_m3,
    tank_diameter_m,
    wind_speed_kmh,
    humidity_pct=50,
    hazard_type="both",
):
    """
    Solve hazard-band radii for a scenario.

    Args:
        substance_key:   key into SUBSTANCES
        tank_volume_m3:  tank capacity, m^3 (drives the blast inventory)
        tank_diameter_m: tank diameter, m (drives the pool fire geometry)
        wind_speed_kmh:  wind speed, km/h
        humidity_pct:    relative humidity, percent
        hazard_type:     "thermal", "blast", or "both"

    Returns:
        dict with "sources" always present, plus "thermal" and/or "blast"
        depending on hazard_type.

    Callers must run validate_inputs() first; this function assumes its
    arguments are already in range.
    """
    substance = SUBSTANCES[substance_key]

    # Retained for Module 2, which will use wind speed and bearing to distort
    # the circular baseline zones below into a downwind-elongated footprint.
    wind_speed_ms = wind_speed_kmh / 3.6

    # Assembled in contract order: thermal, blast, then sources.
    result = {}

    if hazard_type in ("thermal", "both"):
        # The radii below are the no-wind baseline (hence radius_no_wind_m):
        # an upright flame radiating symmetrically, giving a circular zone.
        # Wind is deliberately not applied here -- Module 2 owns directional
        # distortion, and folding tilt in now would double-count it.
        def flux_at(x):
            return thermal_flux(x, substance_key, tank_diameter_m, 0, humidity_pct)

        thermal_bands = []
        for band in THERMAL_BANDS:
            solved = find_radius_for_threshold(flux_at, band["threshold_kw_m2"])
            thermal_bands.append(
                {
                    **band,
                    "radius_no_wind_m": solved["radius_m"],
                    "clipped": solved["clipped"],
                }
            )

        result["thermal"] = {
            "flame_height_m": round(
                flame_height(tank_diameter_m, substance["burn_rate_kg_m2_s"]), 1
            ),
            "bands": thermal_bands,
        }

    if hazard_type in ("blast", "both"):

        def overpressure_at(x):
            return blast_overpressure_at(x, substance_key, tank_volume_m3)[0]

        blast_bands = []
        for band in BLAST_BANDS:
            solved = find_radius_for_threshold(overpressure_at, band["threshold_psi"])
            blast_bands.append(
                {
                    **band,
                    "radius_m": solved["radius_m"],
                    "clipped": solved["clipped"],
                }
            )

        # The charge mass describes the inventory, not the receiver, so the
        # sampling distance is arbitrary.
        _, w_tnt = blast_overpressure_at(100, substance_key, tank_volume_m3)

        result["blast"] = {
            "tnt_equiv_kg": round(w_tnt, 1),
            "bands": blast_bands,
        }

    result["sources"] = [
        "Thomas flame height correlation",
        "Mudan and Croce cylindrical solid-flame view factor method",
        "Kinney-Graham blast overpressure approximation",
        f"Substance data: {substance['source']}",
    ]

    return result
