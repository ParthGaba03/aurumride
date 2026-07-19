import json
import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.deps import get_current_driver, get_current_user, require_admin
from ..db.init_db import init_db
from ..db.session import get_db
from ..models.booking import Booking, BookingStatus
from ..models.driver import Driver
from ..models.user import User
from ..schemas.booking import (
    BookingAdminOut,
    BookingAssignDriver,
    BookingCreate,
    BookingOut,
    BookingRateRequest,
    BookingStartRequest,
    BookingStatusUpdate,
)
from ..services.pricing import pricing_service

router = APIRouter()


def _assign_driver(db: Session) -> Driver | None:
    active_drivers = db.query(Driver).filter(Driver.is_active == True).order_by(Driver.id.asc()).all()  # noqa: E712
    if not active_drivers:
        return None

    booking_counts = {
        driver.id: db.query(Booking).filter(Booking.driver_id == driver.id).count()
        for driver in active_drivers
    }
    return min(active_drivers, key=lambda driver: (booking_counts.get(driver.id, 0), driver.id))


def _advance_demo_status(booking: Booking) -> bool:
    if not booking.auto_progress or booking.status in (BookingStatus.cancelled, BookingStatus.completed):
        return False

    started_at = booking.progress_started_at or booking.created_at
    age_seconds = max(0.0, (datetime.utcnow() - started_at).total_seconds())
    if booking.status == BookingStatus.confirmed and age_seconds >= 5:
        next_status = BookingStatus.approaching
    elif booking.status == BookingStatus.in_progress and age_seconds >= 15:
        next_status = BookingStatus.completed
    else:
        return False

    if booking.status == next_status:
        return False
    booking.status = next_status
    if next_status in (BookingStatus.approaching, BookingStatus.completed):
        booking.auto_progress = False
    return True


def _advance_and_commit(db: Session, bookings: list[Booking]) -> None:
    changed = False
    for booking in bookings:
        changed = _advance_demo_status(booking) or changed
    if changed:
        db.commit()


def _serialize_booking(db: Session, booking: Booking, *, include_otp: bool = False) -> dict:
    passenger = db.query(User).filter(User.id == booking.user_id).first()
    driver = None
    if booking.driver_id is not None:
        driver = db.query(Driver).filter(Driver.id == booking.driver_id).first()

    shap_contributions = []
    if booking.shap_contributions_json:
        try:
            loaded = json.loads(booking.shap_contributions_json)
            shap_contributions = loaded if isinstance(loaded, list) else []
        except json.JSONDecodeError:
            shap_contributions = []

    return {
        "id": booking.id,
        "user_id": booking.user_id,
        "user_email": passenger.email if passenger else None,
        "driver_id": booking.driver_id,
        "driver_name": driver.name if driver else None,
        "driver_phone": driver.phone if driver else None,
        "driver_vehicle_model": driver.vehicle_model if driver else None,
        "driver_vehicle_number": driver.vehicle_number if driver else None,
        "driver_rating": (
    round(float(driver.rating), 1)
    if driver and driver.rating > 0
    else None
),
        "pickup_address": booking.pickup_address,
        "drop_address": booking.drop_address,
        "distance_km": booking.distance_km,
        "eta_minutes": booking.eta_minutes,
        "fare_total": booking.fare_total,
        "weather_category": booking.weather_category,
        "weather_code": booking.weather_code,
        "precip_mm": booking.precip_mm,
        "ethical_guardrail_applied": booking.ethical_guardrail_applied,
        "ethical_reason": booking.ethical_reason,
        "base_fare": booking.base_fare,
        "original_predicted_fare": booking.original_predicted_fare,
        "final_fare": booking.final_fare,
        "shap_base_value": booking.shap_base_value,
        "shap_contributions": shap_contributions,
        "user_rating": booking.user_rating,
        "user_review": booking.user_review,
        "cancellation_reason": booking.cancellation_reason,
        "ride_otp": booking.ride_otp if include_otp else None,
        "status": booking.status.value if hasattr(booking.status, "value") else str(booking.status),
        "created_at": booking.created_at,
    }


