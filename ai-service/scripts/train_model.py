from __future__ import annotations

import argparse
import json
import logging
import sys
import pandas as pd
import numpy as np
from src.models.train_priority import generate_synthetic_dataset
from src.models.priority_model import FEATURE_COLUMNS, DISPOSITION_CLASSES, DISPOSITION_TO_IDX, priority_model, MODEL_PATH
from sklearn.metrics import classification_report, confusion_matrix

"""
CLI script to train or retrain the oncology priority ordinal classifier.
Usage:
  python -m scripts.train_model                    # Train from synthetic data
  python -m scripts.train_model --real data.json   # Blend synthetic + real feedback data
  python -m scripts.train_model --eval              # Evaluate current model
"""

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("train_model")


def train(real_data_path: str | None = None, n_synthetic: int = 5000):
    # Train the model, optionally blending in real feedback data.
    logger.info("Generating %d synthetic training samples...", n_synthetic)
    df_synthetic = generate_synthetic_dataset(n_samples=n_synthetic)
    logger.info("Synthetic data class distribution: %s", df_synthetic["label"].value_counts().to_dict())
    df_train = df_synthetic

    if real_data_path:
        logger.info("Loading real feedback data from %s...", real_data_path)
        try:
            with open(real_data_path) as f:
                real_rows = json.load(f)
            df_real = pd.DataFrame(real_rows)

            # Map string label to int
            if "label" in df_real.columns and df_real["label"].dtype == object:
                df_real["label"] = df_real["label"].map(DISPOSITION_TO_IDX)
                df_real = df_real.dropna(subset=["label"])
                df_real["label"] = df_real["label"].astype(int)

            # Keep only known feature columns + label
            available_cols = [c for c in FEATURE_COLUMNS if c in df_real.columns]
            df_real = df_real[available_cols + ["label"]].fillna(0)

            # Real data gets 3x weight by duplicating rows
            df_real_weighted = pd.concat([df_real] * 3, ignore_index=True)
            df_train = pd.concat([df_synthetic, df_real_weighted], ignore_index=True)
            logger.info(
                "Blended: %d synthetic + %d real (%d weighted) = %d total samples",
                len(df_synthetic), len(df_real), len(df_real_weighted), len(df_train),
            )
        except Exception as e:
            logger.error("Failed to load real data: %s — using synthetic only", e)

    X = df_train[FEATURE_COLUMNS].fillna(0)
    y = df_train["label"]

    logger.info("Training ordinal classifier on %d samples...", len(X))
    metrics = priority_model.train(X, y)

    report = metrics.get("classification_report", {})
    macro = report.get("macro avg", {})
    logger.info(
        "Training complete — Macro F1: %.3f, Precision: %.3f, Recall: %.3f",
        macro.get("f1-score", 0),
        macro.get("precision", 0),
        macro.get("recall", 0),
    )

    logger.info("Saving model to %s", MODEL_PATH)
    priority_model.save(str(MODEL_PATH))
    logger.info("Done.")
    return metrics


def evaluate():
    """Evaluate the current model on a held-out synthetic test set."""
    if not MODEL_PATH.exists():
        logger.error("No saved model found at %s. Run training first.", MODEL_PATH)
        sys.exit(1)

    priority_model.load(str(MODEL_PATH))

    logger.info("Generating test set (1000 samples, seed=99)...")
    df_test = generate_synthetic_dataset(n_samples=1000, seed=99)
    X_test = df_test[FEATURE_COLUMNS].fillna(0)
    y_test = df_test["label"]
    proba = priority_model.model.predict_proba(X_test)
    y_pred = np.argmax(proba, axis=1)

    print("\n=== Classification Report ===")
    print(classification_report(y_test, y_pred, target_names=DISPOSITION_CLASSES, zero_division=0))
    print("=== Confusion Matrix ===")
    print(confusion_matrix(y_test, y_pred))
    print()

    # Under-triage rate (predicted lower class than actual)
    under_triage = sum(1 for p, a in zip(y_pred, y_test) if p < a)
    over_triage = sum(1 for p, a in zip(y_pred, y_test) if p > a)
    exact = sum(1 for p, a in zip(y_pred, y_test) if p == a)
    total = len(y_test)
    print(f"Exact match:     {exact}/{total} ({exact/total:.1%})")
    print(f"Over-triage:     {over_triage}/{total} ({over_triage/total:.1%})  [safe]")
    print(f"Under-triage:    {under_triage}/{total} ({under_triage/total:.1%})  [dangerous]")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the oncology priority ordinal classifier")
    parser.add_argument("--real", metavar="PATH", help="Path to real feedback data JSON file")
    parser.add_argument("--n-synthetic", type=int, default=5000, help="Number of synthetic samples")
    parser.add_argument("--eval", action="store_true", help="Evaluate current model on test set")
    args = parser.parse_args()

    if args.eval:
        evaluate()
    else:
        train(real_data_path=args.real, n_synthetic=args.n_synthetic)
