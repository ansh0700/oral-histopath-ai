from typing import Dict, Any, Optional
import numpy as np
import cv2

class EvaluationService:
    @staticmethod
    def calculate_metrics(predicted_mask: np.ndarray, ground_truth_mask: np.ndarray) -> Dict[str, Any]:
        """
        Calculates mathematical segmentation metrics between prediction and ground truth:
        - Dice Coefficient: 2 * |P ∩ G| / (|P| + |G|)
        - IoU (Jaccard Index): |P ∩ G| / |P ∪ G|
        - Precision: TP / (TP + FP)
        - Recall: TP / (TP + FN)
        - F1 Score: 2 * (Precision * Recall) / (Precision + Recall)
        - Boundary F1: F1 score along the 1-pixel boundary contour
        """
        # Ensure dimensions match
        if predicted_mask.shape != ground_truth_mask.shape:
            ground_truth_mask = cv2.resize(ground_truth_mask, (predicted_mask.shape[1], predicted_mask.shape[0]), interpolation=cv2.INTER_NEAREST)

        p_bool = (predicted_mask > 0)
        g_bool = (ground_truth_mask > 0)

        tp = int(np.count_nonzero(p_bool & g_bool))
        fp = int(np.count_nonzero(p_bool & ~g_bool))
        fn = int(np.count_nonzero(~p_bool & g_bool))
        tn = int(np.count_nonzero(~p_bool & ~g_bool))

        p_total = tp + fp
        g_total = tp + fn
        union = tp + fp + fn

        # Dice
        if (p_total + g_total) == 0:
            dice = 1.0 if tp == 0 else 0.0
        else:
            dice = round(float(2.0 * tp / (p_total + g_total)), 4)

        # IoU
        if union == 0:
            iou = 1.0 if tp == 0 else 0.0
        else:
            iou = round(float(tp / union), 4)

        # Precision
        precision = round(float(tp / p_total), 4) if p_total > 0 else 0.0

        # Recall
        recall = round(float(tp / g_total), 4) if g_total > 0 else 0.0

        # F1
        f1 = round(float(2.0 * precision * recall / (precision + recall)), 4) if (precision + recall) > 0 else 0.0

        # Boundary F1
        boundary_f1 = EvaluationService._calculate_boundary_f1(predicted_mask, ground_truth_mask)

        return {
            "success": True,
            "dice": dice,
            "iou": iou,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "boundary_f1": boundary_f1,
            "true_positive_pixels": tp,
            "false_positive_pixels": fp,
            "false_negative_pixels": fn
        }

    @staticmethod
    def _calculate_boundary_f1(p_mask: np.ndarray, g_mask: np.ndarray, tolerance: int = 2) -> Optional[float]:
        try:
            p_bin = (p_mask > 0).astype(np.uint8) * 255
            g_bin = (g_mask > 0).astype(np.uint8) * 255

            p_edges = cv2.Canny(p_bin, 100, 200)
            g_edges = cv2.Canny(g_bin, 100, 200)

            if np.count_nonzero(p_edges) == 0 and np.count_nonzero(g_edges) == 0:
                return 1.0
            if np.count_nonzero(p_edges) == 0 or np.count_nonzero(g_edges) == 0:
                return 0.0

            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (tolerance * 2 + 1, tolerance * 2 + 1))
            g_dilated = cv2.dilate(g_edges, kernel)
            p_dilated = cv2.dilate(p_edges, kernel)

            precision = np.count_nonzero((p_edges > 0) & (g_dilated > 0)) / max(1, np.count_nonzero(p_edges > 0))
            recall = np.count_nonzero((g_edges > 0) & (p_dilated > 0)) / max(1, np.count_nonzero(g_edges > 0))

            if (precision + recall) == 0:
                return 0.0
            return round(float(2.0 * precision * recall / (precision + recall)), 4)
        except Exception:
            return None
