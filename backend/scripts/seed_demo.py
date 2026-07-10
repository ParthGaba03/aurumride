from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.core.security import hash_password
from backend.app.db.init_db import init_db
from backend.app.db.session import SessionLocal
from backend.app.models.booking import Booking, BookingStatus
from backend.app.models.driver import Driver
from backend.app.models.user import User, UserRole


DEMO_PASSWORD = "TestPass123!"
DEMO_USER_EMAIL = "aurumride.user@example.com"
DEMO_DRIVER_EMAIL = "aurumride.driver@example.com"


def _upsert_user(db, *, email: str, role: UserRole) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.role = role
        user.password_hash = hash_password(DEMO_PASSWORD)
    else:
        user = User(email=email, role=role, password_hash=hash_password(DEMO_PASSWORD))
        db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _upsert_driver(db, *, user: User) -> Driver:
    driver = db.query(Driver).filter(Driver.user_id == user.id).first()
    if not driver:
        driver = db.query(Driver).filter(Driver.phone == "DRV-DEMO-001").first()
    if not driver:
        driver = Driver(user_id=user.id, name="Arjun Mehta", phone="DRV-DEMO-001", vehicle_model="Toyota Camry")
        db.add(driver)

    driver.user_id = user.id
    driver.name = "Arjun Mehta"
    driver.phone = "DRV-DEMO-001"
    driver.vehicle_model = "Toyota Camry Hybrid"
    driver.vehicle_number = "KA-05-AR-2026"
    driver.rating = 4.8
    driver.is_active = True
    db.commit()
    db.refresh(driver)
    return driver


def _audit_shap(distance: float, hour: float, weather: float) -> str:
    return json.dumps(
        [
            {"feature": "Ride Distance", "rupees": distance},
            {"feature": "Hour", "rupees": hour},
            {"feature": "Weather_Heavy Rain", "rupees": weather},
        ]
    )


def _booking(
    *,
    user_id: int,
    driver_id: int,
    pickup_address: str,
    drop_address: str,
    pickup_lat: float,
    pickup_lon: float,
    drop_lat: float,
    drop_lon: float,
    distance_km: float,
    eta_minutes: int,
    fare_total: float,
    base_fare: float,
    model_fare: float,
    status: BookingStatus,
    created_at: datetime,
    weather_category: str = "clear",
    weather_code: int | None = 0,
    precip_mm: float | None = 0.0,
    ethical_guardrail_applied: bool = False,
    ethical_reason: str | None = None,
    user_rating: int | None = None,
    user_review: str | None = None,
) -> Booking:
    return Booking(
        user_id=user_id,
        driver_id=driver_id,
        pickup_address=pickup_address,
        drop_address=drop_address,
        pickup_lat=pickup_lat,
        pickup_lon=pickup_lon,
        drop_lat=drop_lat,
        drop_lon=drop_lon,
        distance_km=distance_km,
        eta_minutes=eta_minutes,
        fare_total=fare_total,
        weather_category=weather_category,
        weather_code=weather_code,
        precip_mm=precip_mm,
        ethical_guardrail_applied=ethical_guardrail_applied,
        ethical_reason=ethical_reason,
        base_fare=base_fare,
        original_predicted_fare=model_fare,
        final_fare=fare_total,
        shap_base_value=96.0,
        shap_contributions_json=_audit_shap(distance=round(distance_km * 15, 2), hour=18.0, weather=22.0),
        status=status,
        created_at=created_at,
        user_rating=user_rating,
        user_review=user_review,
    )


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        user = _upsert_user(db, email=DEMO_USER_EMAIL, role=UserRole.user)
        driver_user = _upsert_user(db, email=DEMO_DRIVER_EMAIL, role=UserRole.admin)
        driver = _upsert_driver(db, user=driver_user)

        db.query(Booking).filter(
            (Booking.user_id == user.id) | (Booking.driver_id == driver.id)
        ).delete(synchronize_session=False)

        now = datetime.utcnow()
        demo_bookings = [
            _booking(
                user_id=user.id,
                driver_id=driver.id,
                pickup_address="Manipal Institute of Technology, Manipal",
                drop_address="Udupi Railway Station, Udupi",
                pickup_lat=13.3525,
                pickup_lon=74.7928,
                drop_lat=13.3409,
                drop_lon=74.7421,
                distance_km=7.2,
                eta_minutes=18,
                fare_total=185.0,
                base_fare=158.0,
                model_fare=185.0,
                status=BookingStatus.confirmed,
                created_at=now,
            ),
            _booking(
                user_id=user.id,
                driver_id=driver.id,
                pickup_address="Indiranagar, Bengaluru",
                drop_address="Kempegowda International Airport, Bengaluru",
                pickup_lat=12.9784,
                pickup_lon=77.6408,
                drop_lat=13.1986,
                drop_lon=77.7066,
                distance_km=36.4,
                eta_minutes=62,
                fare_total=775.0,
                base_fare=596.0,
                model_fare=775.0,
                status=BookingStatus.completed,
                created_at=now - timedelta(days=1),
                user_rating=5,
                user_review="Clean car and transparent fare explanation.",
            ),
            _booking(
                user_id=user.id,
                driver_id=driver.id,
                pickup_address="MG Road, Bengaluru",
                drop_address="Whitefield, Bengaluru",
                pickup_lat=12.9756,
                pickup_lon=77.6068,
                drop_lat=12.9698,
                drop_lon=77.7499,
                distance_km=19.8,
                eta_minutes=45,
                fare_total=451.1,
                base_fare=347.0,
                model_fare=612.0,
                status=BookingStatus.completed,
                created_at=now - timedelta(days=2),
                weather_category="heavy_rain",
                weather_code=65,
                precip_mm=12.4,
                ethical_guardrail_applied=True,
                ethical_reason="Surge capped due to heavy rain (ethical guardrail).",
                user_rating=4,
                user_review="Surge cap explanation was useful.",
            ),
        ]
        db.add_all(demo_bookings)
        db.commit()

        print("Demo data seeded.")
        print(f"User login: {DEMO_USER_EMAIL} / {DEMO_PASSWORD}")
        print(f"Driver login: {DEMO_DRIVER_EMAIL} / {DEMO_PASSWORD}")
        print(f"Bookings created: {len(demo_bookings)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
