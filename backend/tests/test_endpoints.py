import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image
import numpy as np

from app.main import app
from app.services.preprocessing import numpy_mask_to_base64

client = TestClient(app)

def test_health_and_root():
    res = client.get("/")
    assert res.status_code == 200
    assert "ScribblePrompt" in res.json()["primary_model"]

    res_h = client.get("/api/health")
    assert res_h.status_code == 200
    assert res_h.json()["status"] == "healthy"

def test_get_active_models():
    res = client.get("/api/models")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1

    # Active models must be genuinely READY with real neural weights
    for m in data:
        assert m["status"] == "READY", f"Active model {m['name']} must be READY"

def test_get_sample_datasets_from_pdf():
    res = client.get("/api/samples")
    assert res.status_code == 200
    samples = res.json()
    assert len(samples) >= 10
    sample_ids = [s["image_id"] for s in samples]
    assert "sample_pdf_hyperchromasia" in sample_ids
    assert "sample_pdf_anisocytosis" in sample_ids
    assert "sample_pdf_keratinisation" in sample_ids
    assert "sample_pdf_atypical_mitosis" in sample_ids

def test_strict_brush_mode_local_roi_constraint():
    # Test on a PDF reference slide
    image_id = "sample_pdf_hyperchromasia"

    # User paints a small 40x40 nucleus
    scribble_mask = np.zeros((975, 1447), dtype=np.uint8)
    scribble_mask[400:440, 600:640] = 255
    scribble_b64 = numpy_mask_to_base64(scribble_mask)

    seg_payload = {
        "image_id": image_id,
        "model": "scribbleprompt",
        "mode": "strict",
        "roi_padding": 20,
        "positive_scribble": scribble_b64
    }
    seg_res = client.post("/api/segment", json=seg_payload)
    assert seg_res.status_code == 200
    seg_data = seg_res.json()
    assert seg_data["success"] is True
    assert seg_data["mode_used"] == "strict"
    # Strict mode ensures bounding box does not exceed local ROI
    bbox = seg_data["bbox"]
    assert bbox[0] >= 600 - 30
    assert bbox[2] <= 640 + 30
    assert bbox[1] >= 400 - 30
    assert bbox[3] <= 440 + 30

def test_exact_brush_mode():
    image_id = "sample_pdf_hyperchromasia"
    scribble_mask = np.zeros((975, 1447), dtype=np.uint8)
    scribble_mask[300:350, 400:450] = 255
    scribble_b64 = numpy_mask_to_base64(scribble_mask)

    seg_payload = {
        "image_id": image_id,
        "model": "scribbleprompt",
        "mode": "exact",
        "positive_scribble": scribble_b64
    }
    seg_res = client.post("/api/segment", json=seg_payload)
    assert seg_res.status_code == 200
    seg_data = seg_res.json()
    assert seg_data["mode_used"] == "exact"
    assert seg_data["user_brush_area"] == 50 * 50  # 2500 pixels
    assert seg_data["ai_suggested_area"] == 2500  # Exact match

def test_hard_negative_exclusion():
    image_id = "sample_pdf_hyperchromasia"
    pos_mask = np.zeros((975, 1447), dtype=np.uint8)
    pos_mask[400:460, 400:460] = 255

    neg_mask = np.zeros((975, 1447), dtype=np.uint8)
    neg_mask[430:460, 400:460] = 255  # Erase bottom half

    seg_payload = {
        "image_id": image_id,
        "model": "scribbleprompt",
        "mode": "strict",
        "positive_scribble": numpy_mask_to_base64(pos_mask),
        "negative_scribble": numpy_mask_to_base64(neg_mask)
    }
    seg_res = client.post("/api/segment", json=seg_payload)
    assert seg_res.status_code == 200
    seg_data = seg_res.json()
    # Mask must have zero pixels where negative_scribble is present
    from app.services.preprocessing import base64_to_numpy_mask
    mask_arr = base64_to_numpy_mask(seg_data["mask"], (975, 1447))
    assert np.count_nonzero(mask_arr[neg_mask > 0]) == 0

def test_model_comparison_honest_handling():
    image_id = "sample_pdf_hyperchromasia"
    pos_mask = np.zeros((975, 1447), dtype=np.uint8)
    pos_mask[400:440, 600:640] = 255

    comp_payload = {
        "image_id": image_id,
        "mode": "strict",
        "positive_scribble": numpy_mask_to_base64(pos_mask),
    }
    comp_res = client.post("/api/compare", json=comp_payload)
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    # When only 1 model is loaded with weights, comparison is honestly declared unavailable
    if not comp_data["success"]:
        assert "Multi-model comparison is unavailable" in comp_data["evaluation_summary"]
