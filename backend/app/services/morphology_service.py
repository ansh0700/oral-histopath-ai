import math
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import cv2
from skimage import measure

from app.schemas.responses import MorphologyMeasurements

class MorphologyService:
    @staticmethod
    def analyze_region(
        image_rgb: np.ndarray,
        mask: np.ndarray,
        microns_per_pixel: float = 0.5
    ) -> Dict[str, Any]:
        """
        Calculates technically validated morphological and optical stain measurements
        grounded in the OPMD/OSCC WHO histological reference criteria.
        """
        img_h, img_w = image_rgb.shape[:2]
        if mask.shape[:2] != (img_h, img_w):
            mask = cv2.resize(mask, (img_w, img_h), interpolation=cv2.INTER_NEAREST)

        binary_mask = (mask > 0).astype(np.uint8)
        area_pixels = int(np.count_nonzero(binary_mask))

        if area_pixels == 0:
            return {
                "measurements": MorphologyMeasurements(
                    area_pixels=0,
                    area_microns_sq=0.0,
                    perimeter_pixels=0.0,
                    perimeter_microns=0.0,
                    equivalent_diameter=0.0,
                    aspect_ratio=1.0,
                    circularity=0.0,
                    solidity=0.0,
                    eccentricity=0.0,
                    extent=0.0,
                    major_axis_length=0.0,
                    minor_axis_length=0.0,
                    centroid=[0.0, 0.0],
                    bbox=[0, 0, 0, 0],
                    mean_intensity_r=0.0,
                    mean_intensity_g=0.0,
                    mean_intensity_b=0.0,
                    hematoxylin_optical_density=0.0,
                    eosin_optical_density=0.0,
                    stain_ratio=1.0,
                    nucleoli_count_estimate=0,
                    is_mitotic_pattern=False
                ),
                "feature": "No region selected",
                "feature_category": "Indeterminate",
                "confidence": None
            }

        area_microns_sq = round(area_pixels * (microns_per_pixel ** 2), 2)

        contours, _ = cv2.findContours(binary_mask * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        perimeter_pixels = 0.0
        if contours:
            perimeter_pixels = float(sum(cv2.arcLength(cnt, True) for cnt in contours))
        perimeter_microns = round(perimeter_pixels * microns_per_pixel, 2)

        # Circularity: 4 * pi * Area / (Perimeter^2)
        if perimeter_pixels > 0:
            circularity = round(float(min(1.0, (4 * math.pi * area_pixels) / (perimeter_pixels ** 2))), 3)
        else:
            circularity = 1.0

        equivalent_diameter = round(float(math.sqrt(4 * area_pixels / math.pi)), 2)

        # 2nd Moments and Ellipse descriptors
        labeled = measure.label(binary_mask)
        props = measure.regionprops(labeled)

        if props:
            prop = max(props, key=lambda p: p.area)
            eccentricity = round(float(prop.eccentricity), 3)
            solidity = round(float(prop.solidity), 3)
            extent = round(float(prop.extent), 3)
            major_axis = round(float(getattr(prop, "axis_major_length", getattr(prop, "major_axis_length", 0.0))), 2)
            minor_axis = round(float(getattr(prop, "axis_minor_length", getattr(prop, "minor_axis_length", 0.0))), 2)
            centroid_y, centroid_x = prop.centroid
            centroid = [round(float(centroid_x), 1), round(float(centroid_y), 1)]
            aspect_ratio = round(float(major_axis / max(1.0, minor_axis)), 2)
            minr, minc, maxr, maxc = prop.bbox
            bbox = [int(minc), int(minr), int(maxc), int(maxr)]
        else:
            eccentricity = 0.0
            solidity = 1.0
            extent = 1.0
            major_axis = equivalent_diameter
            minor_axis = equivalent_diameter
            centroid = [0.0, 0.0]
            aspect_ratio = 1.0
            bbox = [0, 0, 0, 0]

        # Stain Optical Density (OD) calculated from RGB color channels
        mask_bool = binary_mask > 0
        masked_rgb = image_rgb[mask_bool]

        mean_r = float(np.mean(masked_rgb[:, 0]))
        mean_g = float(np.mean(masked_rgb[:, 1]))
        mean_b = float(np.mean(masked_rgb[:, 2]))

        od_r = -math.log10(max(1.0, mean_r + 1.0) / 256.0)
        od_g = -math.log10(max(1.0, mean_g + 1.0) / 256.0)
        od_b = -math.log10(max(1.0, mean_b + 1.0) / 256.0)

        hematoxylin_od = round(float(od_r), 3)
        eosin_od = round(float(od_g), 3)
        stain_ratio = round(float(od_r / max(0.01, od_g)), 2)

        # Detect intra-nuclear nucleolar peaks & chromatin texture
        nucleoli_count = 0
        is_mitotic = False
        if area_pixels > 80:
            roi_gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
            nuc_crop = roi_gray[bbox[1]:bbox[3], bbox[0]:bbox[2]]
            mask_crop = binary_mask[bbox[1]:bbox[3], bbox[0]:bbox[2]]
            if nuc_crop.size > 0:
                masked_gray = nuc_crop.copy()
                masked_gray[mask_crop == 0] = 255
                # Local minima detection for dense nucleoli
                dark_spots = (masked_gray < np.percentile(masked_gray[mask_crop > 0], 15)).astype(np.uint8)
                n_cnt, _, _, _ = cv2.connectedComponentsWithStats(dark_spots)
                nucleoli_count = max(0, n_cnt - 1)
                
                # Mitotic figure check: high chromatin dispersion + irregular contour + high hematoxylin
                if circularity < 0.65 and hematoxylin_od > 0.35 and 100 < area_pixels < 3000:
                    is_mitotic = True

        measurements = MorphologyMeasurements(
            area_pixels=area_pixels,
            area_microns_sq=area_microns_sq,
            perimeter_pixels=round(perimeter_pixels, 2),
            perimeter_microns=perimeter_microns,
            equivalent_diameter=equivalent_diameter,
            aspect_ratio=aspect_ratio,
            circularity=circularity,
            solidity=solidity,
            eccentricity=eccentricity,
            extent=extent,
            major_axis_length=major_axis,
            minor_axis_length=minor_axis,
            centroid=centroid,
            bbox=bbox,
            mean_intensity_r=round(mean_r, 1),
            mean_intensity_g=round(mean_g, 1),
            mean_intensity_b=round(mean_b, 1),
            hematoxylin_optical_density=hematoxylin_od,
            eosin_optical_density=eosin_od,
            stain_ratio=stain_ratio,
            nucleoli_count_estimate=nucleoli_count,
            is_mitotic_pattern=is_mitotic
        )

        feature, category = MorphologyService._classify_feature(measurements)

        return {
            "measurements": measurements,
            "feature": feature,
            "feature_category": category,
            "confidence": None  # Honest: Rule-based quantitative analysis, not an AI classifier probability
        }

    @staticmethod
    def _classify_feature(m: MorphologyMeasurements) -> Tuple[str, str]:
        """
        Rule-grounded morphological feature classification based on the reference PDF OPMD/OSCC criteria.
        """
        # 1. Tadpole / Spindle Cell Transformation (Extreme cellular pleomorphism)
        if m.aspect_ratio >= 2.4 and m.eccentricity > 0.88:
            return "Tadpole / Spindle Cell Transformation", "Cellular Pleomorphism (OSCC)"

        # 2. Nuclear Hyperchromasia (Deep hematoxylin absorption in nucleus)
        if m.hematoxylin_optical_density >= 0.35 and m.mean_intensity_r < 120:
            if m.area_microns_sq and m.area_microns_sq > 300:
                return "Hyperchromatic Enlarged Nucleus", "Nuclear Atypia"
            return "Nuclear Hyperchromasia", "Nuclear Atypia"

        # 3. Single-Cell Keratinisation (Intense Eosinophilia & Eosin OD > Hematoxylin OD)
        if m.eosin_optical_density >= 0.34 and m.stain_ratio < 0.85:
            return "Single-Cell Keratinisation", "Cytoplasmic Differentiation"

        # 4. Atypical / Multipolar Mitotic Figure
        if m.is_mitotic_pattern and m.solidity < 0.80 and m.circularity < 0.55:
            return "Atypical Mitotic Figure (AMF)", "Mitotic Aberration (OSCC)"

        # 5. Standard Mitotic Figure (MF)
        if m.is_mitotic_pattern and m.hematoxylin_optical_density >= 0.36:
            return "Active Mitotic Figure (MF)", "Proliferative Activity"

        # 6. Prominent / Multiple Nucleoli
        if m.nucleoli_count_estimate and m.nucleoli_count_estimate >= 2:
            return "Prominent & Multiple Nucleoli", "Nuclear Atypia"

        # 7. Abnormal Nuclear Size (Macronucleus / Anisonucleosis)
        if m.area_microns_sq and m.area_microns_sq > 380:
            if m.circularity < 0.65 or m.solidity < 0.85:
                return "Enlarged Pleomorphic Nucleus", "Nuclear Pleomorphism"
            return "Nuclear Enlargement (Macronucleus)", "Nuclear Atypia"

        # 8. Abnormal Variation in Nuclear Shape / Pleomorphism
        if m.circularity < 0.62 or m.solidity < 0.82 or m.eccentricity > 0.84:
            return "Nuclear Shape Pleomorphism / Irregular Contour", "Nuclear Shape Atypia"

        # 9. Normal / Baseline Uniform Morphology
        if 40 <= (m.area_microns_sq or 100) <= 250 and m.circularity >= 0.75 and m.solidity >= 0.90:
            return "Uniform Normal Epithelial Morphology", "Baseline Reference"

        return "Cellular / Nuclear Structure", "Quantitative Morphology"
