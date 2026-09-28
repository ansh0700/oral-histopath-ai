import numpy as np
import cv2
import pytest
from app.services.morphology_service import MorphologyService
from app.services.explanation_service import ExplanationService

def test_morphology_analysis_on_circle():
    # Synthetic circular nucleus
    img_rgb = np.zeros((200, 200, 3), dtype=np.uint8)
    img_rgb[:, :] = [230, 210, 220]
    # Draw deep purple nucleus
    cv2.circle(img_rgb, (100, 100), 40, (50, 25, 90), -1)

    mask = np.zeros((200, 200), dtype=np.uint8)
    cv2.circle(mask, (100, 100), 40, 255, -1)

    res = MorphologyService.analyze_region(img_rgb, mask, microns_per_pixel=0.5)
    m = res["measurements"]

    assert m.area_pixels > 0
    # Expected circularity of circle is close to 1.0
    assert m.circularity >= 0.90
    assert m.solidity >= 0.95
    assert m.hematoxylin_optical_density > 0.30
    assert "Hyperchromasia" in res["feature"] or "Nucleus" in res["feature"]

    # Test grounded explanation generation
    exp = ExplanationService.generate_explanation(res["feature"], m, "ScribblePrompt")
    assert "Research/Educational Prototype" in exp
    assert "clinical diagnosis" in exp.lower()
