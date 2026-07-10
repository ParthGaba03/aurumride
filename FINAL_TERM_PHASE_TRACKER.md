# AurumRide Final Term Phase Tracker

Project: Ethical and Explainable Dynamic Pricing System for Ride-Sharing Platforms  
Student: Parth Gaba  
Status updated after Phase 2

## Overall Goal

Make AurumRide final-submission ready by proving that the application works, the ML model is defensible, the ethical pricing logic is testable, and the final report/demo clearly explain the system.

## Phase 1: Project Stabilization

### What Was Done

- Verified backend server startup on `http://127.0.0.1:8000`.
- Verified `/health` endpoint returns `{"status": "ok"}`.
- Installed required backend dependencies.
- Verified existing backend smoke tests.
- Verified frontend development server startup on `http://127.0.0.1:3000`.
- Verified frontend production build.
- Verified frontend linting for source files.
- Tested user registration and login.
- Tested pricing quote endpoint.
- Tested SHAP explanation response.
- Tested booking creation flow.
- Tested server-side fare revalidation.
- Tested driver assignment.
- Tested driver status update.
- Tested user rating flow.

### Fixes Made

- Removed online Google font dependency from `frontend/src/app/layout.tsx`.
- Added system font fallback in `frontend/src/app/globals.css`.
- Added safe weather fallback in `backend/app/services/weather.py` so pricing does not crash when Open-Meteo is unavailable.

### Result

Phase 1 is complete. The project can run, build, and demonstrate core functionality.

### Still Needed Later

- Fix or document the broken system `npm` setup.
- Clean backend warnings:
  - Pydantic V2 `Config` warning.
  - old XGBoost pickle/model warning.
  - `datetime.utcnow()` deprecation warning.
- Prepare clean demo credentials and seed data.

## Phase 2: Backend Testing and Proof

### What Was Done

- Added new backend test file:
  - `backend/tests/test_phase2_core_flows.py`
- Increased backend tests from 2 tests to 7 tests.
- Added test for pricing quote response.
- Added test for SHAP explainability response.
- Added test for heavy-rain ethical guardrail.
- Added test for booking without trusting client fare.
- Added test for server-side fare revalidation.
- Added test for driver-specific booking visibility.
- Added test for rating being blocked before ride completion.
- Added test for rating working after completed ride.

### Fixes Made

- Updated `backend/app/schemas/booking.py`.
- Made `fare_total` optional in booking request because backend recalculates final fare.
- This improves the project claim that fare integrity is enforced server-side.

### Verification

- Backend tests passed:
  - `7 passed`
- Frontend production build passed after backend/schema change.

### Result

Phase 2 is complete. The project now has stronger proof for final evaluation.

### Still Needed Later

- Add more tests if time permits:
  - unauthorized user cannot access admin routes.
  - user can only view own trips.
  - invalid booking status is rejected.
  - weather fallback behavior is tested directly.
- Consider adding a test report table for final report.

## Phase 3: ML Evaluation and Results

### What Was Done

- Added a dedicated ML evaluation script:
  - `ml/evaluate_pricing_model.py`
- Detected and used the real Bengaluru Ola ride dataset:
  - `Bengaluru Ola.csv`
- Used 26,000 successful ride rows from the CSV for distance, time, and booking context.
- Compared three models:
  - Linear Regression
  - Random Forest
  - XGBoost
- Generated evaluation metrics:
  - MAE
  - RMSE
  - R2 score
- Generated report-ready artifacts in:
  - `ml/results/`
- Updated `requirements.txt` to include `matplotlib`.

### Generated Artifacts

- `ml/results/model_metrics.csv`
- `ml/results/sample_predictions.csv`
- `ml/results/model_comparison.png`
- `ml/results/actual_vs_predicted.png`
- `ml/results/feature_importance.png`
- `ml/results/shap_summary.png`
- `ml/results/evaluation_summary.md`
- `ml/results/evaluation_summary.json`

### Results

| Model | MAE | RMSE | R2 |
|---|---:|---:|---:|
| XGBoost | 5.88 | 7.438 | 0.9992 |
| Random Forest | 6.419 | 8.499 | 0.9989 |
| Linear Regression | 51.161 | 66.406 | 0.9348 |

Best model by MAE: XGBoost

### Important Note For Report

The current evaluation uses the Bengaluru Ola dataset for real ride rows, successful booking filtering, distance, and time. However, weather indicators and the dynamic-pricing target are still engineered because the source CSV does not include live weather, demand-supply ratio, traffic, or surge labels. This must be clearly mentioned in the methodology or limitations section.

### Result

Phase 3 is complete. The project now has ML metrics, model comparison, sample predictions, and explainability graphs for the final report.

### Still Needed Later

- If a richer ride dataset becomes available with weather, traffic, demand-supply, or real surge labels, rerun `ml/evaluate_pricing_model.py` and replace the engineered-target results.
- Add these plots and metrics to the final report and PPT.
- Clearly state the engineered weather/proxy-target limitation.

