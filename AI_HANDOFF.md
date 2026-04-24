# GridWise AI Handoff

This document is a complete, single-file context pack for the GridWise application so another AI can understand and work on the project without reading the whole codebase first.

## 1) What GridWise Is

GridWise is an AI-powered smart energy sharing platform for Karnataka.

Core capabilities:
- Forecast near-term demand, solar generation, and surplus for a user location.
- Enable peer-to-peer energy trading between prosumers and consumers in the same district.
- Provide role-based dashboards for Consumer, Prosumer, and Admin users.
- Provide RAG-assisted recommendations for forecast, anomaly interpretation, and capacity planning.

Primary stack:
- Next.js 14 App Router (frontend + API routes)
- Prisma + MongoDB Atlas
- JWT auth with role-based routing
- FastAPI ML microservice (XGBoost)
- FastAPI RAG microservice (LangChain + Gemini + FAISS)

## 2) Monorepo Layout

Root folders:
- `gridwise/` -> Next.js app (UI, auth, API routes, Prisma schema)
- `ml_service/` -> FastAPI model inference and training scripts
- `rag_service/` -> FastAPI retrieval and LLM reasoning service
- `colab/` -> notebooks for synthetic data generation and model training

Root files:
- `.env.example` -> shared env template
- `.gitignore`
- `README.md`
- `AI_HANDOFF.md` (this file)

## 3) High-Level Runtime Architecture

Request flow:
1. User signs up/logs in to Next.js app.
2. Next.js stores an httpOnly JWT cookie.
3. Dashboard/API requests are role-protected by middleware and `withAuth`.
4. `/api/forecast` computes contextual features and calls ML service (`/predict/horizon`).
5. `/api/rag/query` proxies to RAG service (`/rag/forecast`, `/rag/anomaly`, or `/rag/capacity`).
6. Trade routes read/write MongoDB via Prisma.
7. Admin routes aggregate anomalies and forecast surplus at district level.

## 4) Environment Variables

Root `.env` is intended to be copied into `gridwise/.env` too.

Required/important vars:
- `JWT_SECRET`
- `DATABASE_URL` (MongoDB Atlas)
- `DIRECT_URL` (optional direct DB URL)
- `GOOGLE_AI_API_KEY` (RAG Gemini + embeddings)
- `ML_SERVICE_URL` (default `http://localhost:8001`)
- `RAG_SERVICE_URL` (default `http://localhost:8002`)

Optional path vars (for parent-level services):
- `GRIDWISE_DATA_PATH`
- `GRIDWISE_TRAIN_DATA_PATH`
- `GRIDWISE_MODEL_DIR`
- `VECTORSTORE_DIR`

Admin seed defaults:
- `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`
- `ADMIN_DISTRICT`, `ADMIN_CITY`, `ADMIN_PINCODE`

## 5) Local Runbook

From repo root:

1. Setup env
- `cp .env.example .env`
- `cp .env gridwise/.env`

2. Install deps
- Next app: `cd gridwise && npm install`
- ML: `cd ../ml_service && pip install -r requirements.txt`
- RAG: `cd ../rag_service && pip install -r requirements.txt`

3. Prisma setup (inside `gridwise/`)
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run seed:admin`

4. Run services (three terminals)
- ML: `cd ml_service && uvicorn main:app --reload --port 8001`
- RAG: `cd rag_service && uvicorn main:app --reload --port 8002`
- App: `cd gridwise && npm run dev`

App URL:
- `http://localhost:3000`

## 6) Auth and Authorization Model

Token and session:
- Cookie name: `gridwise_token`
- Token lifetime: 7 days
- JWT payload contains: `userId`, `email`, `role`, `district`, `city`, optional `name`

Roles:
- `CONSUMER`
- `PROSUMER`
- `ADMIN`

Role home routes:
- Consumer -> `/dashboard/consumer`
- Prosumer -> `/dashboard/prosumer`
- Admin -> `/dashboard/admin`

Route protection:
- Middleware protects `/dashboard/*` and redirects based on role.
- API routes use `withAuth(handler, allowedRoles?)`.

Signup policy:
- Signup endpoint allows only `CONSUMER` and `PROSUMER`.
- Admin is expected via seed script.

## 7) Prisma Data Model (MongoDB)

Enums:
- `Role`: `CONSUMER`, `PROSUMER`, `ADMIN`
- `TradeStatus`: `OPEN`, `ACCEPTED`, `COMPLETED`, `CANCELLED`
- `AnomalyType`: `UNDERPERFORMING_SOURCE`, `DEMAND_SPIKE`, `SURPLUS_OVERFLOW`

