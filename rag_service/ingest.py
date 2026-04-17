from pathlib import Path
from typing import List

import pandas as pd
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings


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

    df = pd.read_csv(data_path)
    docs = build_documents(df)

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/embedding-001",
        google_api_key=google_api_key,
    )

    vectorstore = FAISS.from_texts(docs, embedding=embeddings)
    vectorstore_dir.mkdir(parents=True, exist_ok=True)
    vectorstore.save_local(str(vectorstore_dir))

    return vectorstore
