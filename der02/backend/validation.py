"""
Centralised validation surface for the DER-02 API.

Every input check the API performs is reachable from this one module, so the
validation surface can be reviewed in a single place rather than traced across
routers. Module 1's validate_inputs() is re-exported rather than moved or
copied: it is frozen, heavily tested, and duplicating it here would create
exactly the second source of truth this module exists to prevent.
"""

from physics.engine import (  # noqa: F401  (re-exported as part of this surface)
    HAZARD_TYPES,
    normalize_wind_dir,
    validate_inputs,
)

# Latitude/longitude limits. These are geographic constants, not tunables.
MIN_LATITUDE, MAX_LATITUDE = -90, 90
MIN_LONGITUDE, MAX_LONGITUDE = -180, 180


def validate_wind_direction(wind_dir_deg):
    """
    Normalise a bearing into [0, 360). Never rejects.

    An out-of-range compass value (400, -30) is a harmless client quirk that
    names a real bearing, not a meaningful error -- so it is wrapped rather
    than refused.

    Delegates to Module 1's normalize_wind_dir() instead of recomputing the
    modulo, so the API and the physics engine can never disagree about what
    bearing a given input means.
    """
    return normalize_wind_dir(wind_dir_deg)


def validate_facility_coordinates(lat, lon):
    """
    Check a facility location.

    Returns:
        list[str] -- one message per failed check, empty when both are valid.
        Both are always checked so a caller sees every problem at once.
    """
    errors = []

    if not (MIN_LATITUDE <= lat <= MAX_LATITUDE):
        errors.append(f"Latitude must be between {MIN_LATITUDE} and {MAX_LATITUDE}")

    if not (MIN_LONGITUDE <= lon <= MAX_LONGITUDE):
        errors.append(f"Longitude must be between {MIN_LONGITUDE} and {MAX_LONGITUDE}")

    return errors


# ---------------------------------------------------------------------------
# Second-facility placement (multi-tank escalation feature).
# ---------------------------------------------------------------------------

# Minimum separation before a containment check is meaningful. Two facilities
# at the same coordinate is a placement error, not a scenario.
MIN_FACILITY_SEPARATION_M = 5


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Great-circle distance in metres.

    No production haversine existed in the codebase before this (only test
    helpers in geometry/tests and safe_approach/tests), so it is defined once
    here, beside the validator that needs it.
    """
    import math

    R = 6371000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))


def validate_second_facility_placement(
    lat1, lon1, lat2, lon2, min_separation_m=MIN_FACILITY_SEPARATION_M
):
    """
    Prevents a degenerate, zero-distance placement from reaching the domino-detection
    geometry check -- if the second facility is placed essentially on top of the first,
    reject it rather than computing a meaningless containment check.
    """
    distance = haversine_distance(lat1, lon1, lat2, lon2)

    if distance < min_separation_m:
        return [f"Second facility must be at least {min_separation_m}m from the first"]
    return []
