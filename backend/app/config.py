import os
from pathlib import Path
import yaml
try:
    import torch
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
except ImportError:
    DEVICE = "cpu"

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
RESULTS_DIR = BASE_DIR / "results"
DATASETS_DIR = BASE_DIR / "datasets"
WEIGHTS_DIR = BASE_DIR / "weights"
CONFIG_FILE = BASE_DIR / "models.yaml"

# Ensure directories exist
for directory in [UPLOADS_DIR, RESULTS_DIR, DATASETS_DIR, WEIGHTS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

def load_models_config() -> dict:
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {"models": {}}
    return {"models": {}}

def save_models_config(config: dict) -> None:
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        yaml.safe_dump(config, f, sort_keys=False)
