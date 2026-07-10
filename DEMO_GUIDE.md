# AurumRide Final Demo Guide

Use this guide for final evaluation, screenshots, and presentation practice.

## Demo Credentials

Normal user:

- Email: `aurumride.user@example.com`
- Password: `TestPass123!`

Driver/admin:

- Email: `aurumride.driver@example.com`
- Password: `TestPass123!`

## One-Time Demo Setup

From project root:

```powershell
C:\Users\DELL\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe backend\scripts\seed_demo.py
```

This refreshes the same demo user, driver, driver profile, and sample bookings.

## Run The App

Backend:

```powershell
C:\Users\DELL\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
C:\Users\DELL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe node_modules\next\dist\bin\next dev --hostname 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000
```

## Final Demo Flow

1. Open AurumRide.
2. Login as normal user:
   - `aurumride.user@example.com`
   - `TestPass123!`
3. Show the premium booking page and map.
4. Select pickup and drop points or use search.
5. Click `Explain price`.
6. Explain:
   - base fare
   - model predicted fare
   - final fare
   - weather context
   - SHAP contribution breakdown
7. Click `Confirm booking`.
8. Show confirmed booking card with driver details.
9. Go to `My Trips`.
10. Show seeded trip history and rating/review.
11. Logout.
12. Login as driver/admin:
    - `aurumride.driver@example.com`
    - `TestPass123!`
13. Open `Driver - My Bookings`.
14. Show assigned bookings and status update controls.
15. Open `Driver - Analytics`.
16. Show revenue, bookings, completed rides, and status/hour summaries.
17. Open `Driver - Profile`.
18. Show editable driver profile details.

## Ethical Pricing Point To Highlight

The seeded trip from `MG Road, Bengaluru` to `Whitefield, Bengaluru` contains an ethical surge-cap example:

- Weather category: `heavy_rain`
- Model predicted fare: `612.0`
- Final fare after cap: `451.1`
- Reason: `Surge capped due to heavy rain (ethical guardrail).`

Use this in the viva to explain fairness and accountability.

## ML Results To Mention

The latest Phase 3 evaluation used `Bengaluru Ola.csv` with 26,000 successful ride rows.

| Model | MAE | RMSE | R2 |
|---|---:|---:|---:|
| XGBoost | 5.88 | 7.438 | 0.9992 |
| Random Forest | 6.419 | 8.499 | 0.9989 |
| Linear Regression | 51.161 | 66.406 | 0.9348 |

Important limitation:

The Bengaluru Ola CSV provides ride distance, time, and booking context. Weather indicators and dynamic-pricing target are engineered because the source dataset does not include live weather, traffic, demand-supply ratio, or surge labels.

## Screenshots To Capture

- Login screen
- User booking page with map
- Explain Price panel
- Confirmed ride card
- My Trips page
- Driver bookings page
- Driver analytics page
- Driver profile page
- ML result graphs from `ml/results/`

## Backup Talking Points

- This is an academic prototype, not a commercial ride-hailing integration.
- Payment gateway, real dispatch system, microservices, and cloud scaling are future scope.
- The main contribution is ethical and explainable dynamic pricing using XGBoost, SHAP, and backend-enforced guardrails.

