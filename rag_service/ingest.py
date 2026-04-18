import os
import time
from pathlib import Path
from typing import List

import pandas as pd
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings


DEFAULT_INGEST_MAX_ROWS = 500_000
DEFAULT_MAX_DOCS = 2_500
DEFAULT_EMBED_BATCH_SIZE = 128


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


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


def ingest_to_faiss(data_path: Path, vectorstore_dir: Path, google_api_key: str) -> FAISS:
    if not data_path.exists():
        raise FileNotFoundError(f"Data file not found: {data_path}")

    max_rows = _env_int("GRIDWISE_INGEST_MAX_ROWS", DEFAULT_INGEST_MAX_ROWS)
    max_docs = _env_int("GRIDWISE_MAX_DOCS", DEFAULT_MAX_DOCS)
    embed_batch_size = max(1, _env_int("GRIDWISE_EMBED_BATCH_SIZE", DEFAULT_EMBED_BATCH_SIZE))

    read_kwargs = {
        "usecols": [
            "timestamp",
            "district",
            "city",
            "adjusted_demand_kWh",
            "grid_surplus_kWh",
            "solar_generation_kWh",
            "hour",
        ]
    }
    if max_rows > 0:
        read_kwargs["nrows"] = max_rows

    print(f"[RAG] Reading data from {data_path}")
    if max_rows > 0:
        print(f"[RAG] Applying ingest row cap: {max_rows} rows")
    read_start = time.perf_counter()
    df = pd.read_csv(data_path, **read_kwargs)
    print(f"[RAG] Loaded rows: {len(df)} in {time.perf_counter() - read_start:.1f}s")

    docs_start = time.perf_counter()
    docs = build_documents(df)
    print(f"[RAG] Built summary docs: {len(docs)} in {time.perf_counter() - docs_start:.1f}s")

    if max_docs > 0 and len(docs) > max_docs:
        print(f"[RAG] Limiting docs for embedding: {len(docs)} -> {max_docs}")
        docs = docs[-max_docs:]

    if not docs:
        raise RuntimeError("No documents generated for FAISS ingestion")

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/embedding-001",
        google_api_key=google_api_key,
    )

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

    return vectorstore
