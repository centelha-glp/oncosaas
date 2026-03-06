"""
Training script for the oncology priority model.
Generates synthetic training data based on clinical patterns and trains the ensemble model.
The trained model is saved to disk and loaded at startup by the AI Service.
"""

import numpy as np
import pandas as pd
import logging
from pathlib import Path

from .priority_model import FEATURE_COLUMNS

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent / "priority_model.joblib"


def generate_synthetic_data(n_samples: int = 2000, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic patient data that reflects real clinical priority patterns.
    Higher scores (closer to 100) mean higher priority (more urgent).
    """
    rng = np.random.default_rng(seed)

    cancer_type = rng.integers(0, 7, size=n_samples)
    stage_num = rng.choice([1, 2, 3, 4], size=n_samples, p=[0.20, 0.25, 0.30, 0.25])
    performance_status = rng.choice([0, 1, 2, 3, 4], size=n_samples, p=[0.15, 0.30, 0.25, 0.20, 0.10])
    age = rng.integers(25, 90, size=n_samples)
    pain_score = rng.integers(0, 11, size=n_samples)
    nausea_score = rng.integers(0, 11, size=n_samples)
    fatigue_score = rng.integers(0, 11, size=n_samples)
    days_since_last_visit = rng.integers(0, 120, size=n_samples)
    treatment_cycle = rng.integers(0, 12, size=n_samples)

    priority_score = np.zeros(n_samples, dtype=float)

    # Stage contribution (0-25 pts)
    priority_score += np.where(stage_num == 4, 25, np.where(stage_num == 3, 15, np.where(stage_num == 2, 8, 3)))

    # Performance status (0-25 pts)
    priority_score += performance_status * 6.25

    # Pain (0-20 pts)
    priority_score += pain_score * 2.0

    # Nausea & fatigue (0-10 pts each)
    priority_score += nausea_score * 1.0
    priority_score += fatigue_score * 1.0

    # Days since last visit (0-10 pts)
    priority_score += np.clip(days_since_last_visit / 12, 0, 10)

    # Age modifier (elderly patients get slight bump)
    priority_score += np.where(age >= 75, 5, np.where(age >= 65, 2, 0))

    priority_score = np.clip(priority_score, 0, 100)

    noise = rng.normal(0, 3, size=n_samples)
    priority_score = np.clip(priority_score + noise, 0, 100)

    df = pd.DataFrame({
        "cancer_type": cancer_type,
        "stage": stage_num,
        "performance_status": performance_status,
        "age": age,
        "pain_score": pain_score,
        "nausea_score": nausea_score,
        "fatigue_score": fatigue_score,
        "days_since_last_visit": days_since_last_visit,
        "treatment_cycle": treatment_cycle,
        "priority_score": priority_score,
    })

    return df


def train_and_save():
    """Train the priority model with synthetic data and save to disk."""
    from .priority_model import priority_model

    logger.info("Generating synthetic training data...")
    data = generate_synthetic_data(n_samples=3000)

    X = data[FEATURE_COLUMNS]
    y = data["priority_score"]

    logger.info(f"Training priority model with {len(X)} samples...")
    priority_model.train(X, y)

    logger.info(f"Saving model to {MODEL_PATH}")
    priority_model.save(str(MODEL_PATH))
    logger.info("Priority model trained and saved successfully")


def load_or_train():
    """Load the saved model if available, otherwise train from scratch."""
    from .priority_model import priority_model

    path_str = str(MODEL_PATH.resolve())
    if MODEL_PATH.exists():
        try:
            priority_model.load(path_str)
            logger.info("Priority model loaded from disk: %s", path_str)
            return
        except Exception as e:
            logger.warning("Failed to load saved model from %s: %s", path_str, e, exc_info=True)

    logger.info("No saved model found or load failed, training with synthetic data...")
    train_and_save()
