from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class SegmentationRequest(BaseModel):
    image_id: str
    model: str = "scribbleprompt"
    mode: Optional[str] = "strict"  # "strict" (default) or "exact"
    roi_padding: Optional[int] = 20  # Local ROI constraint padding (10-30px)
    max_expansion_ratio: Optional[float] = 0.20  # Max expansion limit (10-20%)
    positive_scribble: Optional[str] = None  # Base64 encoded binary/grayscale mask
    negative_scribble: Optional[str] = None
    previous_mask: Optional[str] = None
    points: Optional[List[Dict[str, Any]]] = None  # [{"x": int, "y": int, "label": 1 or 0}]
    bbox: Optional[List[int]] = None  # [x1, y1, x2, y2]
    roi_bbox: Optional[List[int]] = None  # Optional sub-ROI for large image processing

class RefinementRequest(BaseModel):
    image_id: str
    model: str = "scribbleprompt"
    mode: Optional[str] = "strict"  # "strict" or "exact"
    roi_padding: Optional[int] = 20
    max_expansion_ratio: Optional[float] = 0.20
    current_mask: str  # Base64 mask
    add_scribble: Optional[str] = None
    erase_scribble: Optional[str] = None
    previous_mask: Optional[str] = None

class ExtractionRequest(BaseModel):
    image_id: str
    mask: str  # Base64 mask string
    padding_percent: Optional[float] = 0.05

class AnalysisRequest(BaseModel):
    image_id: str
    mask: str
    model: Optional[str] = "scribbleprompt"
    confidence: Optional[float] = None
    microns_per_pixel: Optional[float] = 0.5  # standard 20x/40x digital pathology scaling

class ModelComparisonRequest(BaseModel):
    image_id: str
    mode: Optional[str] = "strict"
    roi_padding: Optional[int] = 20
    positive_scribble: Optional[str] = None
    negative_scribble: Optional[str] = None
    points: Optional[List[Dict[str, Any]]] = None
    bbox: Optional[List[int]] = None
    models: Optional[List[str]] = None
    ground_truth_mask: Optional[str] = None

class EvaluationRequest(BaseModel):
    predicted_mask: str
    ground_truth_mask: str

class ModelConfigRequest(BaseModel):
    model_id: str
    enabled: bool
    checkpoint: Optional[str] = None
    device: Optional[str] = "cpu"