Models:
- `User`
  - profile/auth fields + role + district/city/pincode
  - relations to meters, forecasts, sell offers, buy offers
- `SmartMeter`
  - `currentLoad_kW`, `solarGeneration_kW`, `batteryLevel_pct`, `timestamp`
- `EnergyForecast`
  - `forecastedDemand_kWh`, `forecastedSurplus_kWh`, `horizon_hours`, `modelVersion`
- `TradeOffer`
  - seller/buyer IDs, district/city, energy and price fields, status, completion timestamp
- `TradeLedger`
  - one-to-one with trade, stores earnings/savings/carbon credits
- `GridAnomaly`
  - district/city/type/severity/description/suggestedAction/resolution timestamps

Business formulas used:
- `billSplit_INR = energyAmount_kWh * pricePerUnit_INR`
- Buyer savings on acceptance: `billSplit_INR * 0.15`
- Carbon credits on acceptance: `energyAmount_kWh * 0.82`

## 8) Next.js API Contracts

All API endpoints are under `gridwise/app/api`.

### 8.1 Auth

`POST /api/auth/signup`
- Input:
  - `name`, `email`, `password`, `role` (`CONSUMER|PROSUMER`), `district`, `city`, `pincode`
- Behavior:
  - validates district-city pair
  - creates user
  - sets JWT cookie
- Output: `{ user }`

`POST /api/auth/login`
- Input: `email`, `password`
- Behavior:
  - verifies credentials
  - sets JWT cookie
- Output: `{ user }`

`POST /api/auth/logout`
- Behavior: clears JWT cookie
- Output: `{ success: true }`

### 8.2 Forecast

`POST /api/forecast` (authenticated)
- Optional input:
  - `horizonHours` (clamped to 3..48 in this route)
- Behavior:
  - derives weather/time/location/hierarchy/load features
  - fetches latest and recent smart meter readings
  - builds fallback forecast and fallback multi-hour curve
  - calls ML endpoint `POST {ML_SERVICE_URL}/predict/horizon`
  - persists first-point forecast to `EnergyForecast`
- Output:
  - `forecast` (first point summary)
  - `hierarchy` (`state`, `district`, `city`, `subCity`, `localArea`)
  - `horizonHours`
  - `hourlyBreakdown[]` with time, demand/solar/surplus, weather, and usage levels

### 8.3 Trade

`GET /api/trade/offer?scope=open|mine` (authenticated)
- `scope=open` (default): open offers in same district as current user
- `scope=mine`: offers created by current user

`POST /api/trade/offer` (PROSUMER only)
- Input: `energyAmount_kWh`, `pricePerUnit_INR`
- Behavior: creates `OPEN` offer with computed bill split

`POST /api/trade/accept` (CONSUMER only)
- Input: `tradeOfferId`
- Rules:
  - offer must exist and be `OPEN`
  - buyer must be in same district as offer
- Behavior:
  - transaction updates offer to `COMPLETED`
  - creates `TradeLedger` record

`GET /api/trade/ledger?page=&pageSize=` (authenticated)
- Consumer: returns completed trades where user is buyer + monthly summary (`totalSavings_INR`, `carbonOffset`)
- Prosumer: returns completed trades where user is seller + monthly summary (`totalEarnings_INR`, `carbonCredits`)
- Admin: returns all completed trades + summary (`totalTraded_INR`, `totalSavings_INR`, `carbonCredits`)

### 8.4 Grid Anomaly

`GET /api/grid/anomaly?district=` (ADMIN only)
- Returns:
  - unresolved anomalies (optionally filtered by district)
  - district surplus map derived from recent forecasts

`POST /api/grid/anomaly` (ADMIN only)
- Input: `anomalyId` (or `tradeOfferId` alias accepted by schema)
- Behavior: marks anomaly resolved (`resolvedAt`)

### 8.5 RAG Proxy

`POST /api/rag/query` (authenticated)
- Input:
  - `question`
  - `type`: `forecast | anomaly | capacity`
  - optional `payload`
- Routing:
  - `forecast` -> `/rag/forecast`
  - `anomaly` -> `/rag/anomaly`
  - `capacity` -> `/rag/capacity`
- Fallback behavior:
  - if RAG service is unreachable, returns a local fallback response with summary/actions.

## 9) Dashboard Behavior by Role

Consumer dashboard:
- Calls `/api/forecast` via `ForecastPanel`.
- Lists open district offers and accepts them.
- Shows trade history with savings and carbon offsets.
- Includes AI assistant (forecast-type query).

