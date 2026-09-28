from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ImageUploadResponse(BaseModel):
    success: bool
    image_id: str
    filename: str
    width: int
    height: int
    channels: int
    url: str
    thumbnail_url: Optional[str] = None
    is_sample: bool = False
    ground_truth_url: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ModelCapabilityResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: str
    enabled: bool
    checkpoint: str
    device: str
    status: str  # "READY", "NOT CONFIGURED", "ERROR"
    status_detail: Optional[str] = None
    supports_point_prompt: bool
    supports_box_prompt: bool
    supports_scribble_prompt: bool
    supports_mask_prompt: bool
    supports_iterative_refinement: bool

class SegmentationResponse(BaseModel):
    success: bool
    model: str
    mode_used: str = "strict"  # "strict" or "exact"
    mask: str  # Base64 PNG mask (AI suggestion or confirmed mask)
    contour: Optional[List[List[List[int]]]] = None  # List of polygons: [[[x1, y1], [x2, y2], ...], ...]
    bbox: Optional[List[int]] = None  # [x1, y1, x2, y2]
    user_brush_area: Optional[int] = None
    ai_suggested_area: Optional[int] = None
    expansion_ratio: Optional[float] = None
    expansion_warning: Optional[str] = None
    confidence: Optional[float] = None
    inference_time_ms: float
    message: Optional[str] = None

class ExtractionResponse(BaseModel):
    success: bool
    crop_url: str  # Original RGB color crop URL
    cutout_url: str  # Transparent RGBA cutout URL
    crop_base64: Optional[str] = None
    cutout_base64: Optional[str] = None
    bbox: List[int]  # [x1, y1, x2, y2]
    width: int
    height: int
    area_pixels: int

class MorphologyMeasurements(BaseModel):
    area_pixels: int
    area_microns_sq: Optional[float] = None
    perimeter_pixels: float
    perimeter_microns: Optional[float] = None
    equivalent_diameter: float
    aspect_ratio: float
    circularity: float  # 4 * pi * area / (perimeter^2), 1.0 = perfect circle
    solidity: float  # Area / Convex Hull Area
    eccentricity: float
    extent: float
    major_axis_length: float
    minor_axis_length: float
    centroid: List[float]
    bbox: List[int]
    mean_intensity_r: float
    mean_intensity_g: float
    mean_intensity_b: float
    hematoxylin_optical_density: float  # Nuclear hyperchromasia proxy
    eosin_optical_density: float
    stain_ratio: float
    nucleoli_count_estimate: Optional[int] = None
    is_mitotic_pattern: Optional[bool] = None

class AnalysisResponse(BaseModel):
    success: bool
    model: str
    feature: str  # E.g. "Hyperchromasia", "Nuclear Enlargement", "Irregular Nuclear Contour", etc.
    feature_category: str
    confidence: Optional[float] = None
    measurements: MorphologyMeasurements
    explanation: str
    medical_disclaimer: str = "Research/Educational Prototype — Not a Clinical Diagnostic Tool. AI-assisted observation — not a standalone clinical diagnosis."

class SingleModelComparisonResult(BaseModel):
    model_id: str
    model_name: str
    status: str
    inference_time_ms: Optional[float] = None
    supported_prompt_used: str
    mask_url: Optional[str] = None
    crop_url: Optional[str] = None
    cutout_url: Optional[str] = None
    bbox: Optional[List[int]] = None
    confidence: Optional[float] = None
    dice: Optional[float] = None
    iou: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    notes: Optional[str] = None

class ModelComparisonResponse(BaseModel):
    success: bool
    image_id: str
    results: List[SingleModelComparisonResult]
    ground_truth_available: bool
    evaluation_summary: Optional[str] = None

class EvaluationMetricsResponse(BaseModel):
    success: bool
    dice: float
    iou: float
    precision: float
    recall: float
    f1_score: float
    boundary_f1: Optional[float] = None
    true_positive_pixels: int
    false_positive_pixels: int
    false_negative_pixels: int
