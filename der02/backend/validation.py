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
