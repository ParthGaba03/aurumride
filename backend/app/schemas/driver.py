from pydantic import BaseModel, Field


class DriverCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=8, max_length=32)
    vehicle_model: str = Field(min_length=2, max_length=120)
    vehicle_number: str = Field(default="NA-0000", min_length=2, max_length=32)


class DriverUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, min_length=8, max_length=32)
    vehicle_model: str | None = Field(default=None, min_length=2, max_length=120)
    vehicle_number: str | None = Field(default=None, min_length=2, max_length=32)
    rating: float | None = Field(default=None, ge=1.0, le=5.0)
    is_active: bool | None = None


class DriverOut(BaseModel):
    id: int
    user_id: int | None = None
    name: str
    phone: str
    vehicle_model: str
    vehicle_number: str
    rating: float
    is_active: bool

    class Config:
        from_attributes = True

