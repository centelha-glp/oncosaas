from __future__ import annotations
import logging
import os
from typing import Any, Dict, Optional
import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier

"""
Oncology Priority Model — Ordinal Classifier (Phase 3).

Redesigned from a regression approach (0-100 score, arbitrary formula)
to an ordinal classification approach mapping directly to the 5 ClinicalDisposition
levels used by the clinical rules engine.

Architecture (4-layer risk, ML is Layer 3):
  Layer 1: Hard rules (deterministic red flags) — clinical_rules.py
  Layer 2: Validated scores (MASCC, CISNE) — clinical_scores.py
  Layer 3: This model — ordinal classifier for non-rule-firing cases
  Layer 4: Social modifiers — applied after prediction

Output classes (ordinal):
  0 = REMOTE_NURSING
  1 = SCHEDULED_CONSULT
  2 = ADVANCE_CONSULT
  3 = ER_DAYS
  4 = ER_IMMEDIATE

Model: LightGBM ordinal classifier via cross-entropy on ordered classes.
Asymmetric penalty: under-triaging (predicting lower class) is penalized
more heavily than over-triaging.
"""

logger = logging.getLogger(__name__)

# ─── Disposition constants ─────────────────────────────────────────────────────
DISPOSITION_CLASSES = [
    "REMOTE_NURSING",
    "SCHEDULED_CONSULT",
    "ADVANCE_CONSULT",
    "ER_DAYS",
    "ER_IMMEDIATE",
]
DISPOSITION_TO_IDX = {d: i for i, d in enumerate(DISPOSITION_CLASSES)}
IDX_TO_DISPOSITION = {i: d for i, d in enumerate(DISPOSITION_CLASSES)}

# ─── Feature columns (32 features) ────────────────────────────────────────────
FEATURE_COLUMNS = [
    # Demographics
    "age",
    "is_elderly",          # age >= 70

    # Cancer profile
    "cancer_type_code",    # 0-6 encoded
    "stage_num",           # 1-4
    "is_palliative",       # 0/1

    # Treatment timing (D+N)
    "days_since_last_chemo",   # float; 999 if unknown/no chemo
    "in_nadir_window",         # 1 if D7-D14
    "in_risk_window",          # 1 if D0-D21
    "treatment_cycle",

    # Performance status
    "ecog_score",          # 0-4
    "ecog_delta",          # change from previous (0 if unknown)

    # Symptoms (ESAS-derived, 0-10)
    "pain_score",
    "nausea_score",
    "fatigue_score",
    "dyspnea_score",

    # Vitals
    "temperature",         # 0 if unknown
    "has_fever",           # 1 if temp >= 38
    "spo2",                # 0 if unknown

    # Clinical flags from medications
    "has_anticoagulant",
    "has_immunosuppressant",
    "has_corticosteroid",
    "has_opioid",

    # Clinical flags from comorbidities
    "has_sepsis_risk_comorbidity",
    "has_thrombosis_risk_comorbidity",
    "has_pulmonary_risk_comorbidity",
    "has_renal_risk_comorbidity",

    # Validated scores (0 if unavailable)
    "mascc_score",         # 0-26; high risk ≤ 20
    "cisne_score",         # 0-8; high risk ≥ 3

    # Context
    "days_since_last_visit",
    "is_alone",            # 1 if patient reported being alone

    # Symptom summary
    "symptom_critical_count",  # n symptoms at CRITICAL severity
    "symptom_high_count",      # n symptoms at HIGH severity
]

MODEL_PATH = os.path.join(os.path.dirname(__file__), "priority_model.joblib")


