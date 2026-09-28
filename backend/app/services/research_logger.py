import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.config import RESULTS_DIR

EXPERIMENTS_DIR = RESULTS_DIR / "experiments"
EXPERIMENTS_DIR.mkdir(parents=True, exist_ok=True)

class ResearchLogger:
    @staticmethod
    def log_experiment(data: Dict[str, Any]) -> str:
        """
        Saves structured research benchmark log for reproducibility.
        """
        exp_id = f"exp_{int(time.time()*1000)}"
        timestamp_str = datetime.now().isoformat()

        record = {
            "experiment_id": exp_id,
            "timestamp": timestamp_str,
            **data
        }

        file_path = EXPERIMENTS_DIR / f"{exp_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2)

        return exp_id

    @staticmethod
    def get_experiment_logs(limit: int = 50) -> List[Dict[str, Any]]:
        logs = []
        files = sorted(EXPERIMENTS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True)
        for f in files[:limit]:
            try:
                with open(f, "r", encoding="utf-8") as fp:
                    logs.append(json.load(fp))
            except Exception:
                continue
        return logs

    @staticmethod
    def get_experiment_by_id(exp_id: str) -> Optional[Dict[str, Any]]:
        file_path = EXPERIMENTS_DIR / f"{exp_id}.json"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as fp:
                return json.load(fp)
        return None
