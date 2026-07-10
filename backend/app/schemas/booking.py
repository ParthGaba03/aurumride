from datetime import datetime

from pydantic import BaseModel, Field


class BookingCreate(BaseModel):
    pickup_address: str = Field(min_length=2, max_length=255)
    drop_address: str = Field(min_length=2, max_length=255)
    pickup_lat: float
    pickup_lon: float
    drop_lat: float
    drop_lon: float
    distance_km: float = Field(gt=0, lt=500)
    eta_minutes: int = Field(gt=0, lt=24 * 60)
    fare_total: float | None = Field(default=None, gt=0, lt=100000)


class BookingOut(BaseModel):
    id: int
    user_id: int
    driver_id: int | None
    driver_name: str | None = None
    driver_phone: str | None = None
    driver_vehicle_model: str | None = None
    driver_vehicle_number: str | None = None
    driver_rating: float | None = None
    pickup_address: str
    drop_address: str
    distance_km: float
    eta_minutes: int
    fare_total: float
    weather_category: str | None = None
    weather_code: int | None = None
    precip_mm: float | None = None
    ethical_guardrail_applied: bool = False
    ethical_reason: str | None = None
    base_fare: float | None = None
    original_predicted_fare: float | None = None
    final_fare: float | None = None
    shap_base_value: float | None = None
    shap_contributions: list[dict] = []
    user_rating: int | None = None
    user_review: str | None = None
    cancellation_reason: str | None = None
    ride_otp: str | None = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class BookingAdminOut(BookingOut):
    pass


class BookingStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|confirmed|approaching|in_progress|cancelled|completed)$")


class BookingAssignDriver(BaseModel):
    driver_id: int


class BookingRateRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    review: str | None = Field(default=None, max_length=300)


class BookingStartRequest(BaseModel):
    otp: str = Field(pattern="^[0-9]{4}$")

