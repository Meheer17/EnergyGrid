import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List

import pandas as pd
from langchain_community.vectorstores import FAISS
from langchain_core.embeddings import Embeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings


DEFAULT_INGEST_MAX_ROWS = 500_000_000
DEFAULT_MAX_DOCS = 200_500_000_000_000
DEFAULT_EMBED_BATCH_SIZE = 512
DEFAULT_EMBEDDING_PROVIDER = "google"
DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_OLLAMA_EMBED_MODEL = "nomic-embed-text"

INGEST_USECOLS = [
    "timestamp",
    "district",
    "city",
    "adjusted_demand_kWh",
    "grid_surplus_kWh",
    "solar_generation_kWh",
    "hour",
]


class SerialOllamaEmbeddings(Embeddings):
    """Run Ollama embeddings via direct HTTP API calls.

    This avoids client-library behavior differences across Ollama versions.
    """

    def __init__(self, model: str, base_url: str):
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout_sec = max(5, _env_int("OLLAMA_EMBED_TIMEOUT_SEC", 120))

    def _post_json(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base_url}{endpoint}"
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(request, timeout=self._timeout_sec) as response:
            body = response.read().decode("utf-8")
            payload = json.loads(body) if body else {}
            if not isinstance(payload, dict):
                raise RuntimeError(f"Unexpected Ollama response type from {endpoint}")
            return payload

    @staticmethod
    def _extract_embed_vector(payload: dict[str, Any], endpoint: str) -> list[float]:
        # /api/embed returns embeddings (list[list[float]])
        if endpoint == "/api/embed":
            embeddings = payload.get("embeddings")
            if isinstance(embeddings, list) and embeddings:
                first = embeddings[0]
                if isinstance(first, list):
                    return [float(v) for v in first]
                if isinstance(first, (int, float)):
                    return [float(v) for v in embeddings]

        # /api/embeddings returns embedding (list[float])
        embedding = payload.get("embedding")
        if isinstance(embedding, list):
            return [float(v) for v in embedding]

        raise RuntimeError(f"Embedding vector not found in Ollama response from {endpoint}")

    def _embed_single(self, text: str) -> list[float]:
        # Prefer modern endpoint and fallback to older endpoint.
        errors: list[str] = []
        attempts = [
            ("/api/embed", {"model": self._model, "input": text}),
            ("/api/embeddings", {"model": self._model, "prompt": text}),
        ]

        for endpoint, payload in attempts:
            try:
                response_payload = self._post_json(endpoint, payload)
                return self._extract_embed_vector(response_payload, endpoint)
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="ignore") if exc.fp else ""
                errors.append(f"{endpoint} -> HTTP {exc.code}: {body}")
            except Exception as exc:
                errors.append(f"{endpoint} -> {exc}")

        raise RuntimeError("; ".join(errors))

    def embed_query(self, text: str) -> list[float]:
        return self._embed_single(text)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        vectors: List[List[float]] = []
        total = len(texts)
        for idx, text in enumerate(texts, start=1):
            try:
                vectors.append(self._embed_single(text))
            except Exception as exc:
                raise RuntimeError(
                    f"Ollama embedding failed at item {idx}/{total}: {exc}"
                ) from exc
        return vectors


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _embedding_meta_path(vectorstore_dir: Path) -> Path:
    return vectorstore_dir / "embedding_meta.json"


def get_embedding_config() -> dict[str, str]:
    provider = os.getenv("GRIDWISE_EMBEDDING_PROVIDER", DEFAULT_EMBEDDING_PROVIDER).strip().lower()
    if provider not in {"google", "ollama"}:
        raise RuntimeError(
            "Unsupported GRIDWISE_EMBEDDING_PROVIDER. Use 'google' or 'ollama'."
        )

    if provider == "ollama":
        model = os.getenv("OLLAMA_EMBED_MODEL", DEFAULT_OLLAMA_EMBED_MODEL).strip()
        base_url = os.getenv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).strip()
        return {
            "provider": "ollama",
            "model": model or DEFAULT_OLLAMA_EMBED_MODEL,
            "base_url": base_url or DEFAULT_OLLAMA_BASE_URL,
        }

    return {
        "provider": "google",
        "model": "models/embedding-001",
        "base_url": "",
    }


def build_embeddings(google_api_key: str):
    embedding_config = get_embedding_config()
    if embedding_config["provider"] == "ollama":
        return (
            SerialOllamaEmbeddings(
                model=embedding_config["model"],
                base_url=embedding_config["base_url"],
            ),
            embedding_config,
        )

    if not google_api_key:
        raise RuntimeError("GOOGLE_AI_API_KEY is not configured")

    return (
        GoogleGenerativeAIEmbeddings(
            model=embedding_config["model"],
            google_api_key=google_api_key,
        ),
        embedding_config,
    )


def load_embedding_meta(vectorstore_dir: Path) -> dict[str, Any] | None:
    meta_path = _embedding_meta_path(vectorstore_dir)
    if not meta_path.exists():
        return None

    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            return payload
    except Exception:
        return None

    return None


def embedding_meta_matches(vectorstore_dir: Path, embedding_config: dict[str, str]) -> bool:
    existing_meta = load_embedding_meta(vectorstore_dir)
    if existing_meta is None:
        return False

    return (
        existing_meta.get("provider") == embedding_config["provider"]
        and existing_meta.get("model") == embedding_config["model"]
        and existing_meta.get("base_url", "") == embedding_config.get("base_url", "")
    )


