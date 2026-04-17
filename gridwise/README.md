# GridWise

GridWise is an AI-powered smart energy sharing and trading platform for Karnataka neighborhoods.

## Implemented Stack

- Next.js 14 App Router (frontend + API routes)
- JWT auth (jose + bcryptjs, httpOnly cookie)
- Prisma ORM with MongoDB Atlas datasource
- FastAPI ML service for XGBoost inference
- FastAPI RAG service using LangChain + Gemini + FAISS
- Colab notebooks for synthetic data generation and model training

## Project Structure

- app: Auth pages, dashboards, API routes
- components: Reusable chart/trade/heatmap/anomaly UI components
- lib: Auth, middleware helpers, Prisma client, Karnataka config
- prisma: MongoDB Prisma schema
- ../ml_service: XGBoost inference microservice (parent folder)
- ../rag_service: LangChain RAG microservice (parent folder)
- colab: Notebook workflows for data + model training
- scripts: Admin seed script

## 1) Next.js App Setup

1. Copy environment template:

```bash
cp .env.example .env
```

2. Fill values in .env:
- JWT_SECRET
- DATABASE_URL (MongoDB Atlas connection string)
- GOOGLE_AI_API_KEY
- ML_SERVICE_URL
- RAG_SERVICE_URL

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client and push schema:

```bash
npm run prisma:generate
npm run prisma:push
```

5. Seed admin user:

```bash
npm run seed:admin
```

6. Run app:

```bash
npm run dev
```

## 2) ML Service Setup

1. Copy trained artifacts from Colab output to ../ml_service/models:
- gridwise_xgb_demand.pkl
- gridwise_xgb_solar.pkl
- gridwise_xgb_surplus.pkl
- encoders.pkl

2. Install deps and run:

```bash
cd ../ml_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Multi-Hour Training Workflow

The ML backend now supports multi-hour forecasting with hierarchical features:
- date/day/month/year
- temperature + weather signals
- usage at local_area, sub_city, city, and state levels

Run training with:

```bash
python ../ml_service/training/train_multihour.py
```

Optional env vars:
- `GRIDWISE_TRAIN_DATA_PATH` (auto-resolves from `../colab/karnataka_energy_2019_2024.csv`, then fallback paths)
- `GRIDWISE_MODEL_DIR` (defaults to `ml_service/models`)

New ML endpoints:
- `POST /predict` single-step prediction
- `POST /predict/horizon` multi-hour prediction (`horizon_hours`)

## 3) RAG Service Setup

1. Ensure GOOGLE_AI_API_KEY is available in environment.
2. Ensure combined CSV exists (auto-resolves from `../colab/karnataka_energy_2019_2024.csv` or set GRIDWISE_DATA_PATH).

```bash
cd ../rag_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

On first startup, the service ingests CSV data and persists FAISS index in ../rag_service/vectorstore.

## 4) Colab Notebooks

- colab/01_generate_synthetic_data.ipynb
	- Generates district-year files and combined Karnataka dataset for 2019-2024.
- colab/02_train_model.ipynb
	- Trains demand/solar/surplus XGBoost models and saves artifacts to Drive.

## Auth and Role Notes

- Supported roles: CONSUMER, PROSUMER, ADMIN
- Auth cookie: gridwise_token (httpOnly)
- Middleware protects /dashboard/* and routes users to role-specific dashboard

## Validation Status

- npm run lint: clean
- npm run build: successful
- prisma generate: successful
- prisma db push: depends on valid MongoDB Atlas credentials in .env
