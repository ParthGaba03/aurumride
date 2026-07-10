from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.deps import get_current_driver, get_current_user, require_admin
from ..db.init_db import init_db
from ..db.session import get_db
from ..models.driver import Driver
from ..models.user import UserRole
from ..schemas.driver import DriverCreate, DriverOut, DriverUpdate

router = APIRouter()


@router.get("/", response_model=list[DriverOut])
def list_drivers(db: Session = Depends(get_db), _admin=Depends(require_admin)) -> list[Driver]:
    init_db()
    return db.query(Driver).order_by(Driver.id.desc()).all()


@router.get("/nearby")
def nearby_drivers(_user=Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    init_db()
    active_count = db.query(Driver).filter(Driver.is_active == True).count()
    if active_count >= 8:
        eta = 3
    elif active_count >= 4:
        eta = 5
    elif active_count >= 1:
        eta = 8
    else:
        eta = 12
    return {
        "active_drivers": active_count,
        "estimated_wait_minutes": eta,
    }


@router.get("/me", response_model=DriverOut)
def my_driver_profile(driver: Driver = Depends(get_current_driver)) -> Driver:
    return driver


@router.patch("/me", response_model=DriverOut)
def update_my_driver_profile(
    payload: DriverUpdate,
    db: Session = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Driver:
    init_db()
    data = payload.model_dump(exclude_unset=True)
    # Driver should not deactivate own account through self-profile update.
    data.pop("is_active", None)
    for k, v in data.items():
        setattr(driver, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Driver phone must be unique")
    db.refresh(driver)
    return driver


@router.post("/", response_model=DriverOut, status_code=status.HTTP_201_CREATED)
def create_driver(payload: DriverCreate, db: Session = Depends(get_db), _admin=Depends(require_admin)) -> Driver:
    init_db()
    driver = Driver(
        name=payload.name,
        phone=payload.phone,
        vehicle_model=payload.vehicle_model,
        vehicle_number=payload.vehicle_number,
        rating=0.0,
        is_active=True,
    )
    db.add(driver)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Driver phone must be unique")
    db.refresh(driver)
    return driver


@router.patch("/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: int,
    payload: DriverUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_user),
) -> Driver:
    init_db()
    if admin.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

    # Driver-admin can only update own profile through this route.
    if driver.user_id is not None and driver.user_id != admin.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own driver profile")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(driver, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Driver phone must be unique")
    db.refresh(driver)
    return driver


@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_driver(driver_id: int, db: Session = Depends(get_db), _admin=Depends(require_admin)) -> None:
    init_db()
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    db.delete(driver)
    db.commit()
    return None

