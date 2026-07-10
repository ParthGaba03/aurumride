from __future__ import annotations

from dataclasses import dataclass

import requests


@dataclass(frozen=True)
class WeatherSnapshot:
    category: str  # clear | rain | heavy_rain
    code: int | None
    precip_mm: float | None  # mm/h (Open-Meteo current precipitation)


def get_weather_snapshot(lat: float, lon: float) -> WeatherSnapshot:
    """
    Uses Open-Meteo (no API key) to fetch current precipitation + weather_code.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "precipitation,weather_code",
    }
    try:
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException:
        return WeatherSnapshot(category="clear", code=None, precip_mm=None)
    current = data.get("current") or {}

    precip = current.get("precipitation")
    code = current.get("weather_code")

    # Conservative categories based on precipitation intensity.
    # Open-Meteo current precipitation is mm/h.
    if precip is None:
        category = "clear"
    elif precip >= 10:
        category = "heavy_rain"
    elif precip >= 1:
        category = "rain"
    else:
        category = "clear"

    return WeatherSnapshot(category=category, code=code, precip_mm=precip)

