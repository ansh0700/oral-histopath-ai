from typing import Dict, Any
from app.schemas.responses import MorphologyMeasurements

class ExplanationService:
    DISCLAIMER = "AI-assisted observation — not a standalone clinical diagnosis. Research/Educational Prototype — Not a Clinical Diagnostic Tool."

    @staticmethod
    def generate_explanation(
        feature: str,
        measurements: MorphologyMeasurements,
        model_name: str,
        confidence: float | None = None
    ) -> str:
        """
        Generates a grounded, educational histopathological explanation matching the WHO OPMD/OSCC guidelines.
        """
        area_str = f"{measurements.area_microns_sq} µm² ({measurements.area_pixels} px)" if measurements.area_microns_sq else f"{measurements.area_pixels} px"
        circ_str = f"{measurements.circularity:.2f}"
        od_str = f"{measurements.hematoxylin_optical_density:.2f}"

        if "Spindle" in feature or "Tadpole" in feature:
            text = (
                f"The selected cell exhibits extreme cellular elongation (aspect ratio: {measurements.aspect_ratio}, eccentricity: {measurements.eccentricity:.2f}). "
                "In oral squamous cell carcinoma (OSCC), tadpole and spindle cell transformations represent bizarre cellular pleomorphism "
                "and phenotypic modulation associated with epithelial-mesenchymal transition (EMT) and aggressive stromal invasion."
            )
        elif "Keratin" in feature:
            text = (
                f"The selected structure demonstrates dense eosinophilic cytoplasmic staining (Eosin OD: {measurements.eosin_optical_density:.2f}, stain ratio: {measurements.stain_ratio}). "
                "In dysplastic oral lesions and well-differentiated OSCC, single-cell keratinisation (dyskeratosis) reflects abnormal, premature keratin synthesis "
                "within non-cornified intraepithelial strata."
            )
        elif "Atypical Mitotic" in feature:
            text = (
                f"The segmented chromatin configuration displays an atypical, asymmetric or multipolar mitotic pattern (circularity: {circ_str}, area: {area_str}). "
                "Atypical mitotic figures (AMFs) such as trikaryokinesis, tetrapolar divisions, or chromatin segregation lag are highly specific hallmarks "
                "of chromosomal instability and malignant progression in oral carcinoma."
            )
        elif "Mitotic" in feature:
            text = (
                f"The segmented region corresponds to an active mitotic figure (Hematoxylin OD: {od_str}, area: {area_str}). "
                "Increased frequency of mitotic figures, particularly when identified in the upper/superficial two-thirds of the oral epithelium, "
                "correlates with accelerated cell cycle kinetics and dysplastic proliferative disturbance."
            )
        elif "Nucleoli" in feature:
            text = (
                f"Intra-nuclear optical analysis detected prominent, enlarged, or multiple nucleoli ({measurements.nucleoli_count_estimate or 'prominent'} foci). "
                "Enlarged and irregular nucleoli reflect markedly elevated ribosomal RNA synthesis and metabolic hyperactivity in dysplastic and neoplastic keratinocytes."
            )
        elif "Hyperchromasia" in feature:
            text = (
                f"The selected nucleus exhibits significant hyperchromasia with elevated Hematoxylin optical density ({od_str}) and nuclear area of {area_str}. "
                "Hyperchromasia reflects increased nuclear DNA content, chromatin condensation, and polyploidy, which progressively rises across dysplasia grades to OSCC."
            )
        elif "Enlarge" in feature:
            text = (
                f"The selected nucleus shows marked enlargement ({area_str}, equivalent diameter: {measurements.equivalent_diameter} px), "
                "significantly exceeding normal basal epithelial nuclear boundaries. "
                "Nuclear enlargement (anisonucleosis / elevated N:C ratio) represents a core cytological criterion in the WHO grading of oral epithelial dysplasia."
            )
        elif "Pleomorphism" in feature or "Shape" in feature:
            text = (
                f"The segmented nucleus demonstrates shape irregularity and contour angulation (circularity: {circ_str}, solidity: {measurements.solidity:.2f}). "
                "Nuclear pleomorphism and thickened, irregular nuclear membranes favor dysplastic transformation over reactive inflammatory atypia."
            )
        elif "Uniform" in feature or "Normal" in feature:
            text = (
                f"The selected structure displays uniform dimensions ({area_str}) and high circularity ({circ_str}). "
                "These quantitative characteristics are consistent with baseline, non-dysplastic oral stratified squamous epithelium."
            )
        else:
            text = (
                f"The selected region encompasses a cellular structure with area {area_str} and perimeter {measurements.perimeter_pixels} px. "
                f"Segmented under user-controlled Strict Brush Mode via {model_name}."
            )

        return f"{text}\n\n[{ExplanationService.DISCLAIMER}]"
