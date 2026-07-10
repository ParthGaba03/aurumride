import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..db.base import Base


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.user)
    reset_otp_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reset_otp_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reset_otp_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

