# AurumRide

Ethical and Explainable Dynamic Pricing System for ride-sharing, built as a full-stack application with:

- Next.js frontend (`frontend/`)
- FastAPI backend (`backend/`)
- XGBoost + SHAP pricing pipeline (`ml/`)

## Core Features

- Map-based booking flow
- Fare quote endpoint with explainability
- SHAP-based "Explain Price" breakdown
- Ethical guardrail for surge capping in sensitive weather conditions
- Booking-time server-side fare revalidation
- User trips dashboard and admin panels (drivers, bookings, analytics)
- JWT authentication with role-based access control

## Project Structure

- `backend/`: API routes, services, models, schemas, auth, DB config
- `frontend/`: Next.js App Router UI and API client integration
- `ml/`: training and evaluation pipeline for pricing model
- `requirements.txt`: Python dependencies
- `bi_weekly_report_nextjs_phase.txt`: phase progress report
- `progress_log.txt`: implementation milestone log

## Backend Setup

1. Create and activate a virtual environment
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Create environment file:
   - copy `.env.example` to `.env`
   - set a strong `SECRET_KEY`
4. Run API:
   - `uvicorn backend.app.main:app --reload`
5. API base URL:
   - `http://127.0.0.1:8000`

## Frontend Setup

1. Go to frontend:
   - `cd frontend`
2. Install dependencies:
   - `npm install`
3. Set env in `frontend/.env.local`:
   - `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`
4. Run app:
   - `npm run dev`
5. Open:
   - `http://localhost:3000`

## ML Training

Run training pipeline from project root:

- `python ml/train_pricing_model.py`

This script prepares features, trains XGBoost, computes MAE, and saves:

- `xgboost_pricing_model.pkl`

## Notes

- Default local database is SQLite (configured in backend settings).
- Weather context is fetched in pricing service for ethical fare controls.
- Password reset uses a hashed, short-lived, single-use OTP with failed-attempt limits. Local demo mode displays the OTP in the UI; set `PASSWORD_RESET_DEMO_MODE=false` and connect an email/SMS provider before production deployment.
- ML evaluation uses real Bengaluru Ola ride rows for distance/time context, but weather indicators and the pricing target are engineered because the source dataset does not contain live weather, demand-supply, traffic, or real surge labels.
- This project is academic/prototype-to-deploy and not integrated with live commercial dispatch systems.

