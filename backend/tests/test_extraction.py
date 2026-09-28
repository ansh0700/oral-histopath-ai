import numpy as np
import pytest
from app.services.extraction_service import ExtractionService
from PIL import Image

def test_original_color_rgb_and_cutout_extraction():
    # Create synthetic H&E image (H=100, W=100, RGB) with distinct colors
    image_rgb = np.zeros((100, 100, 3), dtype=np.uint8)
    image_rgb[:, :] = [220, 150, 180]  # Pink cytoplasm
    image_rgb[30:70, 30:70] = [60, 30, 100]  # Purple/blue nucleus

    # Mask over nucleus region
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[35:65, 35:65] = 255

    res = ExtractionService.extract_region(
        image_rgb=image_rgb,
        mask=mask,
        image_id="test_img_01",
        padding_percent=0.1
    )

    assert res["success"] is True
    assert "crop_url" in res
    assert "cutout_url" in res
    assert res["width"] > 0
    assert res["height"] > 0
    assert res["area_pixels"] == 30 * 30  # 900 pixels

    # Verify extracted files on disk
    from app.config import RESULTS_DIR
    crop_filename = res["crop_url"].replace("/results/", "")
    cutout_filename = res["cutout_url"].replace("/results/", "")

    crop_img = Image.open(RESULTS_DIR / crop_filename)
    cutout_img = Image.open(RESULTS_DIR / cutout_filename)

    assert crop_img.mode == "RGB"
    assert cutout_img.mode == "RGBA"

    # Verify that original RGB colors are preserved (not grayscaled)
    crop_arr = np.array(crop_img)
    cutout_arr = np.array(cutout_img)

    # Cutout should have alpha=255 inside mask and alpha=0 outside
    assert np.any(cutout_arr[:, :, 3] == 255)
    assert np.any(cutout_arr[:, :, 3] == 0)
