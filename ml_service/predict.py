from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    state: str = "Karnataka"
    district: str
    city: str
    sub_city: str = "City Core"
    local_area: str = "Zone A"
    date: str | None = None
    day: int | None = Field(default=None, ge=1, le=31)
    hour: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2019, le=2100)
    is_weekend: bool
    is_holiday: bool
    season: str
    temperature_C: float
    humidity_pct: float
    solar_irradiance_Wm2: float
    wind_speed_kmh: float
    is_rainy: bool
    is_cloudy: bool
    peak_flag: bool
    prosumer_pct: float = Field(ge=0, le=1)
    household_count: int = Field(ge=1)
    lag_1h: float
    lag_24h: float
    lag_168h: float
    rolling_mean_24h: float
    sub_city_usage_kWh: float | None = None
    city_usage_kWh: float | None = None
    local_area_usage_kWh: float | None = None
    state_usage_kWh: float | None = None


class PredictResponse(BaseModel):
    forecasted_demand_kWh: float
    forecasted_solar_kWh: float
    forecasted_surplus_kWh: float
    confidence: float
    model_version: str


class HorizonPredictRequest(PredictRequest):
    horizon_hours: int = Field(default=6, ge=1, le=72)


class HourForecast(BaseModel):
    timestamp: str
    label: str
    hour_offset: int
    hour: int
    day: int
    month: int
    year: int
    temperature_C: float
    weather: str
    forecasted_demand_kWh: float
    forecasted_solar_kWh: float
    forecasted_surplus_kWh: float
    confidence: float
    usage_local_area_kWh: float
    usage_sub_city_kWh: float
    usage_city_kWh: float
    usage_state_kWh: float


class HorizonPredictResponse(BaseModel):
    horizon_hours: int
    state: str
    district: str
    city: str
    sub_city: str
    local_area: str
    forecasts: list[HourForecast]
    average_confidence: float
    model_version: str


@dataclass
class EncodedRequest:
    district_enc: int
    city_enc: int
    season_enc: int
    zone_type_enc: int
    state_enc: int
    sub_city_enc: int
    local_area_enc: int


ZONE_HINTS = {
    "Bangalore Urban": "urban",
    "Bangalore Rural": "semi-urban",
    "Mysuru": "urban",
    "Dakshina Kannada": "coastal",
    "Udupi": "coastal",
    "Uttara Kannada": "coastal",
    "Kodagu": "hill",
    "Chikkamagaluru": "hill",
}


def _safe_bucket(value: str) -> int:
    return abs(hash(value)) % 4096


def _safe_label_encode(encoder: Any, value: str) -> int:
    classes = getattr(encoder, "classes_", [])
    if value in classes:
        return int(encoder.transform([value])[0])
    if len(classes) == 0:
        return _safe_bucket(value)
    return int(np.argmin(np.abs(np.array([len(item) for item in classes]) - len(value))))


def _encode_value(encoders: Dict[str, Any], key: str, value: str) -> int:
    encoder = encoders.get(key)
    if encoder is None:
        return _safe_bucket(f"{key}:{value}")
    return _safe_label_encode(encoder, value)


def _resolve_datetime(request: PredictRequest) -> datetime:
    if request.date:
        date_part = datetime.fromisoformat(request.date)
    else:
        day = request.day if request.day is not None else 1
        date_part = datetime(request.year, request.month, day)
    return date_part.replace(hour=request.hour, minute=0, second=0, microsecond=0)


def _encode_request(request: PredictRequest, encoders: Dict[str, Any]) -> EncodedRequest:
    district_enc = _encode_value(encoders, "district", request.district)
    city_enc = _encode_value(encoders, "city", request.city)
    season_enc = _encode_value(encoders, "season", request.season)

    zone = ZONE_HINTS.get(request.district, "semi-urban")
    zone_type_enc = _encode_value(encoders, "zone_type", zone)
    state_enc = _encode_value(encoders, "state", request.state)
    sub_city_enc = _encode_value(encoders, "sub_city", request.sub_city)
    local_area_enc = _encode_value(encoders, "local_area", request.local_area)

    return EncodedRequest(
        district_enc=district_enc,
        city_enc=city_enc,
        season_enc=season_enc,
        zone_type_enc=zone_type_enc,
        state_enc=state_enc,
        sub_city_enc=sub_city_enc,
        local_area_enc=local_area_enc,
    )


