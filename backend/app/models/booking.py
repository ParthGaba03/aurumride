import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..db.base import Base


class BookingStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    approaching = "approaching"
    in_progress = "in_progress"
    cancelled = "cancelled"
    completed = "completed"


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    driver_id: Mapped[int | None] = mapped_column(ForeignKey("drivers.id"), nullable=True, index=True)

    pickup_address: Mapped[str] = mapped_column(String(255), nullable=False)
    drop_address: Mapped[str] = mapped_column(String(255), nullable=False)
    pickup_lat: Mapped[float] = mapped_column(Float, nullable=False)
    pickup_lon: Mapped[float] = mapped_column(Float, nullable=False)
    drop_lat: Mapped[float] = mapped_column(Float, nullable=False)
    drop_lon: Mapped[float] = mapped_column(Float, nullable=False)

    distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    eta_minutes: Mapped[int] = mapped_column(nullable=False)
    fare_total: Mapped[float] = mapped_column(Float, nullable=False)
    user_rating: Mapped[int | None] = mapped_column(nullable=True)
    user_review: Mapped[str | None] = mapped_column(String(300), nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(String(180), nullable=True)
    ride_otp: Mapped[str | None] = mapped_column(String(6), nullable=True)

    # Weather + ethics + explainability audit fields (for "ethical guardrails" + explainability claims)
    weather_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    weather_code: Mapped[int | None] = mapped_column(nullable=True)
    precip_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    ethical_guardrail_applied: Mapped[bool] = mapped_column(nullable=False, default=False)
    ethical_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    base_fare: Mapped[float | None] = mapped_column(Float, nullable=True)
    original_predicted_fare: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_fare: Mapped[float | None] = mapped_column(Float, nullable=True)
    shap_base_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    shap_contributions_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), nullable=False, default=BookingStatus.pending)
    auto_progress: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    progress_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