Prosumer dashboard:
- Calls `/api/forecast` and renders 24h-style multi-hour chart.
- Displays hierarchy chips (state/district/city/sub-city/local area).
- Shows monthly earnings and carbon credits from ledger summary.
- Allows creating trade offers.
- Includes AI assistant (capacity-type query).

Admin dashboard:
- Heatmap-like district surplus visualization.
- Anomaly alert list with resolve actions.
- Capacity planning table from RAG `capacity` responses.
- Ledger table with filters and CSV export.
- Charts:
  - traded energy/day
  - top prosumer districts
  - demand vs supply trend

## 10) ML Service Contract and Logic

Service file: `ml_service/main.py`

Endpoints:
- `GET /health`
- `POST /predict`
- `POST /predict/horizon`

Model loading:
- Uses `ml_service/models/`
- Required files:
  - `gridwise_xgb_demand.pkl`
  - `gridwise_xgb_solar.pkl`
  - `gridwise_xgb_surplus.pkl`
  - `encoders.pkl`

Request models:
- `PredictRequest` includes:
  - hierarchy: `state`, `district`, `city`, `sub_city`, `local_area`
  - time: `date/day/hour/day_of_week/month/year`, weekend/holiday/season
  - weather: temperature, humidity, irradiance, wind, rainy/cloudy
  - grid context: prosumer %, household count, peak flag
  - lag features: `lag_1h`, `lag_24h`, `lag_168h`, `rolling_mean_24h`
  - usage features: local/sub-city/city/state usage kWh
- `HorizonPredictRequest` extends with `horizon_hours` (1..72)

Prediction details:
- Encodes hierarchy and categorical fields with saved encoders.
- Builds feature frame and aligns to model feature order.
- Predicts demand/solar/surplus using separate XGBoost regressors.
- Confidence heuristic:
  - `confidence = clamp(1 - abs(surplus)/max(demand,1), 0.35..0.96)`
- Horizon prediction recursively rolls forward lag features per hour.

## 11) Training Pipeline (ML)

Script:
- `ml_service/training/train_multihour.py`

What it does:
- Loads combined historical CSV (multi-year hourly data).
- Ensures hierarchy columns exist (`state`, `sub_city`, `local_area`).
- Ensures usage-level columns exist.
- Label-encodes categorical columns.
- Creates lag and rolling features.
- Trains three XGBoost models (demand/solar/surplus).
- Splits by year:
  - train: 2019-2022
  - validation: 2023
  - test: 2024
- Prints MAE/RMSE/MAPE.
- Saves model artifacts and encoders.

Path resolution in training:
- `GRIDWISE_TRAIN_DATA_PATH` overrides data path.
- Fallback data candidates:
  - `colab/karnataka_energy_2019_2024.csv`
  - `data/karnataka_energy_2019_2024.csv`
  - `gridwise/data/karnataka_energy_2019_2024.csv`
- `GRIDWISE_MODEL_DIR` overrides output folder (default `ml_service/models`).

## 12) RAG Service Contract and Logic

Service file: `rag_service/main.py`

Endpoints:
- `GET /health`
- `POST /rag/forecast`
- `POST /rag/anomaly`
- `POST /rag/capacity`

Startup behavior:
- Loads env in this order (non-destructive):
  - repo root `.env`
  - `gridwise/.env`
  - `rag_service/.env`
- Resolves data CSV path from env or fallbacks.
  - `colab/karnataka_energy_2019_2024.csv`
  - `data/karnataka_energy_2019_2024.csv`
  - `gridwise/data/karnataka_energy_2019_2024.csv`
  - `gridwise_data/` (directory of district-year CSVs)
- Loads FAISS index if present; otherwise ingests CSV and creates it.
- Sets retriever with `k=6`.

Input models:
- Forecast: `{ question, district?, city? }`
- Anomaly: `{ district, city, current_demand, current_solar, timestamp }`
- Capacity: `{ district, forecasted_demand_3h, available_supply }`

LLM and embeddings:
- Gemini chat model: `gemini-2.5-flash`
- Embeddings: `models/embedding-001`

Output handling:
- Prompts require JSON-only outputs.
- Parser has safe JSON fallback if model returns malformed text.

## 13) Data + Notebook Workflow

Notebooks under `colab/`:
- `01_generate_synthetic_data.ipynb`
- `02_train_model.ipynb`

Expected artifacts:
- Combined CSV dataset for 2019-2024 hourly records.
- Trained model files copied into `ml_service/models/`.

