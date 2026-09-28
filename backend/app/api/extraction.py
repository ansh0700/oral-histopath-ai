from fastapi import APIRouter, HTTPException

from app.schemas.requests import ExtractionRequest
from app.schemas.responses import ExtractionResponse
from app.services.segmentation_service import SegmentationService
from app.services.preprocessing import base64_to_numpy_mask
from app.services.extraction_service import ExtractionService
from app.services.research_logger import ResearchLogger

router = APIRouter(prefix="/api", tags=["extraction"])

@router.post("/extract", response_model=ExtractionResponse)
async def extract_region(req: ExtractionRequest):
    """
    Extracts the selected region from the ORIGINAL COLOR H&E image:
    1. OUTPUT 1: Original Color H&E Bounding Box Crop.
    2. OUTPUT 2: Original Color Object Cutout (transparent non-mask pixels).
    """
    try:
        image_rgb, _ = SegmentationService.load_image_rgb(req.image_id)
        h, w = image_rgb.shape[:2]

        mask = base64_to_numpy_mask(req.mask, (h, w))

        extracted = ExtractionService.extract_region(
            image_rgb=image_rgb,
            mask=mask,
            image_id=req.image_id,
            padding_percent=req.padding_percent or 0.05
        )

        ResearchLogger.log_experiment({
            "action": "extract_region",
            "image_id": req.image_id,
            "bbox": extracted["bbox"],
            "area_pixels": extracted["area_pixels"],
            "crop_url": extracted["crop_url"],
            "cutout_url": extracted["cutout_url"]
        })

        return ExtractionResponse(
            success=True,
            crop_url=extracted["crop_url"],
            cutout_url=extracted["cutout_url"],
            crop_base64=extracted.get("crop_base64"),
            cutout_base64=extracted.get("cutout_base64"),
            bbox=extracted["bbox"],
            width=extracted["width"],
            height=extracted["height"],
            area_pixels=extracted["area_pixels"]
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction error: {str(e)}")