@router.post("/", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict:
    init_db()

    assigned = _assign_driver(db)
    breakdown = pricing_service.quote(
        distance_km=payload.distance_km, hour=datetime.utcnow().hour, lat=payload.pickup_lat, lon=payload.pickup_lon
    )
    quoted_final_fare = payload.final_fare or payload.fare_total
    if quoted_final_fare and payload.base_fare is not None and payload.original_predicted_fare is not None:
        fare_total = quoted_final_fare
        weather_category = payload.weather_category or breakdown.weather.category
        weather_code = payload.weather_code if payload.weather_code is not None else breakdown.weather.code
        precip_mm = payload.precip_mm if payload.precip_mm is not None else breakdown.weather.precip_mm
        ethical_guardrail_applied = payload.ethical_guardrail_applied
        ethical_reason = payload.ethical_reason or breakdown.ethical_reason
        base_fare = payload.base_fare
        model_predicted_fare = payload.original_predicted_fare
        final_fare = quoted_final_fare
        shap_base_value = payload.shap_base_value
        shap_contributions = payload.shap_contributions or breakdown.shap_contributions
    else:
        fare_total = breakdown.final_fare
        weather_category = breakdown.weather.category
        weather_code = breakdown.weather.code
        precip_mm = breakdown.weather.precip_mm
        ethical_guardrail_applied = breakdown.ethical_guardrail_applied
        ethical_reason = breakdown.ethical_reason
        base_fare = breakdown.base_fare
        model_predicted_fare = breakdown.model_predicted_fare
        final_fare = breakdown.final_fare
        shap_base_value = breakdown.shap_base_value
        shap_contributions = breakdown.shap_contributions

    booking = Booking(
        user_id=current_user.id,
        driver_id=assigned.id if assigned else None,
        pickup_address=payload.pickup_address,
        drop_address=payload.drop_address,
        pickup_lat=payload.pickup_lat,
        pickup_lon=payload.pickup_lon,
        drop_lat=payload.drop_lat,
        drop_lon=payload.drop_lon,
        distance_km=payload.distance_km,
        eta_minutes=payload.eta_minutes,
        fare_total=fare_total,
        weather_category=weather_category,
        weather_code=weather_code,
        precip_mm=precip_mm,
        ethical_guardrail_applied=ethical_guardrail_applied,
        ethical_reason=ethical_reason,
        base_fare=base_fare,
        original_predicted_fare=model_predicted_fare,
        final_fare=final_fare,
        shap_base_value=shap_base_value,
        shap_contributions_json=json.dumps(shap_contributions),
        status=BookingStatus.pending,
        auto_progress=False,
        ride_otp=f"{random.randint(1000, 9999)}",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return _serialize_booking(db, booking, include_otp=True)


@router.get("/me", response_model=list[BookingOut])
def my_bookings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    init_db()
    bookings = (
        db.query(Booking)
        .filter(Booking.user_id == current_user.id)
        .order_by(Booking.id.desc())
        .all()
    )
    _advance_and_commit(db, bookings)
    return [_serialize_booking(db, b, include_otp=True) for b in bookings]


@router.get("/admin", response_model=list[BookingAdminOut])
def admin_list_bookings(db: Session = Depends(get_db), current_driver: Driver = Depends(get_current_driver)) -> list[dict]:
    init_db()
    bookings = db.query(Booking).filter(Booking.driver_id == current_driver.id).order_by(Booking.id.desc()).all()
    _advance_and_commit(db, bookings)
    return [_serialize_booking(db, b) for b in bookings]


@router.get("/driver/me", response_model=list[BookingAdminOut])
def driver_my_bookings(db: Session = Depends(get_db), current_driver: Driver = Depends(get_current_driver)) -> list[dict]:
    init_db()
    bookings = db.query(Booking).filter(Booking.driver_id == current_driver.id).order_by(Booking.id.desc()).all()
    _advance_and_commit(db, bookings)
    return [_serialize_booking(db, b) for b in bookings]


@router.patch("/admin/{booking_id}/status", response_model=BookingAdminOut)
def admin_update_status(
    booking_id: int, payload: BookingStatusUpdate, db: Session = Depends(get_db), current_driver: Driver = Depends(get_current_driver)
) -> dict:
    init_db()
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.driver_id == current_driver.id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    next_status = BookingStatus(payload.status)
    if booking.status in (BookingStatus.cancelled, BookingStatus.completed):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Terminal booking cannot be changed")
    if next_status == BookingStatus.confirmed:
        booking.status = BookingStatus.confirmed
        booking.auto_progress = True
        booking.progress_started_at = datetime.utcnow()
        booking.cancellation_reason = None
    elif next_status == BookingStatus.cancelled:
        booking.status = BookingStatus.cancelled
        booking.auto_progress = False
        booking.cancellation_reason = "Driver declined the ride."
    elif next_status == BookingStatus.completed:
        booking.status = BookingStatus.completed
        booking.auto_progress = False
    else:
        booking.status = next_status
        booking.auto_progress = False
    db.commit()
    db.refresh(booking)
    return _serialize_booking(db, booking)


@router.post("/admin/{booking_id}/start", response_model=BookingAdminOut)
def driver_start_ride(
    booking_id: int,
    payload: BookingStartRequest,
    db: Session = Depends(get_db),
    current_driver: Driver = Depends(get_current_driver),
) -> dict:
    init_db()
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.driver_id == current_driver.id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.status != BookingStatus.approaching:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="OTP can be used only after driver reaches pickup")
    if not booking.ride_otp or payload.otp != booking.ride_otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ride OTP")

    booking.status = BookingStatus.in_progress
    booking.auto_progress = True
    booking.progress_started_at = datetime.utcnow()
    db.commit()
    db.refresh(booking)
    return _serialize_booking(db, booking)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict:
    init_db()
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == current_user.id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.status not in (BookingStatus.pending, BookingStatus.confirmed, BookingStatus.approaching):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking cannot be cancelled in this state")

    booking.status = BookingStatus.cancelled
    booking.auto_progress = False
    booking.cancellation_reason = "Cancelled by passenger."
    db.commit()
    db.refresh(booking)
    return _serialize_booking(db, booking, include_otp=True)


@router.post("/{booking_id}/rate", response_model=BookingOut)
def rate_booking(
    booking_id: int,
    payload: BookingRateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    init_db()

    booking = (
        db.query(Booking)
        .filter(
            Booking.id == booking_id,
            Booking.user_id == current_user.id
        )
        .first()
    )

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    if booking.status not in (
        BookingStatus.completed,
        BookingStatus.cancelled,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Rating allowed after completed/cancelled only",
        )

    # Save user review
    booking.user_rating = payload.rating
    booking.user_review = (payload.review or "").strip() or None

    # Update driver average rating
    if booking.driver_id is not None:

        driver = (
            db.query(Driver)
            .filter(Driver.id == booking.driver_id)
            .first()
        )

        if driver:

            all_ratings = (
                db.query(Booking)
                .filter(
                    Booking.driver_id == driver.id,
                    Booking.user_rating.isnot(None)
                )
                .all()
            )

            ratings = [
                b.user_rating
                for b in all_ratings
                if b.user_rating is not None
            ]

            if ratings:
                driver.rating = round(
                    sum(ratings) / len(ratings),
                    1
                )

    db.commit()
    db.refresh(booking)

    return _serialize_booking(db, booking, include_otp=True)


@router.patch("/admin/{booking_id}/assign_driver", response_model=BookingAdminOut)
def admin_assign_driver(
    booking_id: int,
    payload: BookingAssignDriver,
    db: Session = Depends(get_db),
    current_driver: Driver = Depends(get_current_driver),
) -> dict:
    init_db()
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    driver_id = payload.driver_id
    if int(driver_id) != current_driver.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only assign yourself")
    if booking.driver_id not in (None, current_driver.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Booking assigned to another driver")

    booking.driver_id = current_driver.id
    if booking.status == BookingStatus.pending:
        booking.status = BookingStatus.confirmed
        booking.auto_progress = True
        booking.progress_started_at = datetime.utcnow()
        booking.cancellation_reason = None
    db.commit()
    db.refresh(booking)
    return _serialize_booking(db, booking)

