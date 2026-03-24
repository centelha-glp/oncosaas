import logging
from typing import Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models.priority_model import (
    CANCER_TYPE_MAP,
    FEATURE_COLUMNS,
    STAGE_MAP,
    priority_model,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class PriorityRequest(BaseModel):
    patient_id: Optional[str] = None
    cancer_type: Optional[str] = "other"
    stage: Optional[str] = "II"
    performance_status: Optional[int] = 1
    age: Optional[int] = 60
    pain_score: Optional[int] = 0
    nausea_score: Optional[int] = 0
    fatigue_score: Optional[int] = 0
    has_fever: Optional[bool] = False
    days_since_last_visit: Optional[int] = 30
    treatment_cycle: Optional[int] = 0


class PriorityResponse(BaseModel):
    patient_id: Optional[str] = None
    priority_score: float
    priority_category: str
    reason: str


class BulkPriorityRequest(BaseModel):
    patients: List[PriorityRequest]


class BulkPriorityResponse(BaseModel):
    results: List[PriorityResponse]


DISPOSITION_TO_SCORE = {
    "REMOTE_NURSING": 12.5,
    "SCHEDULED_CONSULT": 37.5,
    "ADVANCE_CONSULT": 62.5,
    "ER_DAYS": 87.5,
    "ER_IMMEDIATE": 100.0,
}

PRIORITY_STAGE_MAP = STAGE_MAP
PRIORITY_CANCER_MAP = CANCER_TYPE_MAP


def _build_features(req: PriorityRequest) -> Dict[str, float]:
    ct = (req.cancer_type or "").lower().strip()
    st = (req.stage or "").upper().strip()
    stage_num = PRIORITY_STAGE_MAP.get(st, 2)
    age = req.age if req.age is not None else 60
    ecog = req.performance_status if req.performance_status is not None else 0
    pain = req.pain_score or 0
    nausea = req.nausea_score or 0
    fatigue = req.fatigue_score or 0
    fever = 1 if req.has_fever else 0
    days_visit = req.days_since_last_visit if req.days_since_last_visit is not None else 0
    cycle = req.treatment_cycle or 0

    features = {col: 0 for col in FEATURE_COLUMNS}
    features["age"] = age
    features["is_elderly"] = 1 if age >= 70 else 0
    features["cancer_type_code"] = PRIORITY_CANCER_MAP.get(ct, 0)
    features["stage_num"] = stage_num
    features["is_palliative"] = 1 if stage_num >= 4 else 0
    features["days_since_last_chemo"] = 999
    features["in_nadir_window"] = 0
    features["in_risk_window"] = 0
    features["treatment_cycle"] = cycle
    features["ecog_score"] = min(4, max(0, ecog))
    features["ecog_delta"] = 0
    features["pain_score"] = pain
    features["nausea_score"] = nausea
    features["fatigue_score"] = fatigue
    features["dyspnea_score"] = 0
    features["temperature"] = 0
    features["has_fever"] = fever
    features["spo2"] = 0
    features["days_since_last_visit"] = days_visit
    features["is_alone"] = 0
    features["symptom_critical_count"] = 0
    features["symptom_high_count"] = 0
    return features


def _build_reason(req: PriorityRequest) -> str:
    reasons = []
    stage_str = (req.stage or "II").upper().strip()
    perf = req.performance_status if req.performance_status is not None else 0
    days_visit = req.days_since_last_visit if req.days_since_last_visit is not None else 0
    if req.has_fever:
        reasons.append("Febre reportada")
    if (req.pain_score or 0) >= 7:
        reasons.append("Dor intensa reportada")
    if stage_str in ("IV", "4"):
        reasons.append("Estadiamento avançado")
    if perf >= 3:
        reasons.append("Performance status comprometido")
    if days_visit > 45:
        reasons.append("Longo período sem consulta")
    if (req.fatigue_score or 0) >= 7:
        reasons.append("Fadiga severa")
    if (req.nausea_score or 0) >= 7:
        reasons.append("Náusea severa")
    return "; ".join(reasons) if reasons else "Priorização baseada em múltiplos fatores clínicos"


def _fallback_score(req: PriorityRequest) -> float:
    score = 0.0
    stage_str = (req.stage or "II").upper().strip()
    perf = req.performance_status if req.performance_status is not None else 0
    days_visit = req.days_since_last_visit if req.days_since_last_visit is not None else 0
    if req.has_fever:
        score += 40
    if (req.pain_score or 0) >= 8:
        score += 30
    if stage_str in ("IV", "4"):
        score += 20
    if perf >= 3:
        score += 25
    if days_visit > 60:
        score += 15
    if (req.fatigue_score or 0) >= 7:
        score += 10
    return min(100.0, score)


@router.post("/prioritize")
async def prioritize_patient(request: PriorityRequest):
    try:
        score = 50.0
        try:
            if priority_model.is_trained:
                features = _build_features(request)
                out = priority_model.predict_single(features)
                disposition = out.get("disposition", "SCHEDULED_CONSULT")
                score = DISPOSITION_TO_SCORE.get(disposition, 50.0)
            else:
                score = _fallback_score(request)
        except Exception as e:
            logger.warning("Prioritize ML/fallback failed, using heuristic: %s", e, exc_info=True)
            try:
                score = _fallback_score(request)
            except Exception:
                score = 50.0

        try:
            category = priority_model.categorize_priority(score)
        except Exception:
            category = "MEDIUM"

        try:
            reason = _build_reason(request)
        except Exception:
            reason = "Priorização baseada em múltiplos fatores clínicos"

        return PriorityResponse(
            patient_id=request.patient_id,
            priority_score=round(float(score), 1),
            priority_category=category,
            reason=reason,
        )
    except Exception as e:
        logger.error("Prioritize endpoint unexpected error: %s", e, exc_info=True)
        return PriorityResponse(
            patient_id=getattr(request, "patient_id", None),
            priority_score=50.0,
            priority_category="MEDIUM",
            reason="Priorização baseada em múltiplos fatores clínicos",
        )


@router.post("/prioritize-bulk", response_model=BulkPriorityResponse)
async def prioritize_patients_bulk(request: BulkPriorityRequest):
    try:
        results: List[PriorityResponse] = []

        if priority_model.is_trained and request.patients:
            feature_list = [_build_features(p) for p in request.patients]
            df = pd.DataFrame(feature_list)[FEATURE_COLUMNS]
            predictions = priority_model.predict(df)

            for i, patient_req in enumerate(request.patients):
                score = float(predictions[i])
                results.append(
                    PriorityResponse(
                        patient_id=patient_req.patient_id,
                        priority_score=round(score, 1),
                        priority_category=priority_model.categorize_priority(score),
                        reason=_build_reason(patient_req),
                    )
                )
        else:
            for patient_req in request.patients:
                score = _fallback_score(patient_req)
                results.append(
                    PriorityResponse(
                        patient_id=patient_req.patient_id,
                        priority_score=round(score, 1),
                        priority_category=priority_model.categorize_priority(score),
                        reason=_build_reason(patient_req),
                    )
                )

        return BulkPriorityResponse(results=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao calcular prioridade em lote: {str(e)}")
