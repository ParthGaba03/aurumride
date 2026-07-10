from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import pandas as pd
import shap

from .weather import WeatherSnapshot, get_weather_snapshot


@dataclass(frozen=True)
class PricingBreakdown:
    base_fare: float
    model_predicted_fare: float
    final_fare: float
    ethical_guardrail_applied: bool
    ethical_reason: str | None
    weather: WeatherSnapshot
    shap_base_value: float | None
    shap_contributions: list[dict]


class PricingService:
    def __init__(self, model_path: str = "xgboost_pricing_model.pkl") -> None:
        resolved_model_path = self._resolve_model_path(model_path)
        self._model = joblib.load(resolved_model_path)
        self._explainer = shap.TreeExplainer(self._model)

    @staticmethod
    def _resolve_model_path(model_path: str) -> Path:
        p = Path(model_path)

        if p.is_file():
            return p

        service_file = Path(__file__).resolve()
        backend_root = service_file.parents[2]
        project_root = backend_root.parent

        candidates = [
            backend_root / model_path,
            project_root / model_path,
            project_root / "ml" / model_path,
        ]

        for candidate in candidates:
            if candidate.is_file():
                return candidate

        searched = ", ".join(str(c) for c in candidates)

        raise FileNotFoundError(
            f"Pricing model not found. Looked for '{model_path}' in: {searched}. "
            "Run `python ml/train_pricing_model.py` from project root to generate it."
        )

    def quote(
        self,
        *,
        distance_km: float,
        hour: int,
        lat: float,
        lon: float,
    ) -> PricingBreakdown:

        weather = get_weather_snapshot(lat, lon)


        # ---------------------------------
        # Weather Encoding
        # ---------------------------------

        weather_clear = 1 if weather.category == "clear" else 0
        weather_rain = 1 if weather.category == "rain" else 0
        weather_heavy = 1 if weather.category == "heavy_rain" else 0

        # ---------------------------------
        # Model Input
        # ---------------------------------

        X = pd.DataFrame(
            [[distance_km, hour, weather_clear, weather_heavy, weather_rain]],
            columns=[
                "Ride Distance",
                "Hour",
                "Weather_Clear",
                "Weather_Heavy Rain",
                "Weather_Rain",
            ],
        )

        # ---------------------------------
        # Raw AI Prediction
        # ---------------------------------

        model_pred = float(self._model.predict(X)[0])

        # ---------------------------------
        # Transparent Base Fare
        # ---------------------------------

        base_fare = float(50 + (distance_km * 15))

        # ---------------------------------
        # Business + Ethical Guardrails
        # ---------------------------------

        ethical_guardrail_applied = False
        ethical_reason = None

        # Minimum booking fare
        minimum_fare = 80

        # AI-adjusted prediction safety
        adjusted_pred = max(model_pred, minimum_fare)

        # Blend transparent pricing + AI prediction
        final = (0.7 * base_fare) + (0.3 * adjusted_pred)

        # Ensure minimum safety floor
        final = max(final, minimum_fare)

        # ---------------------------------
        # Dynamic Explainable Reasoning
        # ---------------------------------

        if model_pred < base_fare * 0.6:
            ethical_reason = (
                "AI suggested a lower fare than standard pricing, "
                "so transparent pricing safeguards maintained a fair ride price."
            )

        elif model_pred > base_fare * 1.5:
            ethical_reason = (
                "AI detected higher demand conditions, "
                "which increased the recommended fare."
            )

        else:
            ethical_reason = (
                "AI pricing remained within normal transparent pricing limits."
            )

        # ---------------------------------
        # Weather-aware Ethical Logic
        # ---------------------------------

        if weather.category == "heavy_rain":

            max_multiplier = 1.30
            cap = base_fare * max_multiplier

            if final > cap:
                ethical_guardrail_applied = True

                ethical_reason = (
                    "Heavy rain increased demand, "
                    "but ethical surge protection capped the fare increase."
                )

                final = cap

            else:
                ethical_reason += (
                    " Heavy rain conditions slightly increased pricing."
                )

        elif weather.category == "rain":

            ethical_reason += (
                " Light rain conditions slightly influenced pricing."
            )

        elif weather.category == "clear":

            ethical_reason += (
                " Clear weather helped keep pricing stable."
            )

        # ---------------------------------
        # SHAP Explainability
        # ---------------------------------

        shap_vals = self._explainer.shap_values(X)

        base_value = getattr(self._explainer, "expected_value", None)

        if isinstance(base_value, (list, tuple)):
            base_value = base_value[0]

        shap_base = (
            float(base_value)
            if base_value is not None
            else None
        )

        # Handle SHAP output shape
        if hasattr(shap_vals, "shape") and len(getattr(shap_vals, "shape", [])) == 2:
            vals = shap_vals[0]
        else:
            vals = shap_vals

        contribs: list[dict] = []

        for feature, rupees in zip(
            X.columns.tolist(),
            [float(v) for v in vals],
        ):
            contribs.append(
                {
                    "feature": feature,
                    "rupees": round(rupees, 2),
                }
            )

        # ---------------------------------
        # Final Response
        # ---------------------------------

        return PricingBreakdown(
            base_fare=round(base_fare, 2),
            model_predicted_fare=round(model_pred, 2),
            final_fare=round(final, 2),
            ethical_guardrail_applied=ethical_guardrail_applied,
            ethical_reason=ethical_reason,
            weather=weather,
            shap_base_value=round(shap_base, 2)
            if shap_base is not None
            else None,
            shap_contributions=contribs,
        )


pricing_service = PricingService()