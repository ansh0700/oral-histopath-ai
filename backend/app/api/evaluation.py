from fastapi import APIRouter, HTTPException

from app.schemas.requests import EvaluationRequest
from app.schemas.responses import EvaluationMetricsResponse
from app.services.preprocessing import base64_to_numpy_mask
from app.services.evaluation_service import EvaluationService

router = APIRouter(prefix="/api", tags=["evaluation"])

@router.post("/evaluate", response_model=EvaluationMetricsResponse)
async def evaluate_masks(req: EvaluationRequest):
    """
    Evaluates a predicted segmentation mask against a ground truth mask.
    Calculates Dice, IoU, Precision, Recall, F1 Score, and Boundary F1.
    """
    try:
        p_mask = base64_to_numpy_mask(req.predicted_mask)
        g_mask = base64_to_numpy_mask(req.ground_truth_mask)

        metrics = EvaluationService.calculate_metrics(p_mask, g_mask)
        return EvaluationMetricsResponse(**metrics)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Evaluation error: {str(e)}")
