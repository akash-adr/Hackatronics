from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_all_tables
from routes.test import router as test_router
from api.routes_compute_zone import router as compute_zone_router
from api.routes_config import router as config_router
from api.routes_escalation import router as escalation_router
from api.routes_compute_zone_dual import router as compute_zone_dual_router

app = FastAPI(title="DER-02 Backend")

# CORS: an explicit allow-list, never a wildcard. The dev frontend proxies
# /api through Vite, so it is same-origin in practice; this list covers direct
# browser access to the backend during development.
# allow_credentials is off: the API is stateless and uses no cookies or auth
# headers, so there is nothing to send.
ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server default
    "http://localhost:5174",  # Vite's fallback when 5173 is taken
    "http://localhost:3000",  # common alternative dev port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_all_tables()

# Include routers
app.include_router(test_router)
app.include_router(compute_zone_router)
app.include_router(config_router)
app.include_router(escalation_router)
app.include_router(compute_zone_dual_router)