def save_embedding_meta(
    vectorstore_dir: Path,
    embedding_config: dict[str, str],
    docs_indexed: int,
) -> None:
    payload = {
        "provider": embedding_config["provider"],
        "model": embedding_config["model"],
        "base_url": embedding_config.get("base_url", ""),
        "docs_indexed": docs_indexed,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _embedding_meta_path(vectorstore_dir).write_text(
        json.dumps(payload, indent=2),
        encoding="utf-8",
    )


def build_documents(df: pd.DataFrame) -> List[str]:
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["week_start"] = df["timestamp"].dt.to_period("W").apply(lambda p: p.start_time)

    summary = (
        df.groupby(["district", "city", "week_start"], as_index=False)
        .agg(
            avg_demand=("adjusted_demand_kWh", "mean"),
            avg_surplus=("grid_surplus_kWh", "mean"),
            avg_solar=("solar_generation_kWh", "mean"),
            peak_hour=("hour", lambda s: int(s.value_counts().idxmax())),
            anomaly_count=("grid_surplus_kWh", lambda s: int((s < -50).sum())),
        )
        .sort_values("week_start")
    )

    docs: List[str] = []
    for row in summary.itertuples(index=False):
        docs.append(
            (
                f"In the week of {row.week_start:%Y-%m-%d}, {row.city} ({row.district}) had an average demand "
                f"of {row.avg_demand:.2f} kWh, solar generation of {row.avg_solar:.2f} kWh, and a surplus "
                f"of {row.avg_surplus:.2f} kWh. Peak demand occurred at {row.peak_hour}:00. "
                f"Anomalies detected: {row.anomaly_count}."
            )
        )

    return docs


def _read_ingest_csv(csv_path: Path, remaining_rows: int | None = None) -> pd.DataFrame:
    read_kwargs: dict[str, Any] = {"usecols": INGEST_USECOLS}
    if remaining_rows is not None and remaining_rows > 0:
        read_kwargs["nrows"] = remaining_rows
    return pd.read_csv(csv_path, **read_kwargs)


def _load_ingest_dataframe(data_path: Path, max_rows: int) -> pd.DataFrame:
    if data_path.is_file():
        limit = max_rows if max_rows > 0 else None
        return _read_ingest_csv(data_path, limit)

    if data_path.is_dir():
        csv_files = sorted(data_path.glob("*.csv"))
        if not csv_files:
            raise FileNotFoundError(f"No CSV files found in directory: {data_path}")

        frames: List[pd.DataFrame] = []
        remaining = max_rows if max_rows > 0 else None

        for csv_file in csv_files:
            if remaining is not None and remaining <= 0:
                break

            frame = _read_ingest_csv(csv_file, remaining)
            if frame.empty:
                continue

            frames.append(frame)
            if remaining is not None:
                remaining -= len(frame)

        if not frames:
            raise RuntimeError(f"No rows loaded from CSV directory: {data_path}")

        return pd.concat(frames, ignore_index=True)

    raise FileNotFoundError(f"Data file not found: {data_path}")


def ingest_to_faiss(data_path: Path, vectorstore_dir: Path, google_api_key: str) -> FAISS:
    if not data_path.exists():
        raise FileNotFoundError(f"Data file not found: {data_path}")

    max_rows = _env_int("GRIDWISE_INGEST_MAX_ROWS", DEFAULT_INGEST_MAX_ROWS)
    max_docs = _env_int("GRIDWISE_MAX_DOCS", DEFAULT_MAX_DOCS)
    embed_batch_size = max(1, _env_int("GRIDWISE_EMBED_BATCH_SIZE", DEFAULT_EMBED_BATCH_SIZE))

    print(f"[RAG] Reading data from {data_path}")
    if max_rows > 0:
        print(f"[RAG] Applying ingest row cap: {max_rows} rows")
    read_start = time.perf_counter()
    df = _load_ingest_dataframe(data_path, max_rows)
    print(f"[RAG] Loaded rows: {len(df)} in {time.perf_counter() - read_start:.1f}s")

    docs_start = time.perf_counter()
    docs = build_documents(df)
    print(f"[RAG] Built summary docs: {len(docs)} in {time.perf_counter() - docs_start:.1f}s")

    if max_docs > 0 and len(docs) > max_docs:
        print(f"[RAG] Limiting docs for embedding: {len(docs)} -> {max_docs}")
        docs = docs[-max_docs:]

    if not docs:
        raise RuntimeError("No documents generated for FAISS ingestion")

    embeddings, embedding_config = build_embeddings(google_api_key)
    print(
        f"[RAG] Embedding provider: {embedding_config['provider']} "
        f"({embedding_config['model']})"
    )
    if embedding_config["provider"] == "ollama":
        print(f"[RAG] Ollama base URL: {embedding_config['base_url']}")

    print(f"[RAG] Building FAISS index in batches of {embed_batch_size}")
    vectorstore_dir.mkdir(parents=True, exist_ok=True)

    build_start = time.perf_counter()
    first_batch = docs[:embed_batch_size]
    vectorstore = FAISS.from_texts(first_batch, embedding=embeddings)
    vectorstore.save_local(str(vectorstore_dir))
    print(f"[RAG] Indexed {len(first_batch)}/{len(docs)} docs")

    processed = len(first_batch)
    for start in range(embed_batch_size, len(docs), embed_batch_size):
        batch = docs[start : start + embed_batch_size]
        vectorstore.add_texts(batch)
        processed += len(batch)

        # Persist progress so index files appear quickly and survive interruptions.
        if processed == len(docs) or (processed // embed_batch_size) % 5 == 0:
            vectorstore.save_local(str(vectorstore_dir))
            print(f"[RAG] Indexed {processed}/{len(docs)} docs")

    print(f"[RAG] FAISS build time: {time.perf_counter() - build_start:.1f}s")
    print(f"[RAG] Saved FAISS index to {vectorstore_dir}")
    save_embedding_meta(vectorstore_dir, embedding_config, len(docs))
    print("[RAG] Saved embedding metadata")

    return vectorstore