def _weather_adjustment_factor(request: PredictRequest) -> float:
    factor = 1.0
    if request.temperature_C > 35:
        factor += 0.15
    if request.temperature_C > 40:
        factor += 0.10
    if request.is_rainy:
        factor -= 0.05
    if request.is_holiday:
        factor -= 0.10
    if request.peak_flag:
        factor += 0.20
    return max(0.5, round(factor, 3))


def _panel_efficiency(year: int) -> float:
    return max(0.15, 0.18 - (year - 2019) * 0.002)


def _align_frame_for_model(model: Any, frame: pd.DataFrame) -> pd.DataFrame:
    expected = list(getattr(model, "feature_names_in_", []))
    if not expected:
        return frame

    aligned = frame.copy()
    for column in expected:
        if column not in aligned.columns:
            aligned[column] = 0

    return aligned[expected]


def _usage_features(request: PredictRequest) -> Dict[str, float]:
    base_city_usage = (
        request.city_usage_kWh
        if request.city_usage_kWh is not None
        else request.rolling_mean_24h * request.household_count
    )
    base_sub_city_usage = (
        request.sub_city_usage_kWh
        if request.sub_city_usage_kWh is not None
        else base_city_usage * 0.38
    )
    base_local_area_usage = (
        request.local_area_usage_kWh
        if request.local_area_usage_kWh is not None
        else base_city_usage * 0.14
    )
    base_state_usage = (
        request.state_usage_kWh
        if request.state_usage_kWh is not None
        else base_city_usage * 31
    )

    return {
        "sub_city_usage_kWh": float(base_sub_city_usage),
        "city_usage_kWh": float(base_city_usage),
        "local_area_usage_kWh": float(base_local_area_usage),
        "state_usage_kWh": float(base_state_usage),
    }


def _build_feature_frame(request: PredictRequest, encoders: Dict[str, Any]) -> pd.DataFrame:
    encoded = _encode_request(request, encoders)
    resolved_dt = _resolve_datetime(request)
    usage = _usage_features(request)

    features = {
        "hour": request.hour,
        "day": request.day if request.day is not None else resolved_dt.day,
        "day_of_week": request.day_of_week,
        "month": request.month,
        "year": request.year,
        "date_ordinal": resolved_dt.toordinal(),
        "is_weekend": int(request.is_weekend),
        "is_holiday": int(request.is_holiday),
        "season_enc": encoded.season_enc,
        "temperature_C": request.temperature_C,
        "humidity_pct": request.humidity_pct,
        "solar_irradiance_Wm2": request.solar_irradiance_Wm2,
        "wind_speed_kmh": request.wind_speed_kmh,
        "is_rainy": int(request.is_rainy),
        "is_cloudy": int(request.is_cloudy),
        "weather_code": int(request.is_rainy) * 2 + int(request.is_cloudy),
        "peak_flag": int(request.peak_flag),
        "district_enc": encoded.district_enc,
        "city_enc": encoded.city_enc,
        "sub_city_enc": encoded.sub_city_enc,
        "local_area_enc": encoded.local_area_enc,
        "state_enc": encoded.state_enc,
        "zone_type_enc": encoded.zone_type_enc,
        "prosumer_pct": request.prosumer_pct,
        "household_count": request.household_count,
        "panel_efficiency": _panel_efficiency(request.year),
        "lag_1h": request.lag_1h,
        "lag_24h": request.lag_24h,
        "lag_168h": request.lag_168h,
        "rolling_mean_24h": request.rolling_mean_24h,
        "weather_adjustment_factor": _weather_adjustment_factor(request),
        "sub_city_usage_kWh": usage["sub_city_usage_kWh"],
        "city_usage_kWh": usage["city_usage_kWh"],
        "local_area_usage_kWh": usage["local_area_usage_kWh"],
        "state_usage_kWh": usage["state_usage_kWh"],
    }

    return pd.DataFrame([features])


def predict_energy(
    request: PredictRequest,
    models: Dict[str, Any],
    encoders: Dict[str, Any],
) -> PredictResponse:
    frame = _build_feature_frame(request, encoders)

    demand_frame = _align_frame_for_model(models["demand"], frame)
    solar_frame = _align_frame_for_model(models["solar"], frame)
    surplus_frame = _align_frame_for_model(models["surplus"], frame)

    demand = float(models["demand"].predict(demand_frame)[0])
    solar = float(models["solar"].predict(solar_frame)[0])
    surplus = float(models["surplus"].predict(surplus_frame)[0])

    confidence = max(0.35, min(0.96, 1 - abs(surplus) / max(demand + 1e-6, 1)))

    return PredictResponse(
        forecasted_demand_kWh=round(demand, 3),
        forecasted_solar_kWh=round(solar, 3),
        forecasted_surplus_kWh=round(surplus, 3),
        confidence=round(confidence, 3),
        model_version=f"xgb-v1-{datetime.utcnow().strftime('%Y%m%d')}",
    )


