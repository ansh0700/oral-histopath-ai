import uuid
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import numpy as np
from PIL import Image
import cv2

from app.config import RESULTS_DIR
from app.services.preprocessing import numpy_image_to_base64

class ExtractionService:
    @staticmethod
    def extract_region(
        image_rgb: np.ndarray,
        mask: np.ndarray,
        image_id: str,
        padding_percent: float = 0.05
    ) -> Dict[str, Any]:
        """
        Generates:
        1. OUTPUT 1 — RGB Bounding Box Crop: Original color H&E image cropped to region bbox.
        2. OUTPUT 2 — Object Cutout: Original color H&E image with transparent background (RGBA) for non-mask pixels.
        
        Strictly preserves original H&E colors (does not grayscale or mask-replace).
        """
        img_h, img_w = image_rgb.shape[:2]

        # Ensure mask matches image dimensions
        if mask.shape[:2] != (img_h, img_w):
            mask = cv2.resize(mask, (img_w, img_h), interpolation=cv2.INTER_NEAREST)

        binary_mask = (mask > 0).astype(np.uint8) * 255
        coords = cv2.findNonZero(binary_mask)

        if coords is None:
            # Empty mask fallback
            bbox = [0, 0, min(100, img_w), min(100, img_h)]
        else:
            bx, by, bw, bh = cv2.boundingRect(coords)
            pad_x = int(bw * padding_percent)
            pad_y = int(bh * padding_percent)
            x1 = max(0, bx - pad_x)
            y1 = max(0, by - pad_y)
            x2 = min(img_w, bx + bw + pad_x)
            y2 = min(img_h, by + bh + pad_y)
            bbox = [int(x1), int(y1), int(x2), int(y2)]

        x1, y1, x2, y2 = bbox
        crop_w = max(1, x2 - x1)
        crop_h = max(1, y2 - y1)

        # 1. Bounding Box Crop (Original RGB colors preserved)
        rgb_crop = image_rgb[y1:y2, x1:x2].copy()

        # 2. Object Cutout (4-channel RGBA)
        mask_crop = binary_mask[y1:y2, x1:x2]
        rgba_cutout = np.zeros((crop_h, crop_w, 4), dtype=np.uint8)
        rgba_cutout[:, :, :3] = rgb_crop
        rgba_cutout[:, :, 3] = mask_crop  # 255 inside mask, 0 (transparent) outside

        # Save to disk in results folder
        result_uid = f"{image_id}_{uuid.uuid4().hex[:8]}"
        crop_filename = f"crop_{result_uid}.png"
        cutout_filename = f"cutout_{result_uid}.png"

        crop_path = RESULTS_DIR / crop_filename
        cutout_path = RESULTS_DIR / cutout_filename

        Image.fromarray(rgb_crop, mode="RGB").save(crop_path, format="PNG")
        Image.fromarray(rgba_cutout, mode="RGBA").save(cutout_path, format="PNG")

        area_px = int(np.count_nonzero(binary_mask))

        return {
            "success": True,
            "crop_url": f"/results/{crop_filename}",
            "cutout_url": f"/results/{cutout_filename}",
            "crop_base64": numpy_image_to_base64(rgb_crop, "PNG"),
            "cutout_base64": numpy_image_to_base64(rgba_cutout, "PNG"),
            "bbox": bbox,
            "width": crop_w,
            "height": crop_h,
            "area_pixels": area_px
        }
