import abc
from typing import Optional, Dict, Any, List, Tuple
import numpy as np

class BaseSegmentationModel(abc.ABC):
    """
    Abstract base class for all oral histopathology AI segmentation models.
    Each adapter must explicitly declare its prompt capabilities.
    """
    def __init__(self, model_id: str, name: str, display_name: str, description: str, checkpoint_path: str = "", device: str = "cpu"):
        self.model_id = model_id
        self.name = name
        self.display_name = display_name
        self.description = description
        self.checkpoint_path = checkpoint_path
        self.device = device
        self.enabled = False
        self.is_loaded = False
        self.status = "NOT CONFIGURED"
        self.status_detail: Optional[str] = None

    @property
    @abc.abstractmethod
    def supports_point_prompt(self) -> bool:
        """Whether the model natively accepts point prompts (clicks)."""
        pass

    @property
    @abc.abstractmethod
    def supports_box_prompt(self) -> bool:
        """Whether the model natively accepts bounding box prompts."""
        pass

    @property
    @abc.abstractmethod
    def supports_scribble_prompt(self) -> bool:
        """Whether the model natively accepts free-form brush/scribble prompts."""
        pass

    @property
    @abc.abstractmethod
    def supports_mask_prompt(self) -> bool:
        """Whether the model natively accepts a previous mask as an input prompt."""
        pass

    @property
    @abc.abstractmethod
    def supports_iterative_refinement(self) -> bool:
        """Whether the model can iteratively refine predictions across interactive turns."""
        pass

    @abc.abstractmethod
    def load(self) -> bool:
        """Load model architecture and weights."""
        pass

    @abc.abstractmethod
    def test_inference(self) -> bool:
        """Perform a test inference on a dummy tensor to verify readiness."""
        pass

    @abc.abstractmethod
    def predict(
        self,
        image_rgb: np.ndarray,
        positive_scribble: Optional[np.ndarray] = None,
        negative_scribble: Optional[np.ndarray] = None,
        points: Optional[List[Dict[str, Any]]] = None,
        bbox: Optional[List[int]] = None,
        previous_mask: Optional[np.ndarray] = None,
        roi_bbox: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Execute model inference.
        Returns dict containing:
        - "mask": np.ndarray (binary uint8 0 or 255)
        - "confidence": float | None
        - "inference_time_ms": float
        - "bbox": [x1, y1, x2, y2]
        """
        pass

    def get_capabilities_dict(self) -> Dict[str, Any]:
        return {
            "id": self.model_id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "enabled": self.enabled,
            "checkpoint": self.checkpoint_path,
            "device": self.device,
            "status": self.status,
            "status_detail": self.status_detail,
            "supports_point_prompt": self.supports_point_prompt,
            "supports_box_prompt": self.supports_box_prompt,
            "supports_scribble_prompt": self.supports_scribble_prompt,
            "supports_mask_prompt": self.supports_mask_prompt,
            "supports_iterative_refinement": self.supports_iterative_refinement,
        }
