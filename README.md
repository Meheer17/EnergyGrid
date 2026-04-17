# EnergyGrid Monorepo

EnergyGrid contains the full GridWise stack split across a Next.js app and two Python services.

## AI Context Pack

For a single-file, end-to-end context handoff (architecture, APIs, schema, env, runbook, ML/RAG contracts), see `AI_HANDOFF.md`.

## Workspace Layout

- `gridwise/`: Next.js 14 app (UI + API routes + auth + Prisma)
- `ml_service/`: FastAPI service for ML inference and training utilities
- `rag_service/`: FastAPI service for LangChain + Gemini + FAISS retrieval
- `colab/`: Colab notebooks for synthetic data generation and model training
- `.env.example`: Shared environment template for local development

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.10+
- MongoDB Atlas connection string
- Google AI API key

## Environment Setup

From repository root:

```bash
cp .env.example .env
cp .env gridwise/.env
```

The app reads `gridwise/.env`, while parent-level services can read root `.env`.

## Install Dependencies

```bash
cd gridwise
npm install

cd ../ml_service
pip install -r requirements.txt

cd ../rag_service
pip install -r requirements.txt
```

## Run the Stack

Open 3 terminals from repository root:

1. ML service

```bash
cd ml_service
uvicorn main:app --reload --port 8001
```

2. RAG service

```bash
cd rag_service
uvicorn main:app --reload --port 8002
```

3. Next.js app

```bash
cd gridwise
npm run dev
```

App URL: `http://localhost:3000`

## Data + Model Workflow

1. Run notebooks in `colab/` to generate data and train models.
2. Keep the combined CSV available (or set `GRIDWISE_DATA_PATH`).
3. Place model artifacts in `ml_service/models/`:
   - `gridwise_xgb_demand.pkl`
   - `gridwise_xgb_solar.pkl`
   - `gridwise_xgb_surplus.pkl`
   - `encoders.pkl`

Optional local training from root:

```bash
python ml_service/training/train_multihour.py
```

## Common Troubleshooting

- If Next.js cannot reach services, verify:
  - `ML_SERVICE_URL=http://localhost:8001`
  - `RAG_SERVICE_URL=http://localhost:8002`
- If RAG startup fails with missing CSV, set `GRIDWISE_DATA_PATH` explicitly.
- If model loading fails, verify files exist under `ml_service/models/`.
