from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Security
    secret_key: str = Field(
        default="aurumride-local-demo-secret-set-SECRET_KEY-in-production",
        description="JWT signing key. Override with SECRET_KEY in .env for viva/deployment.",
    )
    access_token_expire_minutes: int = 60 * 24
    password_reset_otp_expire_minutes: int = 10
    password_reset_max_attempts: int = 5
    password_reset_demo_mode: bool = False

    # Database
    database_url: str = "sqlite:///./gaba_cabs.db"

    # CORS (frontend dev origins)
    cors_allow_origins: list[str] = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.67:3000",
]

settings = Settings()

