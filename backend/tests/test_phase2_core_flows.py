from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite:///./test_gaba_cabs.db"

import numpy as np
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.weather import WeatherSnapshot


client = TestClient(app)


def _email(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}@example.com"


def _register(email: str, role: str = "user") -> str:
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": "TestPass123!", "role": role},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_password_reset_requires_valid_single_use_otp() -> None:
    email = _email("reset_user")
    _register(email)

    requested = client.post("/api/auth/forgot-password", json={"email": email})
    assert requested.status_code == 200, requested.text
    otp = requested.json()["demo_otp"]
    assert otp and len(otp) == 6

    invalid = client.post(
        "/api/auth/reset-password",
        json={"email": email, "otp": "000000", "new_password": "NewPass123!"},
    )
    assert invalid.status_code == 400

    reset = client.post(
        "/api/auth/reset-password",
        json={"email": email, "otp": otp, "new_password": "NewPass123!"},
    )
    assert reset.status_code == 200, reset.text

    old_login = client.post("/api/auth/login", json={"email": email, "password": "TestPass123!"})
    assert old_login.status_code == 401
    new_login = client.post("/api/auth/login", json={"email": email, "password": "NewPass123!"})
    assert new_login.status_code == 200

    reused = client.post(
        "/api/auth/reset-password",
        json={"email": email, "otp": otp, "new_password": "AnotherPass123!"},
    )
    assert reused.status_code == 400


def test_password_reset_request_does_not_reveal_unknown_accounts() -> None:
    response = client.post("/api/auth/forgot-password", json={"email": _email("missing_reset")})
    assert response.status_code == 200
    assert response.json()["demo_otp"] is None


@dataclass
class _Quote:
    final_fare: float = 180.0
    model_predicted_fare: float = 180.0
    weather: WeatherSnapshot = WeatherSnapshot(category="clear", code=None, precip_mm=None)
    ethical_guardrail_applied: bool = False

    @property
    def base_fare(self) -> float:
        return 143.0

    @property
    def ethical_reason(self) -> str | None:
        return "Audit test guardrail" if self.ethical_guardrail_applied else None

    @property
    def shap_base_value(self) -> float:
        return 100.0

    @property
    def shap_contributions(self) -> list[dict]:
        return [
            {"feature": "Ride Distance", "rupees": 80.0},
            {"feature": "Hour", "rupees": 0.0},
        ]


class _HighFareModel:
    def predict(self, _x):
        return [1000.0]


class _SimpleExplainer:
    expected_value = 120.0

    def shap_values(self, _x):
        return np.array([[400.0, 20.0, 0.0, 300.0, 0.0]])


