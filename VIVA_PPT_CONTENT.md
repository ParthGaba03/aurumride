# AurumRide Viva PPT Content

Use this as a 15-slide deck blueprint.

## Slide 1: Title

AurumRide: Ethical and Explainable Dynamic Pricing System for Ride-Sharing Platforms  
Student: Parth Gaba  
MCA Final Semester Project

## Slide 2: Problem Statement

- Dynamic ride fares are often opaque.
- Users do not know why surge pricing happens.
- Heavy rain and emergency-like conditions can make surge pricing feel unfair.
- Need: transparent, explainable, auditable fare calculation.

## Slide 3: Objectives

- Build a full-stack ride booking prototype.
- Predict fare using ML.
- Explain prediction using SHAP.
- Apply ethical guardrails.
- Store pricing audit trail.
- Demonstrate user and driver workflows.

## Slide 4: Proposed System

- User books ride from map.
- Backend calculates fare.
- ML predicts dynamic fare.
- SHAP explains feature impact.
- Ethical guardrail caps sensitive surge.
- Driver updates booking status.

## Slide 5: Architecture

Show diagram:

Frontend -> FastAPI -> SQLite  
FastAPI -> Pricing Service -> XGBoost + SHAP + Weather API

## Slide 6: Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, Leaflet |
| Backend | FastAPI, SQLAlchemy |
| DB | SQLite |
| ML | XGBoost |
| XAI | SHAP |
| Auth | JWT, Argon2 |

## Slide 7: Database Schema

- `users`: account and role
- `drivers`: driver profile, vehicle, active status
- `bookings`: trip, fare, weather, SHAP audit, status, rating

## Slide 8: Authentication & Security

- JWT bearer token auth.
- Argon2 password hashing.
- Role-based route protection.
- Prototype limitation: forgot-password is demo-only; production needs OTP/email token.
- `.env` secret configuration added.

## Slide 9: ML Pricing Model

- Dataset: Bengaluru Ola CSV.
- Features: distance, hour, weather indicators.
- Target: engineered Proxy Fare.
- Models compared: Linear Regression, Random Forest, XGBoost.
- XGBoost selected by best MAE.

## Slide 10: ML Results

| Model | MAE | RMSE | R2 |
|---|---:|---:|---:|
| XGBoost | 5.88 | 7.438 | 0.9992 |
| Random Forest | 6.419 | 8.499 | 0.9989 |
| Linear Regression | 51.161 | 66.406 | 0.9348 |

## Slide 11: SHAP Explainability

- SHAP explains contribution of each feature.
- Positive contribution increases fare.
- Negative contribution reduces fare.
- Frontend shows rupee-level feature impact.
- Backend stores SHAP audit JSON with bookings.

## Slide 12: Ethical Pricing Guardrail

- Base fare remains transparent.
- AI fare is blended with base fare.
- Minimum fare prevents unsafe underpricing.
- Heavy-rain cap prevents exploitative surge.
- Reason is shown and stored.

## Slide 13: Demo Screens

Add screenshots:

- Booking map
- Explain price panel
- Confirmed ride
- Driver bookings
- Driver analytics

## Slide 14: Testing

- Backend health/auth tests.
- Pricing quote and SHAP tests.
- Heavy-rain ethical cap test.
- Booking server-side fare recomputation test.
- Driver booking visibility test.
- Frontend lint and production build.

## Slide 15: Limitations & Future Scope

Limitations:

- Engineered weather and proxy fare target.
- SQLite prototype DB.
- Prototype password reset.
- No payment or real dispatch.

Future scope:

- Real demand/traffic/weather dataset.
- PostgreSQL and migrations.
- OTP reset.
- Cloud deployment.
- Mobile app.
