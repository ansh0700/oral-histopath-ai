import os
import uuid
import shutil
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
import numpy as np

from app.config import UPLOADS_DIR, DATASETS_DIR
from app.schemas.responses import ImageUploadResponse

router = APIRouter(prefix="/api", tags=["upload"])

def _get_image_metadata(img_path: Path) -> Dict[str, Any]:
    with Image.open(img_path) as img:
        w, h = img.size
        mode = img.mode
        channels = len(mode)
        fmt = img.format or img_path.suffix.lstrip(".").upper()
    return {
        "width": w,
        "height": h,
        "mode": mode,
        "channels": channels,
        "format": fmt,
        "file_size_bytes": img_path.stat().st_size
    }

@router.post("/upload", response_model=ImageUploadResponse)
async def upload_image(file: UploadFile = File(...)):
    allowed_exts = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}
    ext = Path(file.filename or "image.png").suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(allowed_exts)}")

    image_id = f"img_{uuid.uuid4().hex[:12]}"
    filename = f"{image_id}{ext}"
    target_path = UPLOADS_DIR / filename

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        meta = _get_image_metadata(target_path)
    except Exception as e:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Invalid or corrupted image file: {str(e)}")

    # Generate thumbnail
    thumb_name = f"thumb_{image_id}.png"
    thumb_path = UPLOADS_DIR / thumb_name
    try:
        with Image.open(target_path) as img:
            img.thumbnail((256, 256))
            img.convert("RGB").save(thumb_path, "PNG")
        thumb_url = f"/uploads/{thumb_name}"
    except Exception:
        thumb_url = None

    return ImageUploadResponse(
        success=True,
        image_id=image_id,
        filename=filename,
        width=meta["width"],
        height=meta["height"],
        channels=meta["channels"],
        url=f"/uploads/{filename}",
        thumbnail_url=thumb_url,
        is_sample=False,
        metadata=meta
    )

@router.get("/samples", response_model=List[ImageUploadResponse])
async def get_sample_datasets():
    """
    Returns curated histopathology slides from the reference OPMD/OSCC dataset.
    """
    samples_info = [
        {
            "id": "sample_pdf_hyperchromasia",
            "file": "pdf_page4_img4_1447x975.png",
            "gt": None,
            "name": "OPMD: Nuclear Hyperchromasia",
            "description": "Increased DNA content and chromatin condensation; prominent hematoxylin absorption in dysplastic nuclei."
        },
        {
            "id": "sample_pdf_anisocytosis",
            "file": "pdf_page4_img1_1454x836.png",
            "gt": None,
            "name": "OPMD: Abnormal Cell Size (Anisocytosis)",
            "description": "Marked cell-to-cell variation in cell diameter and cytoplasmic volume indicating altered maturation."
        },
        {
            "id": "sample_pdf_keratinisation",
            "file": "pdf_page10_img1_1104x741.png",
            "gt": None,
            "name": "OPMD / OSCC: Single Cell Keratinisation",
            "description": "Premature intense eosinophilic cytoplasmic keratin production within intraepithelial strata."
        },
        {
            "id": "sample_pdf_nuclear_size",
            "file": "pdf_page5_img1_1454x978.png",
            "gt": None,
            "name": "OPMD: Abnormal Nuclear Size (Macronuclei)",
            "description": "Marked anisonucleosis with elevated nuclear-to-cytoplasmic (N:C) ratio."
        },
        {
            "id": "sample_pdf_nuclear_shape",
            "file": "pdf_page11_img1_935x629.png",
            "gt": None,
            "name": "OPMD / OSCC: Nuclear Shape Pleomorphism",
            "description": "Irregular, angulated, and bizarre nuclear membrane contours."
        },
        {
            "id": "sample_pdf_nucleoli",
            "file": "pdf_page8_img1_1030x601.png",
            "gt": None,
            "name": "OPMD / OSCC: Prominent & Multiple Nucleoli",
            "description": "Prominent, enlarged, or spiked nucleoli within dysplastic nuclei reflecting heightened ribosome biogenesis."
        },
        {
            "id": "sample_pdf_mitotic_figures",
            "file": "pdf_page9_img1_967x571.png",
            "gt": None,
            "name": "OPMD / OSCC: Mitotic Figures (MFs)",
            "description": "Active mitotic chromosomes reflecting rapid cellular proliferation in epithelial layers."
        },
        {
            "id": "sample_pdf_atypical_mitosis",
            "file": "pdf_page7_img1_810x536.png",
            "gt": None,
            "name": "OSCC: Atypical Mitotic Figures (AMFs)",
            "description": "Multipolar, tripolar, and asymmetric spindle divisions specific for malignant transformation."
        },
        {
            "id": "sample_pdf_multinucleation",
            "file": "pdf_page5_img4_1451x975.png",
            "gt": None,
            "name": "OSCC: Multinucleation",
            "description": "Multiple nuclei resulting from failed cytokinesis and severe chromosomal instability."
        },
        {
            "id": "sample_pdf_spindle_tadpole",
            "file": "pdf_page6_img4_1073x1427.png",
            "gt": None,
            "name": "OSCC: Tadpole and Spindle Cells",
            "description": "Bizarre elongated spindle cell morphology indicating epithelial-mesenchymal transition (EMT)."
        },
        {
            "id": "sample_pdf_normal_mucosa",
            "file": "pdf_page2_img1_1354x904.png",
            "gt": None,
            "name": "Normal Oral Epithelium (Reference Standard)",
            "description": "Normal stratified squamous epithelium with uniform small basal nuclei and orderly maturation."
        },
        {
            "id": "sample_opmd_dysplasia",
            "file": "opmd_dysplasia_sample.png",
            "gt": "opmd_dysplasia_sample_gt.png",
            "name": "Synthetic OPMD with Pathologist Ground Truth",
            "description": "Calibrated oral epithelial dysplasia field with verified ground-truth nuclear masks."
        }
    ]

    responses = []
    for s in samples_info:
        img_path = DATASETS_DIR / s["file"]
        if img_path.exists():
            meta = _get_image_metadata(img_path)
            meta["clinical_context"] = s["name"]
            meta["pathology_notes"] = s["description"]
            
            gt_url = f"/datasets/{s['gt']}" if (s.get("gt") and (DATASETS_DIR / s["gt"]).exists()) else None
            
            responses.append(ImageUploadResponse(
                success=True,
                image_id=s["id"],
                filename=s["file"],
                width=meta["width"],
                height=meta["height"],
                channels=meta["channels"],
                url=f"/datasets/{s['file']}",
                thumbnail_url=f"/datasets/{s['file']}",
                is_sample=True,
                ground_truth_url=gt_url,
                metadata=meta
            ))
    return responses

@router.delete("/image/{image_id}")
async def delete_image(image_id: str):
    found = False
    for p in UPLOADS_DIR.glob(f"*{image_id}*"):
        try:
            p.unlink(missing_ok=True)
            found = True
        except Exception:
            pass
    return {"success": found, "message": f"Image {image_id} deleted."}
