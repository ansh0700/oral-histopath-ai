import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import UPLOADS_DIR, RESULTS_DIR, DATASETS_DIR
from app.models.model_registry import model_registry
from app.api.upload import router as upload_router
from app.api.models import router as models_router
from app.api.segmentation import router as segmentation_router
from app.api.extraction import router as extraction_router
from app.api.analysis import router as analysis_router
from app.api.comparison import router as comparison_router
from app.api.evaluation import router as evaluation_router
from app.api.logs import router as logs_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize registered models on startup
    model_registry.initialize()
    yield

app = FastAPI(
    title="Oral Histopathology AI Analyzer API",
    description="Research & Educational Prototype for Interactive OPMD/OSCC Histopathology Segmentation & Analysis",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for local frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static asset directories
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/results", StaticFiles(directory=str(RESULTS_DIR)), name="results")
app.mount("/datasets", StaticFiles(directory=str(DATASETS_DIR)), name="datasets")

# Include API Routers
app.include_router(upload_router)
app.include_router(models_router)
app.include_router(segmentation_router)
app.include_router(extraction_router)
app.include_router(analysis_router)
app.include_router(comparison_router)
app.include_router(evaluation_router)
app.include_router(logs_router)

# Mount pre-built frontend SPA if present
from pathlib import Path
from fastapi.responses import FileResponse
FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST_DIR / "assets")), name="static_assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(FRONTEND_DIST_DIR / "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "name": "Oral Histopathology AI Analyzer API",
            "status": "online",
            "version": "1.0.0",
            "primary_model": "ScribblePrompt",
            "medical_safety_notice": "Research/Educational Prototype — Not a Clinical Diagnostic Tool."
        }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "models_count": len(model_registry.list_models()),
        "uploads_dir_exists": UPLOADS_DIR.exists(),
        "results_dir_exists": RESULTS_DIR.exists()
    }
