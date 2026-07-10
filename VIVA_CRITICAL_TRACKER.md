# Viva Critical Tracker

Use this as the working checklist before final demo.

## Done

- [x] Added `.env.example` for backend/frontend environment values.
- [x] Added local `.env` for viva demo.
- [x] Removed the old `dev-change-me` JWT secret placeholder from backend config.
- [x] Added frontend SHAP contribution display with rupee impact and positive/negative labels.
- [x] Replaced insecure email-only password reset with hashed, expiring, single-use OTP verification.
- [x] Added password-reset attempt limits and account-enumeration protection.
- [x] Added frontend OTP request/verification flow and backend reset tests.
- [x] Added password-reset and ML limitation notes to README.
- [x] Prepared final report draft in `FINAL_REPORT_DRAFT.md`.
- [x] Prepared 15-slide PPT content outline in `VIVA_PPT_CONTENT.md`.
- [x] Clearly stated ML limitation in viva/report material.
- [x] Created local `.venv` and installed `requirements.txt`.
- [x] Verified backend tests: `10 passed`.
- [x] Verified `uvicorn` is installed in `.venv`.
- [x] Verified frontend source lint.
- [x] Verified frontend production build.
- [x] Backed up old DB to `gaba_cabs.db.bak-before-viva-reset`.
- [x] Cleaned and reseeded demo DB.
- [x] Verified demo DB: 2 users, 1 driver, 3 bookings.
- [x] Started and smoke-tested backend at `http://127.0.0.1:8000`.
- [x] Started and smoke-tested frontend at `http://127.0.0.1:3000`.
- [x] Verified live user/driver login, pricing with 5 SHAP contributions, and both booking views.
- [x] Added frontend form validation, accessibility labels, pricing loading state, and driver-status error handling.

## In Progress

- [ ] Convert PPT content outline into final designed PPTX, if time permits.

## Website Verification

- [x] Frontend lint passes.
- [x] Frontend production build passes.
- [x] Backend test suite passes: 10 tests.
- [x] Live frontend and backend are running.

## Manual Test Findings

- [x] User login and map route selection verified manually.
- [x] AI pricing and SHAP contribution display verified manually.
- [x] Booking creation, correct driver assignment, cancellation, and rating verified manually.
- [x] Driver booking status updates verified manually.
- [x] Driver analytics and profile persistence verified manually.
- [x] OTP password reset verified manually with invalid and valid OTPs.
- [x] Labeled the pre-quote calculation as `Estimated Fare` and the backend result as `Final AI Fare`.
- [x] Require a final backend quote before enabling booking confirmation.
- [x] Made the backend final quote the single source of truth for all fare displays.
- [x] Explained the final fare formula in the UI: `70% transparent base fare + 30% model prediction`, followed by safety limits.
- [x] Clarified that SHAP weather rows are one-hot model features; inactive weather features may still have SHAP effects in a tree model.
- [x] Replaced the passenger-facing raw SHAP table with a simple distance/time/weather explanation.
- [x] Kept exact SHAP baseline and five model contributions under collapsed technical details for viva use.
- [x] Fixed automated tests polluting the demo database by isolating them in `test_gaba_cabs.db`.
- [x] Changed simulated `Journey started` to `Driver approaching` so it does not contradict persisted booking status.
- [x] Replaced frontend-only ride simulation with a persisted two-minute backend state machine.
- [x] Added synchronized stages: request sent, driver assigned, approaching, journey started, and completed.
- [x] Added three-second polling on both user and driver booking screens.
- [x] Added automatic map movement toward pickup and then toward drop.
- [x] Added an automated backend test for ride progression through completion.
- [x] Changed booking flow so new bookings stay pending until driver manually accepts or declines.
- [x] Added driver decline handling; user sees cancelled/declined message and can book again.
- [x] Added ride OTP verification before journey can start.
- [x] Changed post-accept flow: confirmed automatically becomes driver approaching, then waits for OTP.
- [x] Changed post-OTP flow: journey starts and then completes automatically.
- [x] Compressed demo ride timing: driver approaches about 5 seconds after accept; ride completes about 15 seconds after OTP start.
- [x] Fixed active booking fare display to show the persisted backend booking fare, not an old route quote.

## Final Report Notes

- Explain that the SHAP baseline (`expected_value`, currently approximately Rs 491 for the trained model) is the model's average expected output over its training distribution, not the ride's base fare.
- Demonstrate the SHAP identity: `model baseline + all feature contributions = raw model prediction`.
- Keep these four pricing concepts separate: transparent distance fare, raw XGBoost prediction, blended final fare, and ethical safety limits.
- Document the blend as `70% transparent distance fare + 30% model prediction`, followed by minimum-fare and heavy-rain cap checks.
- State that passenger UI shows a simple explanation, while collapsed technical SHAP details support auditing and viva demonstration.
- Explain ride OTP as a safety control: passenger receives a 4-digit ride OTP when the driver reaches pickup, and the driver must enter it before the journey can start.
- Explain driver rejection as a prototype workflow: a declined ride becomes cancelled with a visible reason; the user can create a fresh booking for the next available active driver.
- Mention that the lifecycle timers are intentionally compressed for viva demonstration; in production they would be based on GPS distance, driver movement, and real trip completion events.
