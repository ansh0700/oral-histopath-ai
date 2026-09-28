from typing import List, Tuple, Optional
import numpy as np
import cv2

class MaskEditor:
    @staticmethod
    def apply_add_brush(base_mask: np.ndarray, add_brush_mask: np.ndarray) -> np.ndarray:
        """
        Combines base mask with positive add brush strokes.
        """
        if add_brush_mask.shape != base_mask.shape:
            add_brush_mask = cv2.resize(add_brush_mask, (base_mask.shape[1], base_mask.shape[0]), interpolation=cv2.INTER_NEAREST)
        return np.maximum(base_mask, (add_brush_mask > 0).astype(np.uint8) * 255)

    @staticmethod
    def apply_erase_brush(base_mask: np.ndarray, erase_brush_mask: np.ndarray) -> np.ndarray:
        """
        Removes erase brush strokes from base mask.
        """
        if erase_brush_mask.shape != base_mask.shape:
            erase_brush_mask = cv2.resize(erase_brush_mask, (base_mask.shape[1], base_mask.shape[0]), interpolation=cv2.INTER_NEAREST)
        res = base_mask.copy()
        res[erase_brush_mask > 0] = 0
        return res

    @staticmethod
    def extract_contours(mask: np.ndarray) -> List[List[List[int]]]:
        """
        Extracts closed boundary polygon contours from a binary mask.
        Returns list of polygon point arrays [[[x1, y1], [x2, y2], ...], ...]
        """
        if np.count_nonzero(mask) == 0:
            return []

        binary = (mask > 0).astype(np.uint8) * 255
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        result_polygons = []
        for cnt in contours:
            if len(cnt) >= 3:
                # Simplify contour with Douglas-Peucker
                epsilon = 0.005 * cv2.arcLength(cnt, True)
                approx = cv2.approxPolyDP(cnt, epsilon, True)
                poly = approx.reshape(-1, 2).tolist()
                result_polygons.append(poly)
        return result_polygons

    @staticmethod
    def get_bounding_box(mask: np.ndarray) -> List[int]:
        """
        Computes bounding box [x1, y1, x2, y2] from mask.
        """
        coords = cv2.findNonZero((mask > 0).astype(np.uint8))
        if coords is None:
            return [0, 0, 0, 0]
        x, y, w, h = cv2.boundingRect(coords)
        return [int(x), int(y), int(x + w), int(y + h)]

    @staticmethod
    def smooth_mask(mask: np.ndarray, kernel_size: int = 3) -> np.ndarray:
        """
        Applies morphological opening & closing to eliminate single-pixel noise.
        """
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)
        return closed