## 14) Non-Obvious Rules and Fallbacks

Forecast path:
- If ML service fails/unavailable, `/api/forecast` returns a deterministic fallback horizon curve and still responds.
- Forecast writes only aggregate first-point info to `EnergyForecast`; full horizon is returned to UI but not fully persisted.

RAG path:
- If RAG service fails/unavailable, `/api/rag/query` returns fallback summary/actions instead of hard failure.

Trade acceptance:
- Enforced district match between offer and accepting consumer.
- Acceptance and ledger write are transactional.

Auth edge compatibility:
- Middleware uses `auth-edge` token verification for edge runtime compatibility.

## 15) Known Gaps / Risks

Current state is functional, but notable gaps:
- No automated test suite committed yet (unit/integration/e2e).
- `TradeStatus.ACCEPTED` exists in enum but route flow currently goes directly from `OPEN` to `COMPLETED`.
- `/api/grid/anomaly` POST schema accepts `tradeOfferId` alias though it resolves anomalies.
- RAG relies on external Gemini API availability and quality of JSON formatting.
- Model quality depends on synthetic/available data fidelity and artifact freshness.

## 16) Quick Payload Examples

Forecast request (from app to ML horizon endpoint):

```json
{
  "state": "Karnataka",
  "district": "Bangalore Urban",
  "city": "Bengaluru",
  "sub_city": "South Bengaluru",
  "local_area": "Jayanagar",
  "date": "2026-01-20",
  "day": 20,
  "hour": 18,
  "day_of_week": 2,
  "month": 1,
  "year": 2026,
  "is_weekend": false,
  "is_holiday": false,
  "season": "Winter",
  "temperature_C": 27.4,
  "humidity_pct": 58,
  "solar_irradiance_Wm2": 310,
  "wind_speed_kmh": 12,
  "is_rainy": false,
  "is_cloudy": true,
  "peak_flag": true,
  "prosumer_pct": 0.22,
  "household_count": 500,
  "lag_1h": 3.9,
  "lag_24h": 3.3,
  "lag_168h": 3.1,
  "rolling_mean_24h": 3.5,
  "sub_city_usage_kWh": 640,
  "city_usage_kWh": 1680,
  "local_area_usage_kWh": 240,
  "state_usage_kWh": 52000,
  "horizon_hours": 6
}
```

Trade offer create:

```json
{
  "energyAmount_kWh": 12.5,
  "pricePerUnit_INR": 8.8
}
```

RAG proxy query:

```json
{
  "question": "How can I reduce evening demand spikes in my district?",
  "type": "forecast"
}
```

## 17) Copy-Paste Prompt Block For Another AI

Use this directly as a starter prompt:

```text
You are working on the GridWise monorepo.

Architecture summary:
- Next.js app in gridwise/ (UI + API + auth + Prisma MongoDB)
- ML FastAPI in ml_service/ with /predict and /predict/horizon
- RAG FastAPI in rag_service/ with /rag/forecast, /rag/anomaly, /rag/capacity
- Colab notebooks in colab/ for data generation and model training

Business context:
- Karnataka-focused smart energy sharing platform
- Roles: CONSUMER, PROSUMER, ADMIN
- Features: demand/solar/surplus forecasting, peer energy trading, admin anomaly/capacity views

Important env vars:
- JWT_SECRET, DATABASE_URL, GOOGLE_AI_API_KEY
- ML_SERVICE_URL=http://localhost:8001
- RAG_SERVICE_URL=http://localhost:8002
- Optional: GRIDWISE_DATA_PATH, GRIDWISE_TRAIN_DATA_PATH, GRIDWISE_MODEL_DIR, VECTORSTORE_DIR

Core API behavior:
- /api/forecast calls ML /predict/horizon and returns hierarchy + hourlyBreakdown
- /api/trade/offer creates/open-lists offers; /api/trade/accept completes trade transactionally
- /api/trade/ledger returns role-scoped history + monthly summary
- /api/grid/anomaly is ADMIN-only for listing unresolved anomalies and resolving them
- /api/rag/query proxies to RAG service and has fallback response if unavailable

Constraints and conventions:
- Preserve role-based auth and district-scoped trade checks
- Keep ML/RAG services in parent root folders (not inside gridwise)
- Keep compatibility with current env path resolution
- Prisma provider is MongoDB

Task:
- Propose and implement changes with minimal regressions.
- Mention exact files touched and validation commands run.
```

---

If this handoff gets stale after major changes, update this file first so future AI sessions stay accurate.
