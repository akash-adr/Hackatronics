from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_all_tables
from routes.test import router as test_router
from api.routes_compute_zone import router as compute_zone_router
from api.routes_config import router as config_router

app = FastAPI(title="DER-02 Backend")

# Setup CORS
origins = [
    "http://localhost:5173", # Vite dev server default
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_all_tables()

# Include routers
app.include_router(test_router)
app.include_router(compute_zone_router)
app.include_router(config_router)
