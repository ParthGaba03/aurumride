from fastapi import APIRouter, Depends

from ..core.deps import get_current_user
from ..models.user import User
from ..services.pricing import pricing_service

router = APIRouter()


@router.get("/quote")
def quote(
    distance_km: float,
    hour: int,
    lat: float,
    lon: float,
    _user: User = Depends(get_current_user),
) -> dict:
    breakdown = pricing_service.quote(distance_km=distance_km, hour=hour, lat=lat, lon=lon)
    return {
        "base_fare": breakdown.base_fare,
        "model_predicted_fare": breakdown.model_predicted_fare,
        "final_fare": breakdown.final_fare,
        "ethical_guardrail_applied": breakdown.ethical_guardrail_applied,
        "ethical_reason": breakdown.ethical_reason,
        "weather": {
            "category": breakdown.weather.category,
            "code": breakdown.weather.code,
            "precip_mm": breakdown.weather.precip_mm,
        },
        "shap": {
            "base_value": breakdown.shap_base_value,
            "contributions": breakdown.shap_contributions,
        },
    }

