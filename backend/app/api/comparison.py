from typing import List
from fastapi import APIRouter, HTTPException
import numpy as np

from app.schemas.requests import ModelComparisonRequest
from app.schemas.responses import ModelComparisonResponse, SingleModelComparisonResult
from app.models.model_registry import model_registry
from app.services.segmentation_service import SegmentationService
from app.services.preprocessing import base64_to_numpy_mask
from app.services.extraction_service import ExtractionService
from app.services.evaluation_service import EvaluationService
from app.services.research_logger import ResearchLogger

router = APIRouter(prefix="/api", tags=["comparison"])

@router.post("/compare", response_model=ModelComparisonResponse)
async def compare_models(req: ModelComparisonRequest):
    """
    Runs the exact same region / brush prompt across candidate AI models.
    Preserves original colors in extracted crops and computes genuine metrics.
    Only executes for genuinely ready models.
    """
    try:
        image_rgb, _ = SegmentationService.load_image_rgb(req.image_id)
        h, w = image_rgb.shape[:2]

        pos_mask = base64_to_numpy_mask(req.positive_scribble, (h, w)) if req.positive_scribble else None
        neg_mask = base64_to_numpy_mask(req.negative_scribble, (h, w)) if req.negative_scribble else None
        gt_mask = base64_to_numpy_mask(req.ground_truth_mask, (h, w)) if req.ground_truth_mask else None
        gt_available = (gt_mask is not None and np.count_nonzero(gt_mask) > 0)

        # Get all models in registry
        all_models = model_registry.list_models(active_only=False)
        ready_models = [m for m in all_models if m.get("status") == "READY"]

        if len(ready_models) < 2:
            return ModelComparisonResponse(
                success=False,
                image_id=req.image_id,
                results=[],
                ground_truth_available=False,
                evaluation_summary="Multi-model comparison is unavailable: Only one model (ScribblePrompt) is currently loaded with neural weights. Additional models (PathoSAM, MedSAM, VISTA-PATH, CellViT, HoVer-Net) require official pretrained checkpoints."
            )

        target_model_ids = req.models or [m["id"] for m in ready_models]
        results: List[SingleModelComparisonResult] = []

        for m_id in target_model_ids:
            model = model_registry.get_model(m_id)
            if not model or model.status != "READY":
                continue

            try:
                pred = model.predict(
                    image_rgb=image_rgb,
                    positive_scribble=pos_mask,
                    negative_scribble=neg_mask,
                    points=req.points,
                    bbox=req.bbox
                )
                pred_mask = pred["mask"]
                
                extracted = ExtractionService.extract_region(
                    image_rgb=image_rgb,
                    mask=pred_mask,
                    image_id=f"{req.image_id}_{m_id}"
                )

                dice, iou, prec, rec, f1 = None, None, None, None, None
                if gt_available:
                    eval_metrics = EvaluationService.calculate_metrics(pred_mask, gt_mask)
                    dice = eval_metrics["dice"]
                    iou = eval_metrics["iou"]
                    prec = eval_metrics["precision"]
                    rec = eval_metrics["recall"]
                    f1 = eval_metrics["f1_score"]

                results.append(SingleModelComparisonResult(
                    model_id=m_id,
                    model_name=model.name,
                    status="READY",
                    inference_time_ms=pred["inference_time_ms"],
                    supported_prompt_used="Scribble Brush" if model.supports_scribble_prompt else "Point/Box Conversion",
                    mask_url=extracted["cutout_url"],
                    crop_url=extracted["crop_url"],
                    cutout_url=extracted["cutout_url"],
                    bbox=pred["bbox"],
                    confidence=pred.get("confidence"),
                    dice=dice,
                    iou=iou,
                    precision=prec,
                    recall=rec,
                    f1=f1,
                    notes="Real inference executed successfully."
                ))
            except Exception as e:
                results.append(SingleModelComparisonResult(
                    model_id=m_id,
                    model_name=model.name,
                    status="ERROR",
                    inference_time_ms=None,
                    supported_prompt_used="Error during prediction",
                    notes=f"Execution error: {str(e)}"
                ))

        summary = None
        if not gt_available:
            summary = "Ground truth unavailable — quantitative segmentation metrics (Dice, IoU) cannot be calculated without reference masks."

        ResearchLogger.log_experiment({
            "action": "compare_models",
            "image_id": req.image_id,
            "models_tested": target_model_ids,
            "gt_available": gt_available
        })

        return ModelComparisonResponse(
            success=True,
            image_id=req.image_id,
            results=results,
            ground_truth_available=gt_available,
            evaluation_summary=summary
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison error: {str(e)}")
