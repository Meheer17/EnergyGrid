from __future__ import annotations

import os
from pathlib import Path
from typing import Dict

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBRegressor


DEFAULT_PARAMS = {
    "n_estimators": 800,
    "max_depth": 7,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 3,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0,
    "random_state": 42,
    "n_jobs": -1,
}


def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    eps = 1e-6
    return float(np.mean(np.abs((y_true - y_pred) / np.maximum(np.abs(y_true), eps))) * 100)


def ensure_geo_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    if "state" not in out.columns:
        out["state"] = "Karnataka"

    if "sub_city" not in out.columns:
        slot = np.where(
            out["hour"] < 8,
            "Core",
            np.where(out["hour"] < 16, "East Cluster", "West Cluster"),
        )
        out["sub_city"] = out["city"].astype(str) + " " + slot

    if "local_area" not in out.columns:
        area_idx = (out["day"].astype(int) % 4) + 1
        out["local_area"] = out["city"].astype(str) + " Area " + area_idx.astype(str)

    return out


def ensure_usage_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    if "city_usage_kWh" not in out.columns:
        out["city_usage_kWh"] = out["adjusted_demand_kWh"]

    if "sub_city_usage_kWh" not in out.columns:
        out["sub_city_usage_kWh"] = out["city_usage_kWh"] * 0.38

    if "local_area_usage_kWh" not in out.columns:
        out["local_area_usage_kWh"] = out["city_usage_kWh"] * 0.14

    if "state_usage_kWh" not in out.columns:
        out["state_usage_kWh"] = out.groupby("timestamp")["adjusted_demand_kWh"].transform("sum")

    return out


def feature_engineering(df: pd.DataFrame) -> tuple[pd.DataFrame, Dict[str, LabelEncoder], list[str]]:
    out = df.copy()
    out["timestamp"] = pd.to_datetime(out["timestamp"])
    out = out.sort_values("timestamp").reset_index(drop=True)

    out = ensure_geo_columns(out)
    out = ensure_usage_columns(out)

    out["date"] = out["timestamp"].dt.date.astype(str)
    out["date_ordinal"] = out["timestamp"].map(pd.Timestamp.toordinal)

    encoders: Dict[str, LabelEncoder] = {}
    encode_cols = [
        "state",
        "district",
        "city",
        "sub_city",
        "local_area",
        "season",
        "zone_type",
    ]

    for col in encode_cols:
        le = LabelEncoder()
        out[f"{col}_enc"] = le.fit_transform(out[col].astype(str))
        encoders[col] = le

    group_cols = ["state", "district", "city", "sub_city", "local_area"]
    out["lag_1h"] = out.groupby(group_cols)["adjusted_demand_kWh"].shift(1)
    out["lag_24h"] = out.groupby(group_cols)["adjusted_demand_kWh"].shift(24)
    out["lag_168h"] = out.groupby(group_cols)["adjusted_demand_kWh"].shift(168)

    out["rolling_mean_24h"] = (
        out.groupby(group_cols)["adjusted_demand_kWh"]
        .rolling(window=24, min_periods=1)
        .mean()
        .reset_index(level=list(range(len(group_cols))), drop=True)
    )

    out = out.dropna(subset=["lag_1h", "lag_24h", "lag_168h", "rolling_mean_24h"]).copy()

    feature_cols = [
        "date_ordinal",
        "day",
        "hour",
        "day_of_week",
        "month",
        "year",
        "is_weekend",
        "is_holiday",
        "temperature_C",
        "humidity_pct",
        "solar_irradiance_Wm2",
        "wind_speed_kmh",
        "is_rainy",
        "is_cloudy",
        "peak_flag",
        "season_enc",
        "zone_type_enc",
        "state_enc",
        "district_enc",
        "city_enc",
        "sub_city_enc",
        "local_area_enc",
        "sub_city_usage_kWh",
        "city_usage_kWh",
        "local_area_usage_kWh",
        "state_usage_kWh",
        "prosumer_pct",
        "household_count",
        "panel_efficiency",
        "lag_1h",
        "lag_24h",
        "lag_168h",
        "rolling_mean_24h",
        "weather_adjustment_factor",
    ]

    return out, encoders, feature_cols


