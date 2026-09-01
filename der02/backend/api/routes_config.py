"""
Facility configuration schema endpoint.

Advertises the substance list and the input bounds the backend actually
enforces, so the Module 4 input panel can build its dropdown and sliders from
the live backend rather than from a hand-copied second set of numbers.

Every value below is READ from the existing definitions -- SUBSTANCES in
physics/substances.py and the bound constants in physics/engine.py that
validate_inputs() itself compares against. Nothing here is retyped as a
literal, so the advertised schema and the enforced validation cannot drift.
No validation logic is duplicated or modified.
"""

from fastapi import APIRouter

from physics.engine import (
    EXCLUSIVE_MIN_FIELDS,
    MAX_HUMIDITY_PCT,
    MAX_TANK_DIAMETER_M,
    MAX_TANK_VOLUME_M3,
    MAX_WIND_DIR_DEG,
    MAX_WIND_SPEED_KMH,
    MIN_HUMIDITY_PCT,
    MIN_TANK_DIAMETER_M,
    MIN_TANK_VOLUME_M3,
    MIN_WIND_DIR_DEG,
    MIN_WIND_SPEED_KMH,
)
from physics.substances import SUBSTANCES

router = APIRouter()


@router.get("/api/facility-config-schema")
def facility_config_schema():
    """
    Substance options and input bounds for the facility configuration panel.

    Substance order follows SUBSTANCES' own insertion order, so the dropdown
    matches the reference table rather than imposing a separate ordering.
    """
    bounds = {
        "tank_volume_m3": {
            "min": MIN_TANK_VOLUME_M3,
            "max": MAX_TANK_VOLUME_M3,
        },
        "tank_diameter_m": {
            "min": MIN_TANK_DIAMETER_M,
            "max": MAX_TANK_DIAMETER_M,
        },
        "wind_speed_kmh": {
            "min": MIN_WIND_SPEED_KMH,
            "max": MAX_WIND_SPEED_KMH,
        },
        "wind_dir_deg": {
            "min": MIN_WIND_DIR_DEG,
            "max": MAX_WIND_DIR_DEG,
        },
        "humidity_pct": {
            "min": MIN_HUMIDITY_PCT,
            "max": MAX_HUMIDITY_PCT,
        },
    }

    # Flag only the fields validate_inputs() checks with a strict `MIN < x`.
    # Driven by EXCLUSIVE_MIN_FIELDS rather than a literal here, so the flag
    # and the comparison it describes stay declared in one place. Fields not
    # listed there are left untouched and accept their minimum.
    for field in EXCLUSIVE_MIN_FIELDS:
        bounds[field]["exclusive_min"] = True

    return {
        "substances": [
            {"key": key, "display_name": substance["display_name"]}
            for key, substance in SUBSTANCES.items()
        ],
        "bounds": bounds,
    }
