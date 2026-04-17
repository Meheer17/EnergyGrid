from pathlib import Path
from typing import Any, Dict, Tuple

import joblib


MODEL_FILENAMES = {
    "demand": ["gridwise_xgb_demand.pkl", "gridwise_xgb.pkl"],
    "solar": ["gridwise_xgb_solar.pkl"],
    "surplus": ["gridwise_xgb_surplus.pkl"],
}


class ModelLoadError(RuntimeError):
    pass


def _load_first_existing(base_dir: Path, filenames: list[str]) -> Any:
    for filename in filenames:
        candidate = base_dir / filename
        if candidate.exists():
            return joblib.load(candidate)
    raise ModelLoadError(
        f"None of the model files exist in {base_dir}: {', '.join(filenames)}"
    )


def load_models() -> Tuple[Dict[str, Any], Dict[str, Any]]:
    root = Path(__file__).resolve().parent
    model_dir = Path((root / "models")).resolve()
    encoders_path = model_dir / "encoders.pkl"

    models = {
        key: _load_first_existing(model_dir, filenames)
        for key, filenames in MODEL_FILENAMES.items()
    }

    if not encoders_path.exists():
        raise ModelLoadError(
            f"Encoder file not found at {encoders_path}. Copy encoders.pkl from Colab output."
        )

    encoders = joblib.load(encoders_path)
    return models, encoders
