from fastapi import APIRouter, HTTPException

from app.schemas.requests import SegmentationRequest, RefinementRequest
from app.schemas.responses import SegmentationResponse
from app.services.segmentation_service import SegmentationService
from app.services.research_logger import ResearchLogger

router = APIRouter(prefix="/api", tags=["segmentation"])

@router.post("/segment", response_model=SegmentationResponse)
async def segment_image(req: SegmentationRequest):
    """
    Runs user-controlled segmentation (Strict Brush Mode or Exact Brush Mode).
    Constrains AI refinement strictly to the user's painted ROI without expanding to neighboring cells.
    """
    try:
        res = SegmentationService.run_segmentation(
            image_id=req.image_id,
            model_id=req.model,
            mode=req.mode or "strict",
            roi_padding=req.roi_padding if req.roi_padding is not None else 20,
            max_expansion_ratio=req.max_expansion_ratio if req.max_expansion_ratio is not None else 0.20,
            positive_scribble_b64=req.positive_scribble,
            negative_scribble_b64=req.negative_scribble,
            previous_mask_b64=req.previous_mask,
            points=req.points,
            bbox=req.bbox,
            roi_bbox=req.roi_bbox
        )

        ResearchLogger.log_experiment({
            "action": "segment",
            "image_id": req.image_id,
            "model": req.model,
            "mode": req.mode or "strict",
            "roi_padding": req.roi_padding,
            "user_brush_area": res.get("user_brush_area"),
            "ai_suggested_area": res.get("ai_suggested_area"),
            "expansion_ratio": res.get("expansion_ratio"),
            "inference_time_ms": res["inference_time_ms"],
            "confidence": res.get("confidence")
        })

        return SegmentationResponse(
            success=True,
            model=res["model"],
            mode_used=res.get("mode_used", "strict"),
            mask=res["mask"],
            contour=res.get("contour"),
            bbox=res["bbox"],
            user_brush_area=res.get("user_brush_area"),
            ai_suggested_area=res.get("ai_suggested_area"),
            expansion_ratio=res.get("expansion_ratio"),
            expansion_warning=res.get("expansion_warning"),
            confidence=res.get("confidence"),
            inference_time_ms=res["inference_time_ms"],
            message="Segmentation completed successfully."
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@router.post("/refine", response_model=SegmentationResponse)
async def refine_segmentation(req: RefinementRequest):
    """
    Iterative refinement endpoint incorporating ADD/ERASE corrections with strict local boundary confinement.
    """
    try:
        res = SegmentationService.run_refinement(
            image_id=req.image_id,
            model_id=req.model,
            current_mask_b64=req.current_mask,
            mode=req.mode or "strict",
            roi_padding=req.roi_padding if req.roi_padding is not None else 20,
            max_expansion_ratio=req.max_expansion_ratio if req.max_expansion_ratio is not None else 0.20,
            add_scribble_b64=req.add_scribble,
            erase_scribble_b64=req.erase_scribble,
            previous_mask_b64=req.previous_mask
        )

        ResearchLogger.log_experiment({
            "action": "refine",
            "image_id": req.image_id,
            "model": req.model,
            "mode": req.mode or "strict",
            "inference_time_ms": res["inference_time_ms"],
            "confidence": res.get("confidence")
        })

        return SegmentationResponse(
            success=True,
            model=res["model"],
            mode_used=res.get("mode_used", "strict"),
            mask=res["mask"],
            contour=res.get("contour"),
            bbox=res["bbox"],
            user_brush_area=res.get("user_brush_area"),
            ai_suggested_area=res.get("ai_suggested_area"),
            expansion_ratio=res.get("expansion_ratio"),
            expansion_warning=res.get("expansion_warning"),
            confidence=res.get("confidence"),
            inference_time_ms=res["inference_time_ms"],
            message="Refinement completed successfully."
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
