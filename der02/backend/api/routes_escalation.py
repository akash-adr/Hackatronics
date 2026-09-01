"""
Multi-tank domino / escalation detection endpoint.

Deliberately recomputes nothing. The caller supplies the compute-zone response
it already holds for the primary facility, and this endpoint only runs a
geometry containment check against those already-computed polygons -- keeping
the project's rule that no module repeats another's calculation.
"""

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from geometry.escalation import check_escalation_risk
from rate_limiter import check_rate_limit
from validation import validate_facility_coordinates, validate_second_facility_placement

logger = logging.getLogger(__name__)

router = APIRouter()


class EscalationRequest(BaseModel):
    # The full compute-zone response for the primary facility, which the
    # frontend already has cached. Passed through untouched.
    primary_result: dict
    second_lat: float
    second_lon: float
    # The primary facility's own coordinates. These are NOT present anywhere in
    # the compute-zone response (it returns thermal/blast/wind/safe_approach/
    # sources only), so the separation check cannot be performed without them.
    primary_lat: float
    primary_lon: float


@router.post("/api/check-escalation")
def check_escalation_endpoint(payload: EscalationRequest, request: Request):
    """
    Report whether a second facility falls inside the primary facility's
    thermal hazard bands.

    Returns 429 when over the request budget, 400 for invalid or degenerate
    placement, and the escalation result otherwise.
    """
    client_id = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_id):
        return JSONResponse(
            status_code=429,
            content={"error": "Too many requests -- please slow down."},
        )

    errors = validate_facility_coordinates(payload.second_lat, payload.second_lon)
    errors.extend(
        validate_second_facility_placement(
            payload.primary_lat,
            payload.primary_lon,
            payload.second_lat,
            payload.second_lon,
        )
    )

    if errors:
        logger.info("Rejected /api/check-escalation: errors=%s", errors)
        return JSONResponse(status_code=400, content={"errors": errors})

    thermal_bands = (payload.primary_result.get("thermal") or {}).get("bands") or []

    if not thermal_bands:
        # Nothing to test against -- a blast-only result carries no thermal
        # bands. Report honestly rather than implying safety.
        return {
            "at_risk": False,
            "band_label": None,
            "threshold_kw_m2": None,
            "message": None,
            "note": "No thermal bands in the supplied result, so no escalation check was possible.",
        }

    return check_escalation_risk(payload.second_lat, payload.second_lon, thermal_bands)
