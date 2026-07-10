from sqlalchemy import inspect, text

from .base import Base
from .session import engine

# Ensure models are imported so SQLAlchemy registers them
from ..models.user import User  # noqa: F401
from ..models.driver import Driver  # noqa: F401
from ..models.booking import Booking  # noqa: F401


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_migrations()


def _ensure_sqlite_migrations() -> None:
    # Minimal, safe migrations for SQLite dev DB (no Alembic yet).
    if engine.dialect.name != "sqlite":
        return

    insp = inspect(engine)
    if "users" in insp.get_table_names():
        user_cols = {c["name"] for c in insp.get_columns("users")}
        _add_col_if_missing_for_table("users", user_cols, "reset_otp_hash", "TEXT")
        _add_col_if_missing_for_table("users", user_cols, "reset_otp_expires_at", "DATETIME")
        _add_col_if_missing_for_table("users", user_cols, "reset_otp_attempts", "INTEGER DEFAULT 0 NOT NULL")

    if "bookings" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("bookings")}
    if "driver_id" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE bookings ADD COLUMN driver_id INTEGER"))

    # Weather + ethics audit columns
    cols = {c["name"] for c in insp.get_columns("bookings")}
    _add_col_if_missing(cols, "weather_category", "TEXT")
    _add_col_if_missing(cols, "weather_code", "INTEGER")
    _add_col_if_missing(cols, "precip_mm", "REAL")
    _add_col_if_missing(cols, "ethical_guardrail_applied", "INTEGER DEFAULT 0")
    _add_col_if_missing(cols, "ethical_reason", "TEXT")
    _add_col_if_missing(cols, "base_fare", "REAL")
    _add_col_if_missing(cols, "original_predicted_fare", "REAL")
    _add_col_if_missing(cols, "final_fare", "REAL")
    _add_col_if_missing(cols, "shap_base_value", "REAL")
    _add_col_if_missing(cols, "shap_contributions_json", "TEXT")
    _add_col_if_missing(cols, "user_rating", "INTEGER")
    _add_col_if_missing(cols, "user_review", "TEXT")
    _add_col_if_missing(cols, "cancellation_reason", "TEXT")
    _add_col_if_missing(cols, "ride_otp", "TEXT")
    _add_col_if_missing(cols, "auto_progress", "INTEGER DEFAULT 0 NOT NULL")
    _add_col_if_missing(cols, "progress_started_at", "DATETIME")

    if "drivers" not in insp.get_table_names():
        return
    driver_cols = {c["name"] for c in insp.get_columns("drivers")}
    _add_col_if_missing_for_table("drivers", driver_cols, "user_id", "INTEGER")
    _add_col_if_missing_for_table("drivers", driver_cols, "vehicle_number", "TEXT DEFAULT 'NA-0000'")
    _add_col_if_missing_for_table("drivers", driver_cols, "rating", "REAL DEFAULT 0")
    _reset_unrated_driver_defaults()


def _add_col_if_missing(existing_cols: set[str], name: str, ddl_type: str) -> None:
    if name in existing_cols:
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {name} {ddl_type}"))


def _add_col_if_missing_for_table(table: str, existing_cols: set[str], name: str, ddl_type: str) -> None:
    if name in existing_cols:
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl_type}"))


def _reset_unrated_driver_defaults() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE drivers
                SET rating = 0
                WHERE rating = 4.7
                  AND NOT EXISTS (
                    SELECT 1
                    FROM bookings
                    WHERE bookings.driver_id = drivers.id
                      AND bookings.user_rating IS NOT NULL
                  )
                """
            )
        )

