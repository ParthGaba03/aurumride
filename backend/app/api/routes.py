from fastapi import APIRouter

from .routes_auth import router as auth_router
from .routes_bookings import router as bookings_router
from .routes_drivers import router as drivers_router
from .routes_pricing import router as pricing_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(drivers_router, prefix="/drivers", tags=["drivers"])
router.include_router(bookings_router, prefix="/bookings", tags=["bookings"])
router.include_router(pricing_router, prefix="/pricing", tags=["pricing"])

