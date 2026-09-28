from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

from app.models.model_registry import model_registry
from app.schemas.requests import ModelConfigRequest
from app.schemas.responses import ModelCapabilityResponse

router = APIRouter(prefix="/api", tags=["models"])

@router.get("/models", response_model=List[ModelCapabilityResponse])
async def list_available_models():
    """
    Returns all registered candidate models with explicit capability declarations and honest status.
    """
    models = model_registry.list_models()
    return models

@router.post("/models/test")
async def test_model(data: Dict[str, str]):
    model_id = data.get("model_id")
    if not model_id:
        raise HTTPException(status_code=400, detail="Missing 'model_id'")
    res = model_registry.test_model(model_id)
    return res

@router.post("/models/configure")
async def configure_model(req: ModelConfigRequest):
    res = model_registry.configure_model(
        model_id=req.model_id,
        enabled=req.enabled,
        checkpoint=req.checkpoint,
        device=req.device or "cpu"
    )
    return res
