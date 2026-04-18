import asyncio
import os
import threading
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.vectorstores import FAISS
from langchain_google_genai import ChatGoogleGenerativeAI

from ingest import (
    build_embeddings,
    embedding_meta_matches,
    get_embedding_config,
    ingest_to_faiss,
)
from query import (
    AnomalyRequest,
    CapacityRequest,
    ForecastQueryRequest,
    run_anomaly_query,
    run_capacity_query,
    run_forecast_query,
)

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent

# Load env in a non-destructive order so local service overrides can still win.
for env_candidate in [
    REPO_ROOT / ".env",
    REPO_ROOT / "gridwise" / ".env",
    ROOT / ".env",
]:
    if env_candidate.exists():
        load_dotenv(env_candidate, override=False)

app = FastAPI(title="GridWise RAG Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _resolve_data_path() -> Path:
    configured = os.getenv("GRIDWISE_DATA_PATH", "").strip()
    if configured:
        configured_path = Path(configured).expanduser()
        return configured_path if configured_path.is_absolute() else (REPO_ROOT / configured_path)

    candidates = [
        REPO_ROOT / "colab" / "karnataka_energy_2019_2024.csv",
        REPO_ROOT / "data" / "karnataka_energy_2019_2024.csv",
        REPO_ROOT / "gridwise" / "data" / "karnataka_energy_2019_2024.csv",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


def _resolve_vectorstore_dir() -> Path:
    configured = os.getenv("VECTORSTORE_DIR", "").strip()
    if configured:
        configured_path = Path(configured).expanduser()
        return configured_path if configured_path.is_absolute() else (ROOT / configured_path)
    return ROOT / "vectorstore"


DATA_PATH = _resolve_data_path()
VECTORSTORE_DIR = _resolve_vectorstore_dir()
GOOGLE_API_KEY = os.getenv("GOOGLE_AI_API_KEY", "").strip()

VECTORSTORE = None
RETRIEVER = None
INIT_STATUS = "not_started"
INIT_ERROR = ""


def _load_or_ingest_vectorstore() -> FAISS:
    embedding_config = get_embedding_config()

    index_file = VECTORSTORE_DIR / "index.faiss"
    store_file = VECTORSTORE_DIR / "index.pkl"

    if (
        index_file.exists()
        and store_file.exists()
        and embedding_meta_matches(VECTORSTORE_DIR, embedding_config)
    ):
        embeddings, _ = build_embeddings(GOOGLE_API_KEY)
        return FAISS.load_local(
            str(VECTORSTORE_DIR),
            embeddings,
            allow_dangerous_deserialization=True,
        )

    if index_file.exists() and store_file.exists():
        print("[RAG] Existing FAISS index does not match current embedding config. Rebuilding.")

    return ingest_to_faiss(DATA_PATH, VECTORSTORE_DIR, GOOGLE_API_KEY)


def _safe_embedding_config() -> dict[str, str]:
    try:
        return get_embedding_config()
    except Exception as exc:
        return {
            "provider": "invalid",
            "model": "",
            "base_url": "",
            "error": str(exc),
        }


@app.on_event("startup")
def startup_event() -> None:
    def _init_worker() -> None:
        global VECTORSTORE, RETRIEVER, INIT_STATUS, INIT_ERROR
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        INIT_STATUS = "initializing"
        try:
            VECTORSTORE = _load_or_ingest_vectorstore()
            RETRIEVER = VECTORSTORE.as_retriever(search_kwargs={"k": 6})
            INIT_STATUS = "ready"
            INIT_ERROR = ""
        except Exception as exc:  # pragma: no cover - startup diagnostics
            INIT_STATUS = "error"
            INIT_ERROR = str(exc)
        finally:
            asyncio.set_event_loop(None)
            loop.close()

    thread = threading.Thread(target=_init_worker, daemon=True)
    thread.start()


@app.get("/health")
def health() -> dict:
    embedding_config = _safe_embedding_config()
    return {
        "status": "ok",
        "vectorstore_status": INIT_STATUS,
        "init_error": INIT_ERROR,
        "vectorstore_ready": RETRIEVER is not None,
        "embedding_provider": embedding_config.get("provider"),
        "embedding_model": embedding_config.get("model"),
        "embedding_base_url": embedding_config.get("base_url"),
        "model": "gemini-2.5-flash",
    }


def _llm() -> ChatGoogleGenerativeAI:
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_AI_API_KEY is not configured")

    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=GOOGLE_API_KEY,
        temperature=0.2,
    )


@app.post("/rag/forecast")
def rag_forecast(request: ForecastQueryRequest) -> dict:
    if INIT_STATUS == "error":
        raise HTTPException(status_code=500, detail=f"Vector store init failed: {INIT_ERROR}")
    if RETRIEVER is None:
        raise HTTPException(status_code=503, detail="Vector store not initialized")
    return run_forecast_query(request, RETRIEVER, _llm())


@app.post("/rag/anomaly")
def rag_anomaly(request: AnomalyRequest) -> dict:
    if INIT_STATUS == "error":
        raise HTTPException(status_code=500, detail=f"Vector store init failed: {INIT_ERROR}")
    if RETRIEVER is None:
        raise HTTPException(status_code=503, detail="Vector store not initialized")
    return run_anomaly_query(request, RETRIEVER, _llm())


@app.post("/rag/capacity")
def rag_capacity(request: CapacityRequest) -> dict:
    if INIT_STATUS == "error":
        raise HTTPException(status_code=500, detail=f"Vector store init failed: {INIT_ERROR}")
    if RETRIEVER is None:
        raise HTTPException(status_code=503, detail="Vector store not initialized")
    return run_capacity_query(request, RETRIEVER, _llm())
