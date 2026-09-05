"""
Threat-zone computation endpoint.

This layer only translates HTTP to the engines and back: rate-limit, parse,
normalise the wind bearing, validate, delegate. No physics and no geometry is
done here, and nothing is persisted.

Module 2 deliberately has no endpoint of its own -- it extends this same
response, so the frontend makes one call and receives fully-processed zones
with polygons already attached.

Every input check goes through backend/validation.py, which is the single
place the API's validation surface is defined.
"""

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from geometry.engine import compute_warped_zones
from physics.engine import compute_zone
from rate_limiter import check_rate_limit
from safe_approach.engine import compute_safe_approach_for_response
from validation import (
    HAZARD_TYPES,
    validate_facility_coordinates,
    validate_inputs,
    validate_wind_direction,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class ComputeZoneRequest(BaseModel):
    substance: str
    tank_volume_m3: float
    tank_diameter_m: float
    wind_speed_kmh: float
    wind_dir_deg: float
    # Accepted for forward compatibility with later modules; Module 1's
    # correlations have no temperature dependence, so it is ignored here.
    ambient_temp_c: float | None = None
    humidity_pct: float
    hazard_type: str
    # Facility location, required by Module 2 to place the polygons on a map.
    center_lat: float
    center_lon: float


@router.post("/api/compute-zone")
def compute_zone_endpoint(payload: ComputeZoneRequest, request: Request):
    """
    Compute wind-warped thermal and/or blast threat zones for a scenario.

    Returns 429 when the caller is over its request budget, 400 with
    {"errors": [...]} if any input is out of range, and the fully-warped
    Module 2 + 3 result otherwise.
    """
    # Rate limit FIRST: a client that is over budget costs nothing beyond this
    # check -- no parsing, no validation, no computation.
    client_id = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_id):
        logger.warning("Rate limit exceeded on /api/compute-zone by %s", client_id)
        return JSONResponse(
            status_code=429,
            content={"error": "Too many requests -- please slow down."},
        )

    # A bearing is always valid, just possibly unwrapped. Normalised exactly
    # once, here at the boundary, so everything downstream sees [0, 360).
    wind_dir_deg = validate_wind_direction(payload.wind_dir_deg)

    errors = validate_inputs(
        payload.substance,
        payload.tank_volume_m3,
        payload.tank_diameter_m,
        payload.wind_speed_kmh,
        payload.humidity_pct,
    )

    # hazard_type is not part of validate_inputs' contract, but an unrecognised
    # value would otherwise yield a result with neither hazard section -- a
    # silently empty answer. Reported alongside the other input errors.
    if payload.hazard_type not in HAZARD_TYPES:
        errors.append(
            f"hazard_type must be one of: {', '.join(HAZARD_TYPES)}, "
            f"got '{payload.hazard_type}'."
        )

    # Coordinates are checked before they reach Module 2's polygon builder.
    errors.extend(validate_facility_coordinates(payload.center_lat, payload.center_lon))

    if errors:
        # Log the endpoint and the identifying inputs needed to reproduce the
        # failure -- deliberately NOT the whole request body.
        logger.info(
            "Rejected /api/compute-zone: substance=%s hazard_type=%s errors=%s",
            payload.substance,
            payload.hazard_type,
            errors,
        )
        # Never hand invalid input to the engines.
        return JSONResponse(status_code=400, content={"errors": errors})

    # Module 1: how far does each severity threshold reach, with no wind.
    zones = compute_zone(
        payload.substance,
        payload.tank_volume_m3,
        payload.tank_diameter_m,
        payload.wind_speed_kmh,
        payload.humidity_pct,
        payload.hazard_type,
    )

    # Module 2: which direction is worse. Purely geometric -- no physics is
    # recomputed here. The warped result is what the frontend receives; the
    # raw Module 1 output is never returned on its own.
    warped = compute_warped_zones(
        zones,
        wind_from_deg=wind_dir_deg,
        wind_speed_kmh=payload.wind_speed_kmh,
        center_lat=payload.center_lat,
        center_lon=payload.center_lon,
    )

    # Module 3: where to approach from, derived from the per-angle radii
    # Module 2 already produced. Returns None when every band is clipped.
    safe_approach = compute_safe_approach_for_response(warped)

    # Chosen behaviour when no trustworthy band exists: keep the key present
    # and set it to null, and say why in a sibling field. The key never
    # disappears, so the frontend can render "no recommendation available"
    # from a stable contract instead of inferring silence from a missing key.
    warped["safe_approach"] = safe_approach
    if safe_approach is None:
        warped["safe_approach_unavailable_reason"] = (
            "Every hazard band was clipped at the solver's search boundary, so "
            "no radius is trustworthy enough to base an approach bearing on."
        )

    warped["sources"] = warped["sources"] + [
        "Maximum-clearance ray sampling for safe approach bearing (Module 3)"
    ]

    return warped
