"""
AI safety-suggestion endpoint.

New file; no existing route is touched. The browser never sees the Gemini key
-- it posts the scenario here and this process makes the upstream call.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ai_suggestions import generate_safety_suggestion_cached
from rate_limiter import AI_RATE_LIMIT_PER_SECOND, check_rate_limit

router = APIRouter()


class SuggestionRequest(BaseModel):
    substance: str
    tank_volume_m3: float
    tank_diameter_m: float
    wind_speed_kmh: float
    wind_dir_deg: float
    humidity_pct: float
    threat_level: str
    fatal_radius_m: float | None = None
    safe_approach_bearing_deg: float | None = None
    safe_approach_standoff_m: float | None = None


@router.post("/api/ai-suggestion")
def ai_suggestion_endpoint(payload: SuggestionRequest, request: Request):
    client_id = request.client.host if request.client else "unknown"

    # A STRICTER budget than the compute endpoint, and a SEPARATE bucket: this
    # one spends money per call, so the "ai-" prefix keeps hammering it from
    # exhausting a client's compute allowance, and vice versa.
    if not check_rate_limit(f"ai-{client_id}", limit=AI_RATE_LIMIT_PER_SECOND):
        return JSONResponse(
            status_code=429, content={"error": "Too many requests -- please slow down."}
        )

    suggestion = generate_safety_suggestion_cached(payload.model_dump())
    return {"suggestion": suggestion}
