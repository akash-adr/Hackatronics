"""
Dual-facility compute endpoint.

New file alongside routes_compute_zone.py, which is not modified. Each
facility is run through the existing, unmodified Module 1 + 2 pipeline
independently, so facility B's own substance / volume / diameter genuinely
drive its own zone.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from geometry.engine import compute_warped_zones
from physics.engine import compute_zone
from rate_limiter import check_rate_limit
from safe_approach.dual_facility import (
    check_cross_facility_exposure,
    compute_joint_safe_approach,
)
from validation import (
    HAZARD_TYPES,
    validate_facility_coordinates,
    validate_inputs,
    validate_wind_direction,
)

router = APIRouter()


class FacilityInput(BaseModel):
    substance: str
    tank_volume_m3: float
    tank_diameter_m: float
    center_lat: float
    center_lon: float


class ComputeZoneDualRequest(BaseModel):
    facility_a: FacilityInput
    facility_b: FacilityInput
    wind_speed_kmh: float
    wind_dir_deg: float
    humidity_pct: float
    hazard_type: str = "both"


@router.post("/api/compute-zone-dual")
def compute_zone_dual_endpoint(payload: ComputeZoneDualRequest, request: Request):
    client_id = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_id):
        return JSONResponse(
            status_code=429, content={"error": "Too many requests -- please slow down."}
        )

    wind_dir_deg = validate_wind_direction(payload.wind_dir_deg)

    # Validate BOTH facilities through the EXISTING, unmodified validator -- called twice.
    errors = []
    for label, f in [("facility_a", payload.facility_a), ("facility_b", payload.facility_b)]:
        errors.extend(
            f"{label}: {e}"
            for e in validate_inputs(
                f.substance,
                f.tank_volume_m3,
                f.tank_diameter_m,
                payload.wind_speed_kmh,
                payload.humidity_pct,
            )
        )
        errors.extend(
            f"{label}: {e}"
            for e in validate_facility_coordinates(f.center_lat, f.center_lon)
        )

    # Guard the same way the single-facility route does: an unrecognised
    # hazard_type would otherwise yield a result with no hazard sections.
    if payload.hazard_type not in HAZARD_TYPES:
        errors.append(
            f"hazard_type must be one of: {', '.join(HAZARD_TYPES)}, "
            f"got '{payload.hazard_type}'."
        )

    if errors:
        return JSONResponse(status_code=400, content={"errors": errors})

    # CRITICAL: two COMPLETELY INDEPENDENT calls into the existing, unmodified
    # Module 1 + 2 pipeline. Facility B's OWN substance/volume/diameter must
    # drive its OWN zone here -- this is not the same computation run twice
    # with the same inputs, it's two genuinely different computations if the
    # two facilities have different configs.
    zones_a = compute_zone(
        payload.facility_a.substance,
        payload.facility_a.tank_volume_m3,
        payload.facility_a.tank_diameter_m,
        payload.wind_speed_kmh,
        payload.humidity_pct,
        payload.hazard_type,
    )
    warped_a = compute_warped_zones(
        zones_a,
        wind_dir_deg,
        payload.wind_speed_kmh,
        payload.facility_a.center_lat,
        payload.facility_a.center_lon,
    )

    zones_b = compute_zone(
        payload.facility_b.substance,
        payload.facility_b.tank_volume_m3,
        payload.facility_b.tank_diameter_m,
        payload.wind_speed_kmh,
        payload.humidity_pct,
        payload.hazard_type,
    )
    warped_b = compute_warped_zones(
        zones_b,
        wind_dir_deg,
        payload.wind_speed_kmh,
        payload.facility_b.center_lat,
        payload.facility_b.center_lon,
    )

    center_a = {"lat": payload.facility_a.center_lat, "lng": payload.facility_a.center_lon}
    center_b = {"lat": payload.facility_b.center_lat, "lng": payload.facility_b.center_lon}

    # Both joint analyses are thermal-based. A blast-only request carries no
    # thermal bands, so they are skipped rather than raising -- reported
    # explicitly instead of silently returning an empty result.
    has_thermal = bool(warped_a.get("thermal")) and bool(warped_b.get("thermal"))

    if has_thermal:
        joint_safe_approach = compute_joint_safe_approach(
            center_a,
            warped_a["thermal"]["bands"],
            center_b,
            warped_b["thermal"]["bands"],
        )
        cross_exposure = check_cross_facility_exposure(
            warped_a, center_a, warped_b, center_b
        )
        joint_note = None
    else:
        joint_safe_approach = None
        cross_exposure = []
        joint_note = (
            "hazard_type excludes thermal, so no joint safe-approach or "
            "cross-facility exposure check was possible."
        )

    return {
        "facility_a": warped_a,
        "facility_b": warped_b,
        "joint_safe_approach": joint_safe_approach,
        "cross_facility_exposure": cross_exposure,
        "joint_analysis_note": joint_note,
        "sources": warped_a["sources"]
        + [
            "Conservative-maximum joint safe-approach (multi-facility extension)",
            "Cross-facility thermal exposure check (multi-facility extension)",
        ],
    }
