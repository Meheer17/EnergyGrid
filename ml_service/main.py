from fastapi import FastAPI, HTTPException

from model_loader import ModelLoadError, load_models
from predict import HorizonPredictRequest, PredictRequest, predict_energy, predict_horizon

app = FastAPI(title="GridWise ML Service")

try:
    MODELS, ENCODERS = load_models()
    MODEL_STATE = "ready"
except ModelLoadError as exc:
    MODELS, ENCODERS = {}, {}
    MODEL_STATE = f"error: {exc}"


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_state": MODEL_STATE, "model_version": "v1.0"}


@app.post("/predict")
def predict(request: PredictRequest) -> dict:
    if not MODELS:
        raise HTTPException(status_code=503, detail="Models are not loaded")

    result = predict_energy(request, MODELS, ENCODERS)
    return result.model_dump()


@app.post("/predict/horizon")
def predict_horizon_endpoint(request: HorizonPredictRequest) -> dict:
    if not MODELS:
        raise HTTPException(status_code=503, detail="Models are not loaded")

    result = predict_horizon(request, MODELS, ENCODERS)
    return result.model_dump()
