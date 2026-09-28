from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
import numpy as np
from PIL import Image
import cv2

from app.config import UPLOADS_DIR, DATASETS_DIR
from app.models.model_registry import model_registry
from app.services.preprocessing import base64_to_numpy_mask, numpy_mask_to_base64
from app.services.mask_editor import MaskEditor

# Fast in-memory cache for loaded RGB slide images to avoid redundant disk I/O
_IMAGE_CACHE: Dict[str, Tuple[np.ndarray, Path]] = {}

class SegmentationService:
    @staticmethod
    def load_image_rgb(image_id: str) -> Tuple[np.ndarray, Path]:
        """
        Locates and loads the original color H&E image by image_id (from uploads or datasets).
        Returns RGB numpy array (H, W, 3) and absolute file path, cached in-memory.
        """
        if image_id in _IMAGE_CACHE:
            arr, path = _IMAGE_CACHE[image_id]
            return arr.copy(), path

        # 1. Search uploads
        for p in UPLOADS_DIR.glob(f"{image_id}*"):
            if p.suffix.lower() in [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"]:
                with Image.open(p) as img:
                    arr = np.array(img.convert("RGB"))
                    _IMAGE_CACHE[image_id] = (arr, p)
                    return arr.copy(), p

        # 2. Search sample dataset mappings
        sample_map = {
            "sample_opmd_dysplasia": "opmd_dysplasia_sample.png",
            "sample_oscc_carcinoma": "oscc_carcinoma_sample.png",
            "sample_normal_mucosa": "normal_oral_mucosa_sample.png",
            "sample_pdf_hyperchromasia": "pdf_page4_img4_1447x975.png",
            "sample_pdf_anisocytosis": "pdf_page4_img1_1454x836.png",
            "sample_pdf_keratinisation": "pdf_page10_img1_1104x741.png",
            "sample_pdf_nuclear_size": "pdf_page5_img1_1454x978.png",
            "sample_pdf_nuclear_shape": "pdf_page11_img1_935x629.png",
            "sample_pdf_nucleoli": "pdf_page8_img1_1030x601.png",
            "sample_pdf_mitotic_figures": "pdf_page9_img1_967x571.png",
            "sample_pdf_atypical_mitosis": "pdf_page7_img1_810x536.png",
            "sample_pdf_multinucleation": "pdf_page5_img4_1451x975.png",
            "sample_pdf_spindle_tadpole": "pdf_page6_img4_1073x1427.png",
            "sample_pdf_normal_mucosa": "pdf_page2_img1_1354x904.png",
        }
        if image_id in sample_map:
            p = DATASETS_DIR / sample_map[image_id]
            if p.exists():
                with Image.open(p) as img:
                    arr = np.array(img.convert("RGB"))
                    _IMAGE_CACHE[image_id] = (arr, p)
                    return arr.copy(), p

        for p in DATASETS_DIR.glob(f"*{image_id}*"):
            if p.suffix.lower() in [".png", ".jpg", ".jpeg"]:
                with Image.open(p) as img:
                    arr = np.array(img.convert("RGB"))
                    _IMAGE_CACHE[image_id] = (arr, p)
                    return arr.copy(), p

        # Fallback for dynamic/local images missing from disk: return neutral RGB placeholder array
        placeholder_path = UPLOADS_DIR / f"{image_id}.png"
        arr = np.zeros((1000, 1000, 3), dtype=np.uint8)
        _IMAGE_CACHE[image_id] = (arr, placeholder_path)
        return arr.copy(), placeholder_path

    @staticmethod
    def run_segmentation(
        image_id: str,
        model_id: str = "scribbleprompt",
        mode: str = "strict",
        roi_padding: int = 20,
        max_expansion_ratio: float = 0.20,
        positive_scribble_b64: Optional[str] = None,
        negative_scribble_b64: Optional[str] = None,
        previous_mask_b64: Optional[str] = None,
        points: Optional[list] = None,
        bbox: Optional[list] = None,
        roi_bbox: Optional[list] = None
    ) -> Dict[str, Any]:
        image_rgb, _ = SegmentationService.load_image_rgb(image_id)
        h, w = image_rgb.shape[:2]

        pos_mask = base64_to_numpy_mask(positive_scribble_b64, (h, w)) if positive_scribble_b64 else np.zeros((h, w), dtype=np.uint8)
        neg_mask = base64_to_numpy_mask(negative_scribble_b64, (h, w)) if negative_scribble_b64 else np.zeros((h, w), dtype=np.uint8)
        prev_mask = base64_to_numpy_mask(previous_mask_b64, (h, w)) if previous_mask_b64 else None

        user_brush_area = int(np.count_nonzero(pos_mask))

        # 1. EXACT BRUSH MODE
        if mode == "exact":
            final_mask = pos_mask.copy()
            final_mask[neg_mask > 0] = 0
            contours = MaskEditor.extract_contours(final_mask)
            res_bbox = MaskEditor.get_bounding_box(final_mask)

            return {
                "success": True,
                "model": "Exact Brush Mode",
                "mode_used": "exact",
                "mask": numpy_mask_to_base64(final_mask),
                "contour": contours,
                "bbox": res_bbox,
                "user_brush_area": user_brush_area,
                "ai_suggested_area": int(np.count_nonzero(final_mask)),
                "expansion_ratio": 0.0,
                "expansion_warning": None,
                "confidence": 1.0,
                "inference_time_ms": 1.0,
                "mask_array": final_mask,
                "image_rgb": image_rgb
            }

        # 2. STRICT BRUSH MODE (Default)
        model = model_registry.get_model(model_id)
        if not model:
            raise ValueError(f"Unknown model identifier '{model_id}'")

        if model.status != "READY":
            model.load()

        # Compute Local ROI Constraint around user's brush
        coords = cv2.findNonZero((pos_mask > 0).astype(np.uint8))
        if coords is not None:
            bx, by, bw, bh = cv2.boundingRect(coords)
            pad = max(5, int(roi_padding))
            rx1 = max(0, bx - pad)
            ry1 = max(0, by - pad)
            rx2 = min(w, bx + bw + pad)
            ry2 = min(h, by + bh + pad)
            local_roi_bbox = [rx1, ry1, rx2, ry2]
        else:
            local_roi_bbox = [0, 0, w, h]

        # Execute model inference
        pred = model.predict(
            image_rgb=image_rgb,
            positive_scribble=pos_mask,
            negative_scribble=neg_mask,
            points=points,
            bbox=bbox or local_roi_bbox,
            previous_mask=prev_mask,
            roi_bbox=local_roi_bbox
        )

        raw_ai_mask = pred["mask"]

        # HARD SPATIAL CONSTRAINT: Mask is zeroed outside the local ROI
        constrained_mask = np.zeros((h, w), dtype=np.uint8)
        rx1, ry1, rx2, ry2 = local_roi_bbox
        constrained_mask[ry1:ry2, rx1:rx2] = raw_ai_mask[ry1:ry2, rx1:rx2]

        # Connected component filtering
        if user_brush_area > 0:
            num_labels, labels, stats, _ = cv2.connectedComponentsWithStats((constrained_mask > 0).astype(np.uint8))
            brush_overlap = (pos_mask > 0)
            filtered_mask = np.zeros_like(constrained_mask)
            for lab in range(1, num_labels):
                if np.any(brush_overlap & (labels == lab)):
                    filtered_mask[labels == lab] = 255
            if np.count_nonzero(filtered_mask) > 0:
                constrained_mask = filtered_mask

        if user_brush_area > 0:
            constrained_mask = np.maximum(constrained_mask, pos_mask)

        # HARD NEGATIVE EXCLUSION
        constrained_mask[neg_mask > 0] = 0

        final_mask = constrained_mask
        ai_suggested_area = int(np.count_nonzero(final_mask))

        expansion_ratio = 0.0
        expansion_warning = None
        if user_brush_area > 0:
            expansion_ratio = round((ai_suggested_area - user_brush_area) / float(user_brush_area), 3)
            if expansion_ratio > max_expansion_ratio:
                expansion_warning = f"AI suggestion is {int((expansion_ratio + 1) * 100)}% the size of your brush. Use ERASE brush to refine, or switch to Exact Brush Mode if you prefer only your exact painted area."

        contours = MaskEditor.extract_contours(final_mask)
        res_bbox = MaskEditor.get_bounding_box(final_mask)

        return {
            "success": True,
            "model": model.name,
            "mode_used": "strict",
            "mask": numpy_mask_to_base64(final_mask),
            "contour": contours,
            "bbox": res_bbox,
            "user_brush_area": user_brush_area,
            "ai_suggested_area": ai_suggested_area,
            "expansion_ratio": expansion_ratio,
            "expansion_warning": expansion_warning,
            "confidence": pred.get("confidence"),
            "inference_time_ms": pred["inference_time_ms"],
            "mask_array": final_mask,
            "image_rgb": image_rgb
        }

    @staticmethod
    def run_refinement(
        image_id: str,
        model_id: str,
        current_mask_b64: str,
        mode: str = "strict",
        roi_padding: int = 20,
        max_expansion_ratio: float = 0.20,
        add_scribble_b64: Optional[str] = None,
        erase_scribble_b64: Optional[str] = None,
        previous_mask_b64: Optional[str] = None
    ) -> Dict[str, Any]:
        image_rgb, _ = SegmentationService.load_image_rgb(image_id)
        h, w = image_rgb.shape[:2]

        current_mask = base64_to_numpy_mask(current_mask_b64, (h, w))
        add_mask = base64_to_numpy_mask(add_scribble_b64, (h, w)) if add_scribble_b64 else np.zeros((h, w), dtype=np.uint8)
        erase_mask = base64_to_numpy_mask(erase_scribble_b64, (h, w)) if erase_scribble_b64 else np.zeros((h, w), dtype=np.uint8)

        updated_mask = current_mask.copy()
        if np.count_nonzero(add_mask) > 0:
            updated_mask = MaskEditor.apply_add_brush(updated_mask, add_mask)
        if np.count_nonzero(erase_mask) > 0:
            updated_mask = MaskEditor.apply_erase_brush(updated_mask, erase_mask)

        if mode == "exact":
            contours = MaskEditor.extract_contours(updated_mask)
            bbox = MaskEditor.get_bounding_box(updated_mask)
            return {
                "success": True,
                "model": "Exact Brush Mode",
                "mode_used": "exact",
                "mask": numpy_mask_to_base64(updated_mask),
                "contour": contours,
                "bbox": bbox,
                "user_brush_area": int(np.count_nonzero(updated_mask)),
                "ai_suggested_area": int(np.count_nonzero(updated_mask)),
                "expansion_ratio": 0.0,
                "expansion_warning": None,
                "confidence": 1.0,
                "inference_time_ms": 1.0,
                "mask_array": updated_mask,
                "image_rgb": image_rgb
            }

        coords = cv2.findNonZero((updated_mask > 0).astype(np.uint8))
        if coords is not None:
            bx, by, bw, bh = cv2.boundingRect(coords)
            pad = max(5, int(roi_padding))
            rx1 = max(0, bx - pad)
            ry1 = max(0, by - pad)
            rx2 = min(w, bx + bw + pad)
            ry2 = min(h, by + bh + pad)
            local_roi = [rx1, ry1, rx2, ry2]
        else:
            local_roi = [0, 0, w, h]

        model = model_registry.get_model(model_id)
        if not model or model.status != "READY":
            contours = MaskEditor.extract_contours(updated_mask)
            bbox = MaskEditor.get_bounding_box(updated_mask)
            return {
                "success": True,
                "model": "Manual Mask Editor",
                "mode_used": "strict",
                "mask": numpy_mask_to_base64(updated_mask),
                "contour": contours,
                "bbox": bbox,
                "user_brush_area": int(np.count_nonzero(updated_mask)),
                "ai_suggested_area": int(np.count_nonzero(updated_mask)),
                "expansion_ratio": 0.0,
                "expansion_warning": None,
                "confidence": None,
                "inference_time_ms": 1.0,
                "mask_array": updated_mask,
                "image_rgb": image_rgb
            }

        pred = model.predict(
            image_rgb=image_rgb,
            positive_scribble=add_mask,
            negative_scribble=erase_mask,
            previous_mask=updated_mask,
            bbox=local_roi
        )

        raw_pred = pred["mask"]
        refined_mask = np.zeros((h, w), dtype=np.uint8)
        rx1, ry1, rx2, ry2 = local_roi
        refined_mask[ry1:ry2, rx1:rx2] = raw_pred[ry1:ry2, rx1:rx2]

        if np.count_nonzero(add_mask) > 0:
            refined_mask = np.maximum(refined_mask, add_mask)
        refined_mask[erase_mask > 0] = 0

        final_mask = refined_mask
        contours = MaskEditor.extract_contours(final_mask)
        bbox = MaskEditor.get_bounding_box(final_mask)

        return {
            "success": True,
            "model": model.name,
            "mode_used": "strict",
            "mask": numpy_mask_to_base64(final_mask),
            "contour": contours,
            "bbox": bbox,
            "user_brush_area": int(np.count_nonzero(updated_mask)),
            "ai_suggested_area": int(np.count_nonzero(final_mask)),
            "expansion_ratio": 0.0,
            "expansion_warning": None,
            "confidence": pred.get("confidence"),
            "inference_time_ms": pred["inference_time_ms"],
            "mask_array": final_mask,
            "image_rgb": image_rgb
        }
