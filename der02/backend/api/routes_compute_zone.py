"""
Threat-zone computation endpoint.

This layer only translates HTTP to the engines and back: parse the body,
normalise the wind bearing, validate, delegate. No physics and no geometry is
done here, and nothing is persisted.

Module 2 deliberately has no endpoint of its own -- it extends this same
response, so the frontend makes one call and receives fully-processed zones
with polygons already attached.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from geometry.engine import compute_warped_zones
from physics.engine import HAZARD_TYPES, compute_zone, normalize_wind_dir, validate_inputs
from safe_approach.engine import compute_safe_approach_for_response

router = APIRouter()

# Coordinate bounds are checked here rather than inside Module 1's
# validate_inputs(). Module 1 is frozen, and its validator covers the physics
# inputs only -- latitude and longitude are map concerns introduced by Module
# 2, so they are validated at the boundary that introduces them. The errors
# they produce are appended to the same list and returned in the same 400
# shape, so callers see one consistent error contract.
MIN_LAT, MAX_LAT = -90, 90
MIN_LON, MAX_LON = -180, 180


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
def compute_zone_endpoint(request: ComputeZoneRequest):
    """
    Compute wind-warped thermal and/or blast threat zones for a scenario.

    Returns 400 with {"errors": [...]} if any input is out of range, and the
    fully-warped Module 2 result otherwise.
    """
    # A bearing is always valid, just possibly unwrapped. Normalised here so
    # every downstream consumer sees a value in [0, 360).
    wind_dir_deg = normalize_wind_dir(request.wind_dir_deg)

    errors = validate_inputs(
        request.substance,
        request.tank_volume_m3,
        request.tank_diameter_m,
        request.wind_speed_kmh,
        request.humidity_pct,
    )

    # hazard_type is not part of validate_inputs' contract, but an unrecognised
    # value would otherwise yield a result with neither hazard section -- a
    # silently empty answer. Reported alongside the other input errors.
    if request.hazard_type not in HAZARD_TYPES:
        errors.append(
            f"hazard_type must be one of: {', '.join(HAZARD_TYPES)}, "
            f"got '{request.hazard_type}'."
        )

    if not MIN_LAT <= request.center_lat <= MAX_LAT:
        errors.append(
            f"center_lat must be between {MIN_LAT} and {MAX_LAT}, "
            f"got {request.center_lat}."
        )

    if not MIN_LON <= request.center_lon <= MAX_LON:
        errors.append(
            f"center_lon must be between {MIN_LON} and {MAX_LON}, "
            f"got {request.center_lon}."
        )

    if errors:
        # Never hand invalid input to the engines.
        return JSONResponse(status_code=400, content={"errors": errors})

    # Module 1: how far does each severity threshold reach, with no wind.
    zones = compute_zone(
        request.substance,
        request.tank_volume_m3,
        request.tank_diameter_m,
        request.wind_speed_kmh,
        request.humidity_pct,
        request.hazard_type,
    )

    # Module 2: which direction is worse. Purely geometric -- no physics is
    # recomputed here. The warped result is what the frontend receives; the
    # raw Module 1 output is never returned on its own.
    warped = compute_warped_zones(
        zones,
        wind_from_deg=wind_dir_deg,
        wind_speed_kmh=request.wind_speed_kmh,
        center_lat=request.center_lat,
        center_lon=request.center_lon,
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
