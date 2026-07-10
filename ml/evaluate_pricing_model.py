from __future__ import annotations

import json
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

from train_pricing_model import add_proxy_fare_with_surge, add_synthetic_weather, _hour_from_time_str


FEATURES = ["Ride Distance", "Hour", "Weather_Clear", "Weather_Heavy Rain", "Weather_Rain"]


def _project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_or_generate_dataset(csv_path: Path | None, rows: int, seed: int) -> tuple[pd.DataFrame, str]:
    if csv_path and csv_path.is_file():
        df = pd.read_csv(csv_path)
        df = df[df["Booking Status"].astype(str).str.lower().eq("success")]
        df = df.dropna(subset=["Booking Value", "Ride Distance", "Time"])
        df = df.sample(n=min(rows, len(df)), random_state=seed)
        df["Hour"] = df["Time"].apply(_hour_from_time_str).astype(int)
        df = add_synthetic_weather(df, seed=seed)
        df = add_proxy_fare_with_surge(df)
        return df, f"CSV dataset: {csv_path}"

    rng = np.random.default_rng(seed)
    distances = rng.gamma(shape=2.4, scale=4.0, size=rows).clip(0.8, 38.0)
    hours = rng.integers(0, 24, size=rows)
    weather = rng.choice(["clear", "rain", "heavy_rain"], size=rows, p=[0.78, 0.14, 0.08])
    df = pd.DataFrame(
        {
            "Ride Distance": distances.round(2),
            "Hour": hours,
            "Weather_Clear": (weather == "clear").astype(int),
            "Weather_Rain": (weather == "rain").astype(int),
            "Weather_Heavy Rain": (weather == "heavy_rain").astype(int),
        }
    )
    df = add_proxy_fare_with_surge(df)
    return df, "Generated reproducible synthetic academic dataset"


def _metrics(y_true: pd.Series, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "MAE": round(float(mean_absolute_error(y_true, y_pred)), 3),
        "RMSE": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 3),
        "R2": round(float(r2_score(y_true, y_pred)), 4),
    }


def _train_models(seed: int) -> dict[str, object]:
    return {
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(
            n_estimators=250,
            max_depth=12,
            min_samples_leaf=2,
            random_state=seed,
            n_jobs=-1,
        ),
        "XGBoost": XGBRegressor(
            n_estimators=600,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=1.0,
            random_state=seed,
        ),
    }


def _save_bar_chart(metrics_df: pd.DataFrame, output: Path) -> None:
    ax = metrics_df.set_index("model")[["MAE", "RMSE"]].plot(kind="bar", figsize=(8, 5))
    ax.set_title("Model Error Comparison")
    ax.set_ylabel("Fare error (rupees)")
    ax.set_xlabel("")
    ax.grid(axis="y", alpha=0.25)
    plt.xticks(rotation=0)
    plt.tight_layout()
    plt.savefig(output, dpi=160)
    plt.close()


def _save_actual_vs_predicted(y_true: pd.Series, y_pred: np.ndarray, output: Path) -> None:
    sample = min(600, len(y_true))
    x = y_true.to_numpy()[:sample]
    y = y_pred[:sample]
    low = min(float(x.min()), float(y.min()))
    high = max(float(x.max()), float(y.max()))

    plt.figure(figsize=(6, 6))
    plt.scatter(x, y, alpha=0.45, s=16)
    plt.plot([low, high], [low, high], color="black", linewidth=1.2)
    plt.title("Actual vs Predicted Fare (XGBoost)")
    plt.xlabel("Actual fare")
    plt.ylabel("Predicted fare")
    plt.grid(alpha=0.25)
    plt.tight_layout()
    plt.savefig(output, dpi=160)
    plt.close()


def _save_feature_importance(model: XGBRegressor, output: Path) -> None:
    importances = pd.Series(model.feature_importances_, index=FEATURES).sort_values()
    plt.figure(figsize=(8, 5))
    plt.barh(importances.index, importances.values)
    plt.title("XGBoost Feature Importance")
    plt.xlabel("Importance")
    plt.tight_layout()
    plt.savefig(output, dpi=160)
    plt.close()


def _save_shap_summary(model: XGBRegressor, X_sample: pd.DataFrame, output: Path) -> None:
    explainer = shap.TreeExplainer(model)
    values = explainer.shap_values(X_sample)
    shap.summary_plot(values, X_sample, show=False, plot_size=(8, 5))
    plt.tight_layout()
    plt.savefig(output, dpi=160, bbox_inches="tight")
    plt.close()


