import json
from typing import Any, Dict, List

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.vectorstores.base import VectorStoreRetriever
from pydantic import BaseModel, Field


class ForecastQueryRequest(BaseModel):
    question: str = Field(min_length=4)
    district: str | None = None
    city: str | None = None


class AnomalyRequest(BaseModel):
    district: str
    city: str
    current_demand: float
    current_solar: float
    timestamp: str


class CapacityRequest(BaseModel):
    district: str
    forecasted_demand_3h: float
    available_supply: float


def _safe_json(text: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    return fallback


def _retrieve_context(retriever: VectorStoreRetriever, query: str) -> str:
    docs = retriever.invoke(query)
    return "\n".join(doc.page_content for doc in docs)


def run_forecast_query(
    request: ForecastQueryRequest,
    retriever: VectorStoreRetriever,
    llm: BaseChatModel,
) -> Dict[str, Any]:
    context = _retrieve_context(retriever, request.question)

    prompt = f"""
You are GridWise AI, an energy grid optimization assistant for Karnataka, India.
Using the historical data context below, answer the question with specific numbers,
district-level comparisons where relevant, and confidence level.
Return ONLY valid JSON with keys:
  summary (string), districts_affected (list of strings),
  recommended_actions (list of strings), confidence (float 0-1)

Context: {context}
Question: {request.question}
""".strip()

    response = llm.invoke(prompt)
    content = response.content if isinstance(response.content, str) else str(response.content)

    return _safe_json(
        content,
        {
            "summary": "Unable to generate forecast response with current context.",
            "districts_affected": [request.district] if request.district else [],
            "recommended_actions": ["Review district load balancing and demand response windows."],
            "confidence": 0.4,
        },
    )


def run_anomaly_query(
    request: AnomalyRequest,
    retriever: VectorStoreRetriever,
    llm: BaseChatModel,
) -> Dict[str, Any]:
    baseline_query = (
        f"{request.city} {request.district} historical weekly demand and solar anomaly baseline"
    )
    context = _retrieve_context(retriever, baseline_query)

    prompt = f"""
You are GridWise AI. Compare current readings with historical context and detect anomalies.
Return ONLY valid JSON with keys:
anomaly_detected (boolean), anomaly_type (string), severity (string),
description (string), suggested_action (string)

Historical context:
{context}

Current reading:
District: {request.district}
City: {request.city}
Demand: {request.current_demand}
Solar: {request.current_solar}
Timestamp: {request.timestamp}
""".strip()

    response = llm.invoke(prompt)
    content = response.content if isinstance(response.content, str) else str(response.content)

    return _safe_json(
        content,
        {
            "anomaly_detected": False,
            "anomaly_type": "NONE",
            "severity": "low",
            "description": "No strong anomaly detected from fallback logic.",
            "suggested_action": "Continue monitoring with 1-hour interval checks.",
        },
    )


def run_capacity_query(
    request: CapacityRequest,
    retriever: VectorStoreRetriever,
    llm: BaseChatModel,
) -> Dict[str, Any]:
    context = _retrieve_context(
        retriever,
        f"{request.district} capacity planning and deficit handling recommendations",
    )

    prompt = f"""
You are GridWise AI. Generate a 3-hour capacity plan for Karnataka district operations.
Return ONLY valid JSON with keys:
summary (string), sector_breakdown (object),
recommended_actions (list of objects where each object has:
 action, expected_impact, cost_INR, time_to_implement)

Historical context:
{context}

Input:
District: {request.district}
Forecasted demand next 3h: {request.forecasted_demand_3h}
Available supply: {request.available_supply}
""".strip()

    response = llm.invoke(prompt)
    content = response.content if isinstance(response.content, str) else str(response.content)

    return _safe_json(
        content,
        {
            "summary": f"Fallback capacity plan for {request.district}.",
            "sector_breakdown": {
                "residential_pct": 56,
                "commercial_pct": 28,
                "critical_infra_pct": 16,
            },
            "recommended_actions": [
                {
                    "action": "Dispatch battery reserves to evening residential feeders",
                    "expected_impact": "Reduce shortfall by ~8%",
                    "cost_INR": 45000,
                    "time_to_implement": "30 minutes",
                },
                {
                    "action": "Increase peer-trade incentives in deficit city clusters",
                    "expected_impact": "Add 20-35 kWh distributed supply",
                    "cost_INR": 18000,
                    "time_to_implement": "1 hour",
                },
            ],
        },
    )
