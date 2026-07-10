from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import (
    create_access_token,
    create_reset_otp,
    hash_password,
    hash_reset_otp,
    verify_password,
    verify_reset_otp,
)
from ..core.deps import get_current_user
from ..db.init_db import init_db
from ..db.session import get_db
from ..models.driver import Driver
from ..models.user import User, UserRole
from ..schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdatePasswordRequest,
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    init_db()
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole(payload.role),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if user.role == UserRole.admin:
        driver = Driver(
            user_id=user.id,
            name=user.email.split("@")[0].replace(".", " ").replace("_", " ").title() or "Driver",
            phone=f"DRV{user.id:06d}",
            vehicle_model="Not set",
            vehicle_number=f"KA-00-{user.id:04d}",
            rating=4.7,
            is_active=True,
        )
        db.add(driver)
        db.commit()

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role.value)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    init_db()
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role.value)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    init_db()
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return ForgotPasswordResponse(message="If the account exists, a reset OTP has been generated.")

    otp = create_reset_otp()
    user.reset_otp_hash = hash_reset_otp(otp)
    user.reset_otp_expires_at = datetime.utcnow() + timedelta(minutes=settings.password_reset_otp_expire_minutes)
    user.reset_otp_attempts = 0
    db.commit()
    return ForgotPasswordResponse(
        message="Reset OTP generated. It expires shortly.",
        demo_otp=otp if settings.password_reset_demo_mode else None,
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    init_db()
    user = db.query(User).filter(User.email == payload.email).first()
    invalid = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset OTP")
    if not user or not user.reset_otp_hash or not user.reset_otp_expires_at:
        raise invalid
    if user.reset_otp_expires_at < datetime.utcnow():
        user.reset_otp_hash = None
        user.reset_otp_expires_at = None
        user.reset_otp_attempts = 0
        db.commit()
        raise invalid
    if user.reset_otp_attempts >= settings.password_reset_max_attempts:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many reset attempts")
    if not verify_reset_otp(payload.otp, user.reset_otp_hash):
        user.reset_otp_attempts += 1
        db.commit()
        raise invalid

    user.password_hash = hash_password(payload.new_password)
    user.reset_otp_hash = None
    user.reset_otp_expires_at = None
    user.reset_otp_attempts = 0
    db.commit()
    return MessageResponse(message="Password reset successful. Please sign in with your new password.")


@router.post("/update-password", response_model=MessageResponse)
def update_password(
    payload: UpdatePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    init_db()
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="New password must be different")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return MessageResponse(message="Password updated successfully.")

