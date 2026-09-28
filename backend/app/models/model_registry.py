from typing import Dict, List, Optional
from app.models.base_model import BaseSegmentationModel
from app.models.scribbleprompt_adapter import ScribblePromptAdapter
from app.models.pathosam_adapter import PathoSAMAdapter
from app.models.vista_path_adapter import VistaPathAdapter
from app.models.medsam_adapter import MedSAMAdapter
from app.models.cellvit_adapter import CellViTAdapter
from app.models.hovernet_adapter import HoverNetAdapter
from app.config import load_models_config, save_models_config

class ModelRegistry:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelRegistry, cls).__new__(cls)
            cls._instance._models: Dict[str, BaseSegmentationModel] = {}
            cls._instance._initialized = False
        return cls._instance

    def initialize(self):
        if self._initialized:
            return

        config_data = load_models_config().get("models", {})

        adapters = {
            "scribbleprompt": ScribblePromptAdapter,
            "pathosam": PathoSAMAdapter,
            "vista_path": VistaPathAdapter,
            "medsam": MedSAMAdapter,
            "cellvit": CellViTAdapter,
            "hovernet": HoverNetAdapter,
        }

        for model_id, adapter_cls in adapters.items():
            model_cfg = config_data.get(model_id, {})
            checkpoint = model_cfg.get("checkpoint", f"weights/{model_id}.pth")
            device = model_cfg.get("device", "cpu")
            # Only ScribblePrompt is active by default because it has real neural weights
            enabled = model_cfg.get("enabled", model_id == "scribbleprompt")

            adapter = adapter_cls(checkpoint_path=checkpoint, device=device)
            adapter.enabled = enabled
            if enabled:
                adapter.load()
            else:
                adapter.is_loaded = False
                adapter.status = "UNCONFIGURED"
                adapter.status_detail = f"{adapter.name} neural weights are not installed. Download pretrained weights to enable."

            self._models[model_id] = adapter

        self._initialized = True

    def get_model(self, model_id: str) -> Optional[BaseSegmentationModel]:
        self.initialize()
        return self._models.get(model_id.lower())

    def list_models(self, active_only: bool = True) -> List[Dict]:
        self.initialize()
        if active_only:
            # Return only genuinely enabled, functional models
            return [model.get_capabilities_dict() for model in self._models.values() if model.enabled and model.status == "READY"]
        return [model.get_capabilities_dict() for model in self._models.values()]

    def test_model(self, model_id: str) -> Dict:
        self.initialize()
        model = self._models.get(model_id.lower())
        if not model:
            return {"success": False, "message": f"Unknown model '{model_id}'"}

        loaded = model.load()
        if loaded and model.test_inference():
            model.status = "READY"
            model.status_detail = "Model architecture and weights loaded successfully. Test inference passed."
            return {"success": True, "status": "READY", "message": "Test inference passed successfully."}
        else:
            return {"success": False, "status": model.status, "message": model.status_detail or "Test inference failed."}

    def configure_model(self, model_id: str, enabled: bool, checkpoint: Optional[str] = None, device: Optional[str] = "cpu") -> Dict:
        self.initialize()
        model = self._models.get(model_id.lower())
        if not model:
            return {"success": False, "message": f"Unknown model '{model_id}'"}

        if checkpoint:
            model.checkpoint_path = checkpoint
        if device:
            model.device = device

        if enabled:
            success = model.load()
        else:
            model.is_loaded = False
            model.status = "UNCONFIGURED"
            model.status_detail = f"{model.name} was disabled by user."
            success = True

        cfg = load_models_config()
        if "models" not in cfg:
            cfg["models"] = {}
        cfg["models"][model_id] = {
            "name": model.name,
            "display_name": model.display_name,
            "description": model.description,
            "enabled": enabled,
            "checkpoint": model.checkpoint_path,
            "device": model.device,
            "supports_point_prompt": model.supports_point_prompt,
            "supports_box_prompt": model.supports_box_prompt,
            "supports_scribble_prompt": model.supports_scribble_prompt,
            "supports_mask_prompt": model.supports_mask_prompt,
            "supports_iterative_refinement": model.supports_iterative_refinement,
        }
        save_models_config(cfg)

        return {
            "success": success,
            "model": model.get_capabilities_dict()
        }

model_registry = ModelRegistry()
