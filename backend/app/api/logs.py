from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

from app.services.research_logger import ResearchLogger

router = APIRouter(prefix="/api", tags=["logs"])

@router.get("/logs", response_model=List[Dict[str, Any]])
async def get_all_logs(limit: int = 50):
    return ResearchLogger.get_experiment_logs(limit=limit)

@router.get("/logs/{exp_id}")
async def get_log_by_id(exp_id: str):
    log = ResearchLogger.get_experiment_by_id(exp_id)
    if not log:
        raise HTTPException(status_code=404, detail="Experiment log not found")
    return log