def test_pricing_quote_returns_explainability(monkeypatch) -> None:
    from backend.app.services import pricing

    monkeypatch.setattr(
        pricing,
        "get_weather_snapshot",
        lambda lat, lon: WeatherSnapshot(category="clear", code=0, precip_mm=0.0),
    )
    token = _register(_email("quote_user"))

    resp = client.get(
        "/api/pricing/quote?distance_km=8.5&hour=18&lat=12.9716&lon=77.5946",
        headers=_auth_header(token),
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["final_fare"] > 0
    assert body["weather"]["category"] == "clear"
    assert body["shap"]["base_value"] is not None
    assert len(body["shap"]["contributions"]) == 5


def test_heavy_rain_guardrail_caps_excessive_model_fare(monkeypatch) -> None:
    from backend.app.services import pricing

    monkeypatch.setattr(pricing.pricing_service, "_model", _HighFareModel())
    monkeypatch.setattr(pricing.pricing_service, "_explainer", _SimpleExplainer())
    monkeypatch.setattr(
        pricing,
        "get_weather_snapshot",
        lambda lat, lon: WeatherSnapshot(category="heavy_rain", code=65, precip_mm=12.0),
    )
    token = _register(_email("cap_user"))

    resp = client.get(
        "/api/pricing/quote?distance_km=10&hour=18&lat=12.9716&lon=77.5946",
        headers=_auth_header(token),
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["model_predicted_fare"] == 1000.0
    assert body["base_fare"] == 200.0
    assert body["final_fare"] == 260.0
    assert body["ethical_guardrail_applied"] is True
    assert "heavy rain" in body["ethical_reason"].lower()


def test_booking_revalidates_fare_without_client_fare(monkeypatch) -> None:
    from backend.app.api import routes_bookings

    monkeypatch.setattr(
        routes_bookings.pricing_service,
        "quote",
        lambda **kwargs: _Quote(final_fare=321.45, model_predicted_fare=340.0),
    )
    _register(_email("booking_driver"), role="admin")
    user_token = _register(_email("booking_user"))

    resp = client.post(
        "/api/bookings/",
        headers=_auth_header(user_token),
        json={
            "pickup_address": "MIT Manipal",
            "drop_address": "Udupi Station",
            "pickup_lat": 13.352,
            "pickup_lon": 74.792,
            "drop_lat": 13.34,
            "drop_lon": 74.75,
            "distance_km": 6.2,
            "eta_minutes": 14,
        },
    )

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["fare_total"] == 321.45
    assert body["status"] == "pending"
    assert body["driver_id"] is not None
    assert body["base_fare"] == 143.0
    assert body["original_predicted_fare"] == 340.0
    assert body["final_fare"] == 321.45
    assert body["weather_category"] == "clear"
    assert body["shap_base_value"] == 100.0
    assert body["shap_contributions"] == [
        {"feature": "Ride Distance", "rupees": 80.0},
        {"feature": "Hour", "rupees": 0.0},
    ]


def test_demo_booking_progresses_to_completion(monkeypatch) -> None:
    from backend.app.api import routes_bookings
    from backend.app.db.session import SessionLocal
    from backend.app.models.booking import Booking

    monkeypatch.setattr(routes_bookings.pricing_service, "quote", lambda **kwargs: _Quote())
    driver_token = _register(_email("timeline_driver"), role="admin")
    user_token = _register(_email("timeline_user"))
    created = client.post(
        "/api/bookings/",
        headers=_auth_header(user_token),
        json={
            "pickup_address": "Start",
            "drop_address": "Finish",
            "pickup_lat": 13.352,
            "pickup_lon": 74.792,
            "drop_lat": 13.34,
            "drop_lon": 74.75,
            "distance_km": 4.0,
            "eta_minutes": 10,
        },
    )
    assert created.status_code == 201
    booking_id = created.json()["id"]
    assert created.json()["status"] == "pending"

    accepted = client.patch(
        f"/api/bookings/admin/{booking_id}/status",
        headers=_auth_header(driver_token),
        json={"status": "confirmed"},
    )
    assert accepted.status_code == 200, accepted.text

    db = SessionLocal()
    booking = db.query(Booking).filter(Booking.id == booking_id).one()
    booking.progress_started_at = datetime.utcnow() - timedelta(seconds=6)
    db.commit()
    db.close()

    progressing = client.get("/api/bookings/me", headers=_auth_header(user_token))
    current = next(item for item in progressing.json() if item["id"] == booking_id)
    assert current["status"] == "approaching"
    ride_otp = current["ride_otp"]
    assert ride_otp and len(ride_otp) == 4

    bad_start = client.post(
        f"/api/bookings/admin/{booking_id}/start",
        headers=_auth_header(driver_token),
        json={"otp": "0000"},
    )
    assert bad_start.status_code == 400

    started = client.post(
        f"/api/bookings/admin/{booking_id}/start",
        headers=_auth_header(driver_token),
        json={"otp": ride_otp},
    )
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "in_progress"

    db = SessionLocal()
    booking = db.query(Booking).filter(Booking.id == booking_id).one()
    booking.progress_started_at = datetime.utcnow() - timedelta(seconds=16)
    db.commit()
    db.close()

    completed = client.get("/api/bookings/me", headers=_auth_header(user_token))
    current = next(item for item in completed.json() if item["id"] == booking_id)
    assert current["status"] == "completed"


def test_driver_only_sees_assigned_bookings(monkeypatch) -> None:
    from backend.app.api import routes_bookings

    monkeypatch.setattr(routes_bookings.pricing_service, "quote", lambda **kwargs: _Quote())
    first_driver_token = _register(_email("driver_a"), role="admin")
    second_driver_token = _register(_email("driver_b"), role="admin")
    user_token = _register(_email("driver_scope_user"))

    booking_resp = client.post(
        "/api/bookings/",
        headers=_auth_header(user_token),
        json={
            "pickup_address": "Aurum Point",
            "drop_address": "Central Station",
            "pickup_lat": 13.352,
            "pickup_lon": 74.792,
            "drop_lat": 13.34,
            "drop_lon": 74.75,
            "distance_km": 5.0,
            "eta_minutes": 12,
        },
    )
    assert booking_resp.status_code == 201, booking_resp.text
    booking_id = booking_resp.json()["id"]

    first_driver_bookings = client.get(
        "/api/bookings/driver/me",
        headers=_auth_header(first_driver_token),
    )
    second_driver_bookings = client.get(
        "/api/bookings/driver/me",
        headers=_auth_header(second_driver_token),
    )

    assert first_driver_bookings.status_code == 200
    assert second_driver_bookings.status_code == 200
    assert booking_id not in {b["id"] for b in first_driver_bookings.json()}
    assert booking_id in {b["id"] for b in second_driver_bookings.json()}


def test_rating_allowed_only_after_terminal_status(monkeypatch) -> None:
    from backend.app.api import routes_bookings

    monkeypatch.setattr(routes_bookings.pricing_service, "quote", lambda **kwargs: _Quote())
    driver_token = _register(_email("rating_driver"), role="admin")
    user_token = _register(_email("rating_user"))

    booking_resp = client.post(
        "/api/bookings/",
        headers=_auth_header(user_token),
        json={
            "pickup_address": "Library Gate",
            "drop_address": "Hostel Block",
            "pickup_lat": 13.352,
            "pickup_lon": 74.792,
            "drop_lat": 13.34,
            "drop_lon": 74.75,
            "distance_km": 3.0,
            "eta_minutes": 8,
        },
    )
    assert booking_resp.status_code == 201, booking_resp.text
    booking_id = booking_resp.json()["id"]

    early_rating = client.post(
        f"/api/bookings/{booking_id}/rate",
        headers=_auth_header(user_token),
        json={"rating": 5, "review": "Too early"},
    )
    assert early_rating.status_code == 409

    complete_resp = client.patch(
        f"/api/bookings/admin/{booking_id}/status",
        headers=_auth_header(driver_token),
        json={"status": "completed"},
    )
    assert complete_resp.status_code == 200, complete_resp.text

    final_rating = client.post(
        f"/api/bookings/{booking_id}/rate",
        headers=_auth_header(user_token),
        json={"rating": 5, "review": "Smooth ride"},
    )
    assert final_rating.status_code == 200, final_rating.text
    assert final_rating.json()["user_rating"] == 5
    assert final_rating.json()["user_review"] == "Smooth ride"
