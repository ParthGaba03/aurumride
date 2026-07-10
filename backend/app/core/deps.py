from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..core.config import settings
from ..db.init_db import init_db
from ..db.session import get_db
from ..models.user import User, UserRole
from ..models.driver import Driver

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    init_db()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        sub = payload.get("sub")
        if not sub:
            raise ValueError("Missing sub")
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def _default_driver_name(email: str) -> str:
    base = email.split("@")[0].replace(".", " ").replace("_", " ").strip()
    return base.title() if base else "Driver"


def ensure_driver_profile(current_user: User, db: Session) -> Driver:
    driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
    if driver:
        return driver

    # Auto-provision a personal driver profile for admin/driver accounts.
    driver = Driver(
        user_id=current_user.id,
        name=_default_driver_name(current_user.email),
        phone=f"DRV{current_user.id:06d}",
        vehicle_model="Not set",
        vehicle_number=f"KA-00-{current_user.id:04d}",
        rating=0.0,
        is_active=True,
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


def get_current_driver(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Driver:
    init_db()
    return ensure_driver_profile(current_user, db)

