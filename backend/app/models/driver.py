from sqlalchemy import Boolean, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from ..db.base import Base


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    vehicle_model: Mapped[str] = mapped_column(String(120), nullable=False)
    vehicle_number: Mapped[str] = mapped_column(String(32), nullable=False, default="NA-0000")
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

