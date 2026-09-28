from fastapi import APIRouter, HTTPException

from app.schemas.requests import AnalysisRequest
from app.schemas.responses import AnalysisResponse
from app.services.segmentation_service import SegmentationService
from app.services.preprocessing import base64_to_numpy_mask
from app.services.morphology_service import MorphologyService
from app.services.explanation_service import ExplanationService
from app.services.research_logger import ResearchLogger

router = APIRouter(prefix="/api", tags=["analysis"])

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_region(req: AnalysisRequest):
    """
    Computes morphological measurements, rule-grounded feature categorization,
    and grounded educational explanations.
    """
    try:
        image_rgb, _ = SegmentationService.load_image_rgb(req.image_id)
        h, w = image_rgb.shape[:2]

        mask = base64_to_numpy_mask(req.mask, (h, w))

        analysis = MorphologyService.analyze_region(
            image_rgb=image_rgb,
            mask=mask,
            microns_per_pixel=req.microns_per_pixel or 0.5
        )

        measurements = analysis["measurements"]
        feature = analysis["feature"]
        category = analysis["feature_category"]
        confidence = analysis["confidence"] or req.confidence

        explanation = ExplanationService.generate_explanation(
            feature=feature,
            measurements=measurements,
            model_name=req.model or "AI Segmentation Model",
            confidence=confidence
        )

        ResearchLogger.log_experiment({
            "action": "analyze_region",
            "image_id": req.image_id,
            "model": req.model,
            "feature": feature,
            "category": category,
            "area_pixels": measurements.area_pixels,
            "area_microns_sq": measurements.area_microns_sq,
            "circularity": measurements.circularity,
            "od_hematoxylin": measurements.hematoxylin_optical_density
        })

        return AnalysisResponse(
            success=True,
            model=req.model or "ScribblePrompt",
            feature=feature,
            feature_category=category,
            confidence=confidence,
            measurements=measurements,
            explanation=explanation,
            medical_disclaimer="Research/Educational Prototype — Not a Clinical Diagnostic Tool. AI-assisted observation — not a standalone clinical diagnosis."
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")
