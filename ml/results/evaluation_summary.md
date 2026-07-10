# ML Evaluation Summary

Data source: CSV dataset: D:\Major Project\Bengaluru Ola.csv
Rows used: 26000
Target: Proxy Fare (engineered dynamic-pricing target)

## Metrics

| Model | MAE | RMSE | R2 |
|---|---:|---:|---:|
| XGBoost | 5.88 | 7.438 | 0.9992 |
| Random Forest | 6.419 | 8.499 | 0.9989 |
| Linear Regression | 51.161 | 66.406 | 0.9348 |

Best model by MAE: XGBoost

## Generated Artifacts

- `ml/results/model_metrics.csv`
- `ml/results/sample_predictions.csv`
- `ml/results/model_comparison.png`
- `ml/results/actual_vs_predicted.png`
- `ml/results/feature_importance.png`
- `ml/results/shap_summary.png`

## Limitation

The evaluation uses the Bengaluru Ola ride dataset for successful rides, distance, time, and booking context. Weather indicators and the dynamic-pricing target are engineered for the academic ethical-surge experiment because the source CSV does not contain live weather or demand-supply surge labels.
