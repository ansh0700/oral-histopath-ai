import numpy as np
import pytest
from app.services.evaluation_service import EvaluationService

def test_evaluation_identical_masks():
    # Mask of 50x50 box inside 100x100
    m1 = np.zeros((100, 100), dtype=np.uint8)
    m1[20:70, 20:70] = 255
    m2 = m1.copy()

    metrics = EvaluationService.calculate_metrics(m1, m2)
    assert metrics["dice"] == 1.0
    assert metrics["iou"] == 1.0
    assert metrics["precision"] == 1.0
    assert metrics["recall"] == 1.0
    assert metrics["f1_score"] == 1.0

def test_evaluation_disjoint_masks():
    m1 = np.zeros((100, 100), dtype=np.uint8)
    m1[10:30, 10:30] = 255
    m2 = np.zeros((100, 100), dtype=np.uint8)
    m2[60:80, 60:80] = 255

    metrics = EvaluationService.calculate_metrics(m1, m2)
    assert metrics["dice"] == 0.0
    assert metrics["iou"] == 0.0
    assert metrics["precision"] == 0.0
    assert metrics["recall"] == 0.0

def test_evaluation_partial_overlap():
    m1 = np.zeros((100, 100), dtype=np.uint8)
    m1[0:50, 0:50] = 255  # 2500 pixels

    m2 = np.zeros((100, 100), dtype=np.uint8)
    m2[0:50, 25:75] = 255  # 2500 pixels
    # Intersection = 50 * 25 = 1250 pixels
    # Union = 2500 + 2500 - 1250 = 3750 pixels

    metrics = EvaluationService.calculate_metrics(m1, m2)
    # IoU = 1250 / 3750 = 0.3333
    # Dice = 2 * 1250 / (2500 + 2500) = 0.50
    assert abs(metrics["iou"] - 0.3333) < 0.01
    assert abs(metrics["dice"] - 0.50) < 0.01