def run_evaluation(
    csv_path: str | None = None,
    rows: int = 26000,
    seed: int = 42,
    output_dir: str = "ml/results",
) -> dict:
    root = _project_root()
    out = root / output_dir
    out.mkdir(parents=True, exist_ok=True)

    if csv_path:
        source_path = root / csv_path
    elif (root / "Bengaluru Ola.csv").is_file():
        source_path = root / "Bengaluru Ola.csv"
    else:
        source_path = root / "ola_bengaluru.csv"
    df, data_source = _load_or_generate_dataset(source_path, rows=rows, seed=seed)
    X = df[FEATURES].copy()
    y = df["Proxy Fare"].astype(float)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=seed)

    model_rows = []
    trained_models: dict[str, object] = {}
    predictions: dict[str, np.ndarray] = {}
    for name, model in _train_models(seed).items():
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        trained_models[name] = model
        predictions[name] = pred
        model_rows.append({"model": name, **_metrics(y_test, pred)})

    metrics_df = pd.DataFrame(model_rows).sort_values("MAE")
    metrics_df.to_csv(out / "model_metrics.csv", index=False)

    best_xgb = trained_models["XGBoost"]
    xgb_pred = predictions["XGBoost"]
    sample_predictions = X_test.copy()
    sample_predictions["actual_fare"] = y_test
    sample_predictions["xgboost_predicted_fare"] = np.round(xgb_pred, 2)
    sample_predictions["absolute_error"] = np.round(np.abs(y_test.to_numpy() - xgb_pred), 2)
    sample_predictions.head(20).to_csv(out / "sample_predictions.csv", index=False)

    _save_bar_chart(metrics_df, out / "model_comparison.png")
    _save_actual_vs_predicted(y_test, xgb_pred, out / "actual_vs_predicted.png")
    _save_feature_importance(best_xgb, out / "feature_importance.png")
    _save_shap_summary(best_xgb, X_test.sample(n=min(500, len(X_test)), random_state=seed), out / "shap_summary.png")

    joblib.dump(best_xgb, root / "xgboost_pricing_model.pkl")

    if source_path.is_file():
        limitation = (
            "The evaluation uses the Bengaluru Ola ride dataset for successful rides, distance, "
            "time, and booking context. Weather indicators and the dynamic-pricing target are "
            "engineered for the academic ethical-surge experiment because the source CSV does "
            "not contain live weather or demand-supply surge labels."
        )
    else:
        limitation = (
            "No raw ride CSV was present in the workspace during this run, so the evaluation used "
            "a reproducible synthetic academic dataset with engineered distance, time, weather, "
            "peak-hour, and surge effects."
        )

    summary = {
        "data_source": data_source,
        "rows_used": int(len(df)),
        "features": FEATURES,
        "target": "Proxy Fare (engineered dynamic-pricing target)",
        "metrics": metrics_df.to_dict(orient="records"),
        "best_model_by_mae": str(metrics_df.iloc[0]["model"]),
        "artifacts": [
            "ml/results/model_metrics.csv",
            "ml/results/sample_predictions.csv",
            "ml/results/model_comparison.png",
            "ml/results/actual_vs_predicted.png",
            "ml/results/feature_importance.png",
            "ml/results/shap_summary.png",
        ],
        "limitation": limitation,
    }
    (out / "evaluation_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    _write_markdown_summary(summary, out / "evaluation_summary.md")
    return summary


def _write_markdown_summary(summary: dict, output: Path) -> None:
    lines = [
        "# ML Evaluation Summary",
        "",
        f"Data source: {summary['data_source']}",
        f"Rows used: {summary['rows_used']}",
        f"Target: {summary['target']}",
        "",
        "## Metrics",
        "",
        "| Model | MAE | RMSE | R2 |",
        "|---|---:|---:|---:|",
    ]
    for row in summary["metrics"]:
        lines.append(f"| {row['model']} | {row['MAE']} | {row['RMSE']} | {row['R2']} |")
    lines.extend(
        [
            "",
            f"Best model by MAE: {summary['best_model_by_mae']}",
            "",
            "## Generated Artifacts",
            "",
        ]
    )
    lines.extend(f"- `{artifact}`" for artifact in summary["artifacts"])
    lines.extend(["", "## Limitation", "", summary["limitation"], ""])
    output.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    result = run_evaluation()
    print(json.dumps(result, indent=2))