def train_models(df: pd.DataFrame, feature_cols: list[str]) -> tuple[dict, dict, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    targets = {
        "demand": "adjusted_demand_kWh",
        "solar": "solar_generation_kWh",
        "surplus": "grid_surplus_kWh",
    }

    train_mask = df["year"].between(2019, 2022)
    val_mask = df["year"] == 2023
    test_mask = df["year"] == 2024

    X_train = df.loc[train_mask, feature_cols]
    X_val = df.loc[val_mask, feature_cols]
    X_test = df.loc[test_mask, feature_cols]

    models: dict[str, XGBRegressor] = {}
    metrics: dict[str, dict[str, float]] = {}

    for name, target in targets.items():
        model = XGBRegressor(**DEFAULT_PARAMS)
        model.fit(X_train, df.loc[train_mask, target], eval_set=[(X_val, df.loc[val_mask, target])], verbose=False)

        preds = model.predict(X_test)
        y_true = df.loc[test_mask, target].to_numpy()

        metrics[name] = {
            "mae": float(mean_absolute_error(y_true, preds)),
            "rmse": float(np.sqrt(mean_squared_error(y_true, preds))),
            "mape": mape(y_true, preds),
        }
        models[name] = model

    return models, metrics, X_train, X_val, X_test


def predict_next_hours(
    context_row: pd.Series,
    models: dict[str, XGBRegressor],
    feature_cols: list[str],
    hours: int = 6,
) -> pd.DataFrame:
    base_timestamp = pd.to_datetime(context_row["timestamp"])

    lag_1h = float(context_row["lag_1h"])
    lag_24h = float(context_row["lag_24h"])
    lag_168h = float(context_row["lag_168h"])
    rolling_mean = float(context_row["rolling_mean_24h"])

    points: list[dict[str, float | str | int]] = []

    for offset in range(hours):
        dt = base_timestamp + pd.Timedelta(hours=offset)
        row = context_row.copy()

        row["date_ordinal"] = dt.toordinal()
        row["day"] = dt.day
        row["hour"] = dt.hour
        row["day_of_week"] = dt.weekday()
        row["month"] = dt.month
        row["year"] = dt.year
        row["is_weekend"] = int(dt.weekday() >= 5)
        row["peak_flag"] = int(dt.hour in [6, 7, 8, 19, 20, 21, 22])

        row["lag_1h"] = lag_1h
        row["lag_24h"] = lag_24h
        row["lag_168h"] = lag_168h
        row["rolling_mean_24h"] = rolling_mean

        feature_frame = pd.DataFrame([row[feature_cols]])
        pred_demand = float(models["demand"].predict(feature_frame)[0])
        pred_solar = float(models["solar"].predict(feature_frame)[0])
        pred_surplus = float(models["surplus"].predict(feature_frame)[0])

        points.append(
            {
                "timestamp": dt.isoformat(),
                "hour": int(dt.hour),
                "day": int(dt.day),
                "month": int(dt.month),
                "year": int(dt.year),
                "pred_demand": round(pred_demand, 3),
                "pred_solar": round(pred_solar, 3),
                "pred_surplus": round(pred_surplus, 3),
            }
        )

        lag_168h = lag_24h
        lag_24h = lag_1h
        lag_1h = pred_demand
        rolling_mean = (rolling_mean * 23 + pred_demand) / 24

    return pd.DataFrame(points)


def resolve_training_data_path(root: Path) -> Path:
    configured = os.getenv("GRIDWISE_TRAIN_DATA_PATH", "").strip()
    if configured:
        configured_path = Path(configured).expanduser()
        return configured_path if configured_path.is_absolute() else (root / configured_path)

    candidates = [
        root / "colab" / "karnataka_energy_2019_2024.csv",
        root / "data" / "karnataka_energy_2019_2024.csv",
        root / "gridwise" / "data" / "karnataka_energy_2019_2024.csv",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


def resolve_model_dir(root: Path) -> Path:
    configured = os.getenv("GRIDWISE_MODEL_DIR", "").strip()
    if configured:
        configured_path = Path(configured).expanduser()
        return configured_path if configured_path.is_absolute() else (root / configured_path)
    return root / "ml_service" / "models"


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    data_path = resolve_training_data_path(root)
    model_dir = resolve_model_dir(root)
    model_dir.mkdir(parents=True, exist_ok=True)

    if not data_path.exists():
        raise FileNotFoundError(f"Data file not found: {data_path}")

    print(f"Loading training data from: {data_path}")
    raw = pd.read_csv(data_path)

    df, encoders, feature_cols = feature_engineering(raw)
    models, metrics, _, _, X_test = train_models(df, feature_cols)

    print("\nModel evaluation (test split 2024):")
    for target, target_metrics in metrics.items():
        print(
            f"- {target}: MAE={target_metrics['mae']:.4f}, "
            f"RMSE={target_metrics['rmse']:.4f}, MAPE={target_metrics['mape']:.2f}%"
        )

    sample_context = df.loc[X_test.index[0]]
    next_hours = predict_next_hours(sample_context, models, feature_cols, hours=6)

    print("\nSample 6-hour ahead predictions:")
    print(next_hours)

    joblib.dump(models["demand"], model_dir / "gridwise_xgb_demand.pkl")
    joblib.dump(models["solar"], model_dir / "gridwise_xgb_solar.pkl")
    joblib.dump(models["surplus"], model_dir / "gridwise_xgb_surplus.pkl")
    joblib.dump(encoders, model_dir / "encoders.pkl")

    print(f"\nSaved models and encoders to: {model_dir}")


if __name__ == "__main__":
    main()