## Phase 4: Pricing Audit Improvement

### What Was Done

- Added full pricing audit persistence directly on the `Booking` model.
- Added SQLite migration support for the new audit fields.
- Updated booking response schemas to expose audit fields.
- Updated booking serialization to return SHAP contributions as structured JSON.
- Updated booking creation to store:
  - base fare
  - model predicted fare
  - final fare
  - ethical guardrail flag
  - ethical guardrail reason
  - weather category
  - weather code
  - precipitation
  - SHAP base value
  - SHAP feature contributions
- Updated frontend `Booking` type so the UI/API client knows about the audit fields.
- Extended backend tests to verify audit details are stored and returned.

### Files Updated

- `backend/app/models/booking.py`
- `backend/app/db/init_db.py`
- `backend/app/schemas/booking.py`
- `backend/app/api/routes_bookings.py`
- `backend/tests/test_phase2_core_flows.py`
- `frontend/src/lib/api.ts`

### Verification

- Backend tests passed:
  - `7 passed`
- Frontend lint passed.
- Frontend production build passed.

### Result

Phase 4 is complete. The project now supports a stronger transparency and accountability claim because each booking stores pricing audit context.

### Still Needed Later

- Optionally show the stored audit trail in an admin/details UI.
- Include an audit-fields table in the final report.
- Mention that SHAP contributions are stored as JSON text in the SQLite prototype.

## Pre-Phase 5: Premium UI Polish

### What Was Done

- Upgraded the global visual system with a more premium dark interface, refined glass panels, better shadows, and restrained gold/cyan/rose accents.
- Added reusable UI classes for:
  - premium glass panels
  - cards
  - primary buttons
  - ghost buttons
  - inputs
  - custom map markers
- Removed external Leaflet marker image dependency and replaced markers with styled local div markers.
- Improved the top navigation with:
  - branded AurumRide mark
  - cleaner account/menu dropdowns
  - better active navigation styling
- Redesigned the auth screen into a premium two-column product/auth layout on desktop.
- Polished booking, trip, driver profile, driver booking, and analytics panels with consistent card/input/button styling.

### Verification

- Frontend lint passed.
- Frontend production build passed.

### Result

The app now feels more polished and demo-ready before Phase 5.

## Phase 5: Demo Data and Final Demo Flow

### What Was Done

- Added repeatable demo seed script:
  - `backend/scripts/seed_demo.py`
- Added final demo guide:
  - `DEMO_GUIDE.md`
- Seed script creates/refreshes:
  - one normal user
  - one driver/admin user
  - one linked driver profile
  - three sample bookings
  - one heavy-rain ethical surge-cap example
- Verified seeded login credentials through the API.
- Verified user trip history returns three seeded trips.
- Verified driver dashboard returns three assigned bookings.
- Verified ethical surge-cap booking includes:
  - heavy-rain weather category
  - model predicted fare
  - capped final fare
  - SHAP audit items

### Demo Credentials

Normal user:

- Email: `aurumride.user@example.com`
- Password: `TestPass123!`

Driver/admin:

- Email: `aurumride.driver@example.com`
- Password: `TestPass123!`

### Demo Seed Command

```powershell
C:\Users\DELL\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe backend\scripts\seed_demo.py
```

### Verification

- Backend tests passed:
  - `7 passed`
- Frontend production build passed.
- Demo API verification passed.

### Result

Phase 5 is complete. The project now has stable demo data, credentials, and a guided final demo flow.

### Still Needed Later

- Capture screenshots for the final report.
- Optionally record a short backup demo video.

## Phase 6: Final Report

### What Needs To Be Done

Update final report with:

- abstract
- problem statement
- objectives
- system architecture
- database schema
- API endpoint table
- ML methodology
- ML results
- SHAP explainability
- ethical pricing guardrail
- testing results
- screenshots
- limitations
- future scope
- conclusion

### Must Mention As Future Scope

Do not implement these unless specifically required:

- payment gateway
- real dispatch system
- microservices
- full cloud scaling
- load balancing
- mobile app
- integration with real commercial ride-hailing systems

### Expected Output

- Final report ready for submission.
- Claims in the report should match actual implementation.

## Phase 7: PPT and Final Demo Preparation

### What Needs To Be Done

Create a 12-15 slide presentation:

1. title
2. problem statement
3. objectives
4. proposed system
5. architecture
6. tech stack
7. ML pricing model
8. ethical guardrail
9. SHAP explainability
10. app screenshots
11. testing results
12. ML results
13. limitations
14. future scope
15. conclusion

### Expected Output

- Final PPT.
- Practiced demo script.
- Backup screenshots/video in case live demo has issues.

## Current Best Next Step

Start Phase 5:

Prepare demo data, demo credentials, screenshots, and a smooth final evaluation flow.
