import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import jwt

from .config import settings

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_reset_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_reset_otp(otp: str) -> str:
    return hmac.new(settings.secret_key.encode(), otp.encode(), hashlib.sha256).hexdigest()


def verify_reset_otp(otp: str, otp_hash: str) -> bool:
    return hmac.compare_digest(hash_reset_otp(otp), otp_hash)


def create_access_token(subject: str, role: str, expires_minutes: Optional[int] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes if expires_minutes is not None else settings.access_token_expire_minutes
    )
    payload: dict[str, Any] = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")