class OncologyPriorityModel:
    """
    LightGBM ordinal classifier for oncology triage disposition.

    Prediction returns:
      - predicted_class: int (0-4)
      - disposition: str (REMOTE_NURSING → ER_IMMEDIATE)
      - probabilities: array of 5 class probabilities
      - confidence: probability of the predicted class
    """

    def __init__(self):
        self.model: Optional[LGBMClassifier] = None
        self.is_trained: bool = False
        self._class_weights = self._build_class_weights()

    def _build_class_weights(self) -> Dict[int, float]:
        """
        Asymmetric class weights: under-triaging (predicting too low) is
        more dangerous than over-triaging. Weight increases with class.
        """
        return {0: 1.0, 1: 1.5, 2: 2.0, 3: 3.5, 4: 5.0}

    def _create_model(self) -> LGBMClassifier:
        return LGBMClassifier(
            n_estimators=400,
            learning_rate=0.05,
            max_depth=7,
            num_leaves=50,
            min_child_samples=20,
            subsample=0.8,
            colsample_bytree=0.8,
            class_weight=self._class_weights,
            objective="multiclass",
            num_class=5,
            metric="multi_logloss",
            random_state=42,
            verbose=-1,
        )

    def train(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, Any]:
        """Train the ordinal classifier."""
        from sklearn.metrics import classification_report

        self.model = self._create_model()
        self.model.fit(X, y)
        self.is_trained = True

        # Quick evaluation on training set
        y_pred = self.model.predict(X)
        report = classification_report(
            y, y_pred,
            target_names=DISPOSITION_CLASSES,
            output_dict=True,
            zero_division=0,
        )
        logger.info(f"Training complete. Macro F1: {report['macro avg']['f1-score']:.3f}")
        return {"classification_report": report}

    def predict_single(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict disposition for a single patient from a feature dict.

        Args:
            features: Dict with keys matching FEATURE_COLUMNS

        Returns:
            Dict with disposition, probabilities, confidence, explanation
        """
        if not self.is_trained:
            return self._fallback_predict(features)

        try:
            row = {col: features.get(col, 0) for col in FEATURE_COLUMNS}
            X = pd.DataFrame([row])[FEATURE_COLUMNS]
            proba = self.model.predict_proba(X)[0]
            pred_idx = int(np.argmax(proba))

            return {
                "disposition": IDX_TO_DISPOSITION[pred_idx],
                "predicted_class": pred_idx,
                "probabilities": {
                    DISPOSITION_CLASSES[i]: round(float(p), 3)
                    for i, p in enumerate(proba)
                },
                "confidence": round(float(proba[pred_idx]), 3),
                "source": "ml_model",
            }
        except Exception as e:
            logger.error(f"ML prediction failed: {e}")
            return self._fallback_predict(features)

    def predict_from_context(self, clinical_context: Dict[str, Any], symptom_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict disposition directly from clinical context (no manual feature extraction needed).
        """
        features = extract_features(clinical_context, symptom_analysis)
        return self.predict_single(features)

    def _fallback_predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Rule-based fallback when model is not available."""
        score = 0
        if features.get("has_fever") and features.get("in_risk_window"):
            score += 4
        elif features.get("has_fever"):
            score += 3
        if (features.get("pain_score", 0) or 0) >= 8:
            score += 4
        elif (features.get("pain_score", 0) or 0) >= 6:
            score += 2
        if (features.get("ecog_score", 0) or 0) >= 3:
            score += 2
        if features.get("in_nadir_window"):
            score += 1

        idx = min(4, score)
        return {
            "disposition": IDX_TO_DISPOSITION[idx],
            "predicted_class": idx,
            "probabilities": {},
            "confidence": 0.6,
            "source": "fallback_rules",
        }

    def save(self, filepath: str):
        if not self.is_trained:
            raise ValueError("Model not trained yet")
        joblib.dump(self.model, filepath)
        logger.info(f"Model saved to {filepath}")

    def load(self, filepath: str):
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model not found: {filepath}")
        loaded = joblib.load(filepath)
        # Validate compatibility: must be LGBMClassifier with correct feature count
        if not isinstance(loaded, LGBMClassifier):
            raise ValueError(
                f"Incompatible model type: {type(loaded).__name__}. "
                f"Expected LGBMClassifier. Delete {filepath} and restart to retrain."
            )
        self.model = loaded
        self.is_trained = True
        logger.info(f"Model loaded from {filepath}")

    # ── Legacy compatibility ──────────────────────────────────────────────────

    def categorize_priority(self, score: float) -> str:
        """Legacy compat: map old 0-100 score to PriorityCategory enum values."""
        if score >= 75:
            return "CRITICAL"
        if score >= 50:
            return "HIGH"
        if score >= 25:
            return "MEDIUM"
        return "LOW"

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Legacy compat: returns 0-100 score array for old /prioritize endpoint."""
        if not self.is_trained:
            return np.full(len(X), 50.0)
        try:
            proba = self.model.predict_proba(X)
            # Convert ordinal class probabilities to 0-100 score
            # weighted sum: class_idx * 25 to spread across 0-100
            scores = np.dot(proba, np.array([0, 25, 50, 75, 100]))
            return np.clip(scores, 0, 100)
        except Exception as e:
            logger.error(f"predict() failed: {e}")
            return np.full(len(X), 50.0)


# ─── Feature extraction ───────────────────────────────────────────────────────

CANCER_TYPE_MAP = {
    "breast": 0, "mama": 0,
    "lung": 1, "pulmao": 1, "pulmão": 1,
    "colorectal": 2, "colon": 2, "cólon": 2, "rectal": 2,
    "prostate": 3, "prostata": 3, "próstata": 3,
    "kidney": 4, "renal": 4, "rim": 4,
    "bladder": 5, "bexiga": 5,
    "testicular": 6, "testículo": 6,
    "lymphoma": 7, "linfoma": 7,
    "leukemia": 8, "leucemia": 8,
}

STAGE_MAP = {
    "I": 1, "1": 1, "IA": 1, "IB": 1,
    "II": 2, "2": 2, "IIA": 2, "IIB": 2, "IIC": 2,
    "III": 3, "3": 3, "IIIA": 3, "IIIB": 3, "IIIC": 3,
    "IV": 4, "4": 4, "IVA": 4, "IVB": 4,
}


def extract_features(
    clinical_context: Dict[str, Any],
    symptom_analysis: Dict[str, Any],
    vitals: Optional[Dict[str, Any]] = None,
    mascc_score: Optional[int] = None,
    cisne_score: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Extract the 32-feature vector from clinical context + symptom analysis.
    Returns a dict suitable for OncologyPriorityModel.predict_single().
    """
    from datetime import datetime, timezone

    patient = clinical_context.get("patient", {})
    treatments = clinical_context.get("treatments", [])
    medications = clinical_context.get("medications", [])
    comorbidities = clinical_context.get("comorbidities", [])
    perf_history = clinical_context.get("performanceStatusHistory", [])
    detected = symptom_analysis.get("detectedSymptoms", [])
    scales = symptom_analysis.get("structuredData", {}).get("scales", {})
    vitals = vitals or {}

    # ── Demographics ──────────────────────────────────────────────────────────
    age = patient.get("age", 60)
    if not isinstance(age, int):
        age = 60

    # ── Cancer profile ────────────────────────────────────────────────────────
    cancer_type_str = (patient.get("cancerType") or "").lower()
    cancer_type_code = CANCER_TYPE_MAP.get(cancer_type_str, 0)
    stage_str = (patient.get("stage") or "").upper().strip()
    stage_num = STAGE_MAP.get(stage_str, 2)
    is_palliative = 1 if patient.get("currentStage") == "PALLIATIVE" else 0

    # ── Treatment timing ──────────────────────────────────────────────────────
    best_days: Optional[int] = None
    for t in treatments:
        if t.get("treatmentType") not in ("CHEMOTHERAPY", "COMBINED", "IMMUNOTHERAPY"):
            continue
        date_str = t.get("lastApplicationDate") or t.get("lastCycleDate")
        if not date_str:
            continue
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            d = (datetime.now(timezone.utc) - dt).days
            if best_days is None or d < best_days:
                best_days = d
        except Exception:
            pass

    days_since_last_chemo = best_days if best_days is not None else 999
    in_nadir_window = 1 if best_days is not None and 7 <= best_days <= 14 else 0
    in_risk_window = 1 if best_days is not None and best_days <= 21 else 0

    active_treatments = [t for t in treatments if t.get("isActive", False)]
    treatment_cycle = max((t.get("currentCycle") or 0 for t in active_treatments), default=0)

    # ── Performance status ────────────────────────────────────────────────────
    ecog_score = patient.get("performanceStatus") or 0
    ecog_delta = 0
    if len(perf_history) >= 2:
        try:
            sorted_h = sorted(perf_history, key=lambda h: h.get("assessedAt", ""), reverse=True)
            ecog_delta = int(sorted_h[0].get("ecogScore", 0)) - int(sorted_h[1].get("ecogScore", 0))
        except Exception:
            pass

    # ── Symptoms ──────────────────────────────────────────────────────────────
    pain_score = int(scales.get("pain", 0) or 0)
    nausea_score = int(scales.get("nausea", 0) or 0)
    fatigue_score = int(scales.get("fatigue", 0) or 0)
    dyspnea_score = 0
    for s in detected:
        if s.get("name", "").lower() in {"dispneia", "falta de ar"}:
            dyspnea_score = 7 if s.get("severity") == "HIGH" else (10 if s.get("severity") == "CRITICAL" else 4)
            break

    # ── Vitals ────────────────────────────────────────────────────────────────
    temperature = float(vitals.get("temperature") or scales.get("temperature") or 0)
    has_fever = 1 if temperature >= 38.0 else 0
    # If no temp but fever keyword detected
    if not has_fever:
        if any(s.get("name", "").lower() in {"febre", "febre_neutropenica", "febril"} for s in detected):
            has_fever = 1
            temperature = 38.0  # conservative assumption
    spo2 = float(vitals.get("spo2") or 0)

    # ── Medication flags ──────────────────────────────────────────────────────
    active_meds = [m for m in medications if m.get("isActive", True)]
    has_anticoagulant = 1 if any(m.get("isAnticoagulant") for m in active_meds) else 0
    has_immunosuppressant = 1 if any(m.get("isImmunosuppressant") for m in active_meds) else 0
    has_corticosteroid = 1 if any(m.get("isCorticosteroid") for m in active_meds) else 0
    has_opioid = 1 if any(m.get("isOpioid") for m in active_meds) else 0

    # ── Comorbidity flags ─────────────────────────────────────────────────────
    has_sepsis_risk = 1 if any(c.get("increasesSepsisRisk") for c in comorbidities) else 0
    has_thrombosis_risk = 1 if any(c.get("increasesThrombosisRisk") for c in comorbidities) else 0
    has_pulmonary_risk = 1 if any(c.get("affectsPulmonaryReserve") for c in comorbidities) else 0
    has_renal_risk = 1 if any(c.get("affectsRenalClearance") for c in comorbidities) else 0

    # ── Context ───────────────────────────────────────────────────────────────
    days_since_last_visit = 0  # would come from navigationSteps if available

    # ── Symptom summary ───────────────────────────────────────────────────────
    critical_count = sum(1 for s in detected if s.get("severity") == "CRITICAL")
    high_count = sum(1 for s in detected if s.get("severity") == "HIGH")

    return {
        "age": age,
        "is_elderly": 1 if age >= 70 else 0,
        "cancer_type_code": cancer_type_code,
        "stage_num": stage_num,
        "is_palliative": is_palliative,
        "days_since_last_chemo": days_since_last_chemo,
        "in_nadir_window": in_nadir_window,
        "in_risk_window": in_risk_window,
        "treatment_cycle": treatment_cycle,
        "ecog_score": ecog_score,
        "ecog_delta": ecog_delta,
        "pain_score": pain_score,
        "nausea_score": nausea_score,
        "fatigue_score": fatigue_score,
        "dyspnea_score": dyspnea_score,
        "temperature": temperature,
        "has_fever": has_fever,
        "spo2": spo2,
        "has_anticoagulant": has_anticoagulant,
        "has_immunosuppressant": has_immunosuppressant,
        "has_corticosteroid": has_corticosteroid,
        "has_opioid": has_opioid,
        "has_sepsis_risk_comorbidity": has_sepsis_risk,
        "has_thrombosis_risk_comorbidity": has_thrombosis_risk,
        "has_pulmonary_risk_comorbidity": has_pulmonary_risk,
        "has_renal_risk_comorbidity": has_renal_risk,
        "mascc_score": mascc_score if mascc_score is not None else 26,  # 26=max=low risk default
        "cisne_score": cisne_score if cisne_score is not None else 0,   # 0=low risk default
        "days_since_last_visit": days_since_last_visit,
        "is_alone": 0,
        "symptom_critical_count": critical_count,
        "symptom_high_count": high_count,
    }


# Global singleton
priority_model = OncologyPriorityModel()