def _season_for_month(month: int) -> str:
    if 3 <= month <= 5:
        return "Summer"
    if 6 <= month <= 9:
        return "SW_Monsoon"
    if 10 <= month <= 11:
        return "NE_Monsoon"
    return "Winter"


def _weather_label(is_rainy: bool, is_cloudy: bool) -> str:
    if is_rainy and is_cloudy:
        return "Rainy / Cloudy"
    if is_rainy:
        return "Rainy"
    if is_cloudy:
        return "Cloudy"
    return "Clear"


def predict_horizon(
    request: HorizonPredictRequest,
    models: Dict[str, Any],
    encoders: Dict[str, Any],
) -> HorizonPredictResponse:
    base_dt = _resolve_datetime(request)

    demand_history_24 = [request.lag_24h] * 23 + [request.lag_1h]
    demand_history_168 = [request.lag_168h] * 167 + [request.lag_1h]

    forecasts: list[HourForecast] = []

    for offset in range(request.horizon_hours):
        dt = base_dt + timedelta(hours=offset)

        lag_1h = demand_history_24[-1]
        lag_24h = demand_history_24[-24] if len(demand_history_24) >= 24 else request.lag_24h
        lag_168h = demand_history_168[-168] if len(demand_history_168) >= 168 else request.lag_168h
        rolling_mean_24h = float(np.mean(demand_history_24[-24:]))

        step_request = request.model_copy(
            update={
                "date": dt.date().isoformat(),
                "day": dt.day,
                "hour": dt.hour,
                "day_of_week": dt.weekday(),
                "month": dt.month,
                "year": dt.year,
                "is_weekend": dt.weekday() >= 5,
                "season": _season_for_month(dt.month),
                "peak_flag": dt.hour in [6, 7, 8, 19, 20, 21, 22],
                "lag_1h": lag_1h,
                "lag_24h": lag_24h,
                "lag_168h": lag_168h,
                "rolling_mean_24h": rolling_mean_24h,
            }
        )

        point = predict_energy(step_request, models, encoders)

        usage_city = max(point.forecasted_demand_kWh, step_request.city_usage_kWh or 0)
        usage_sub_city = step_request.sub_city_usage_kWh or usage_city * 0.38
        usage_local_area = step_request.local_area_usage_kWh or usage_city * 0.14
        usage_state = step_request.state_usage_kWh or usage_city * 31

        forecasts.append(
            HourForecast(
                timestamp=dt.isoformat(),
                label=dt.strftime("%d %b %H:00"),
                hour_offset=offset,
                hour=dt.hour,
                day=dt.day,
                month=dt.month,
                year=dt.year,
                temperature_C=round(step_request.temperature_C, 2),
                weather=_weather_label(step_request.is_rainy, step_request.is_cloudy),
                forecasted_demand_kWh=point.forecasted_demand_kWh,
                forecasted_solar_kWh=point.forecasted_solar_kWh,
                forecasted_surplus_kWh=point.forecasted_surplus_kWh,
                confidence=point.confidence,
                usage_local_area_kWh=round(usage_local_area, 3),
                usage_sub_city_kWh=round(usage_sub_city, 3),
                usage_city_kWh=round(usage_city, 3),
                usage_state_kWh=round(usage_state, 3),
            )
        )

        demand_history_24.append(point.forecasted_demand_kWh)
        demand_history_168.append(point.forecasted_demand_kWh)

    average_confidence = float(np.mean([point.confidence for point in forecasts])) if forecasts else 0.0

    return HorizonPredictResponse(
        horizon_hours=request.horizon_hours,
        state=request.state,
        district=request.district,
        city=request.city,
        sub_city=request.sub_city,
        local_area=request.local_area,
        forecasts=forecasts,
        average_confidence=round(average_confidence, 3),
        model_version=f"xgb-v1-{datetime.utcnow().strftime('%Y%m%d')}",
    )
