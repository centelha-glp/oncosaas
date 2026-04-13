import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..agent.clinical_rules import _SEVERITY_ORDER, REMOTE_NURSING, clinical_rules_engine
from ..agent.clinical_scores import clinical_scores
from ..models.priority_model import extract_features, priority_model
from ..models.schemas import (
    BulkPredictRiskRequest,
    BulkPredictRiskResponse,
    PredictRiskRequest,
    PredictRiskResponse,
    RiskPrediction,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class RiskPredictRequest(BaseModel):
    clinical_context: Dict
    symptom_analysis: Dict
    vitals: Optional[Dict] = None


class RiskPredictResult(BaseModel):
    disposition: str
    disposition_label: str
    confidence: float
    probabilities: Dict[str, float]
    source: str
    mascc_score: Optional[int] = None
    cisne_score: Optional[int] = None
    febrile_neutropenia_risk: Optional[str] = None
    clinical_rules_findings: List[Dict] = Field(default_factory=list)


_DISPOSITION_LABELS = {
    "REMOTE_NURSING": "Enfermagem remota",
    "SCHEDULED_CONSULT": "Consulta programada",
    "ADVANCE_CONSULT": "Antecipar consulta",
    "ER_DAYS": "PS nos próximos dias",
    "ER_IMMEDIATE": "PS imediatamente",
}


@router.post("/risk/predict", response_model=RiskPredictResult)
async def predict_risk(request: RiskPredictRequest):
    try:
        rules_result = clinical_rules_engine.evaluate(
            symptom_analysis=request.symptom_analysis,
            clinical_context=request.clinical_context,
            structured_vitals=request.vitals,
        )

        has_fever = bool(
            (request.vitals or {}).get("temperature", 0) >= 38.0
            or any(
                s.get("name", "").lower() in {"febre", "febre_neutropenica"}
                for s in request.symptom_analysis.get("detectedSymptoms", [])
            )
        )
        scores_result = clinical_scores.evaluate_febrile_neutropenia_risk(
            clinical_context=request.clinical_context,
            symptom_analysis=request.symptom_analysis,
            has_fever=has_fever,
            vitals=request.vitals,
        )

        mascc_score = scores_result.mascc.score if scores_result.mascc else None
        cisne_score = scores_result.cisne.score if scores_result.cisne else None

        ml_features = extract_features(
            request.clinical_context,
            request.symptom_analysis,
            vitals=request.vitals,
            mascc_score=mascc_score,
            cisne_score=cisne_score,
        )
        ml_result = priority_model.predict_single(ml_features)

        final_disposition = rules_result.disposition
        source = "clinical_rules"

        if final_disposition == REMOTE_NURSING and ml_result["source"] != "fallback_rules":
            ml_sev = _SEVERITY_ORDER.get(ml_result["disposition"], 0)
            if ml_sev > 0:
                final_disposition = ml_result["disposition"]
                source = "ml_model"

        return RiskPredictResult(
            disposition=final_disposition,
            disposition_label=_DISPOSITION_LABELS.get(final_disposition, final_disposition),
            confidence=rules_result.confidence if source == "clinical_rules" else ml_result["confidence"],
            probabilities=ml_result.get("probabilities", {}),
            source=source,
            mascc_score=mascc_score,
            cisne_score=cisne_score,
            febrile_neutropenia_risk=scores_result.overall_febrile_neutropenia_risk if has_fever else None,
            clinical_rules_findings=[
                {"rule_id": f.rule_id, "disposition": f.disposition, "reason": f.reason}
                for f in rules_result.findings
            ],
        )
    except Exception:
        logger.exception("Risk prediction failed")
        raise HTTPException(
            status_code=500,
            detail="Risk prediction failed",
        )


def _is_overdue(due_date_str: str) -> bool:
    try:
        due = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
        return due < datetime.now(timezone.utc)
    except (ValueError, TypeError):
        return False


def _analyze_patient_risk(req: PredictRiskRequest) -> List[RiskPrediction]:
    risks: List[RiskPrediction] = []
    now = datetime.now(timezone.utc)

    for step in req.navigation_steps:
        if step.status in ("COMPLETED", "CANCELLED", "SKIPPED"):
            continue
        if not step.due_date:
            continue
        try:
            due = datetime.fromisoformat(step.due_date.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue

        days_until = (due - now).days

        if days_until < 0:
            prob = min(1.0, 0.8 + abs(days_until) * 0.01)
            sev = "CRITICAL" if abs(days_until) > 14 else "HIGH"
            risks.append(
                RiskPrediction(
                    risk_type="STEP_DELAY",
                    probability=round(prob, 2),
                    severity=sev,
                    message=f"Etapa '{step.step_name}' está atrasada {abs(days_until)} dias (prazo: {step.due_date[:10]})",
                    details={"step_key": step.step_key, "days_overdue": abs(days_until)},
                )
            )
        elif days_until <= 7 and step.status == "PENDING":
            prob = round(0.5 + (7 - days_until) * 0.06, 2)
            risks.append(
                RiskPrediction(
                    risk_type="STEP_DELAY",
                    probability=min(1.0, prob),
                    severity="HIGH" if days_until <= 3 else "MEDIUM",
                    message=f"Etapa '{step.step_name}' vence em {days_until} dias e ainda está pendente",
                    details={"step_key": step.step_key, "days_until_due": days_until},
                )
            )

    if len(req.esas_history) >= 2:
        newest = req.esas_history[0].scores
        previous = req.esas_history[1].scores

        tracked = [
            "pain",
            "fatigue",
            "nausea",
            "anxiety",
            "depression",
            "drowsiness",
            "appetite",
            "wellbeing",
            "dyspnea",
        ]

        for symptom in tracked:
            curr = newest.get(symptom)
            prev = previous.get(symptom)
            if curr is None or prev is None:
                continue
            try:
                curr_val = float(curr)
                prev_val = float(prev)
            except (ValueError, TypeError):
                continue

            delta = curr_val - prev_val
            if delta >= 3 and curr_val >= 7:
                risks.append(
                    RiskPrediction(
                        risk_type="SYMPTOM_WORSENING",
                        probability=round(min(1.0, 0.7 + delta * 0.05), 2),
                        severity="CRITICAL" if curr_val >= 9 else "HIGH",
                        message=f"Piora significativa de {symptom}: {prev_val:.0f} → {curr_val:.0f} (+{delta:.0f} pontos)",
                        details={"symptom": symptom, "previous": prev_val, "current": curr_val, "delta": delta},
                    )
                )
            elif delta >= 2 and curr_val >= 5:
                risks.append(
                    RiskPrediction(
                        risk_type="SYMPTOM_WORSENING",
                        probability=round(min(1.0, 0.5 + delta * 0.08), 2),
                        severity="MEDIUM",
                        message=f"Tendência de piora em {symptom}: {prev_val:.0f} → {curr_val:.0f} (+{delta:.0f} pontos)",
                        details={"symptom": symptom, "previous": prev_val, "current": curr_val, "delta": delta},
                    )
                )

    no_response_threshold = req.min_days_no_interaction_alert or 7

    if req.has_interacted and req.last_interaction_days >= no_response_threshold:
        if req.last_interaction_days >= no_response_threshold * 2:
            prob = min(1.0, 0.85 + (req.last_interaction_days - no_response_threshold * 2) * 0.01)
            sev = "HIGH"
        else:
            prob = round(0.4 + (req.last_interaction_days - no_response_threshold) * 0.04, 2)
            sev = "MEDIUM"

        risks.append(
            RiskPrediction(
                risk_type="NO_RESPONSE",
                probability=min(1.0, prob),
                severity=sev,
                message=f"Paciente sem interação há {req.last_interaction_days} dias",
                details={
                    "last_interaction_days": req.last_interaction_days,
                    "threshold_days": no_response_threshold,
                },
            )
        )

    abandon_score = 0.0
    if req.last_interaction_days >= 10:
        abandon_score += 0.25
    if req.last_interaction_days >= 21:
        abandon_score += 0.20

    overdue_required = sum(
        1
        for s in req.navigation_steps
        if s.is_required and s.status == "PENDING" and s.due_date and _is_overdue(s.due_date)
    )
    if overdue_required >= 2:
        abandon_score += 0.20
    elif overdue_required >= 1:
        abandon_score += 0.10

    if req.total_messages > 0 and req.days_since_registration > 14:
        msg_rate = req.total_messages / max(1, req.days_since_registration / 7)
        if msg_rate < 0.5:
            abandon_score += 0.15

    if req.performance_status is not None and req.performance_status >= 3:
        abandon_score += 0.10

    if abandon_score >= 0.40:
        sev = "CRITICAL" if abandon_score >= 0.70 else "HIGH" if abandon_score >= 0.55 else "MEDIUM"
        risks.append(
            RiskPrediction(
                risk_type="ABANDONMENT",
                probability=round(min(1.0, abandon_score), 2),
                severity=sev,
                message=f"Risco de abandono do tratamento (score: {abandon_score:.0%})",
                details={
                    "abandon_score": round(abandon_score, 2),
                    "overdue_steps": overdue_required,
                    "last_interaction_days": req.last_interaction_days,
                },
            )
        )

    return risks


def _highest_severity(risks: List[RiskPrediction]) -> str:
    order = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    if not risks:
        return "LOW"
    return max(risks, key=lambda r: order.get(r.severity, 0)).severity


@router.post("/agent/predict-risk", response_model=PredictRiskResponse)
async def predict_agent_risk(request: PredictRiskRequest):
    try:
        risks = _analyze_patient_risk(request)
        return PredictRiskResponse(
            patient_id=request.patient_id,
            risks=risks,
            highest_severity=_highest_severity(risks),
        )
    except Exception:
        logger.exception("Erro ao predizer risco (predict_agent_risk)")
        raise HTTPException(
            status_code=500,
            detail="Erro ao predizer risco",
        )


@router.post("/agent/predict-risk-bulk", response_model=BulkPredictRiskResponse)
async def predict_risk_bulk(request: BulkPredictRiskRequest):
    try:
        results: List[PredictRiskResponse] = []
        for patient in request.patients:
            risks = _analyze_patient_risk(patient)
            results.append(
                PredictRiskResponse(
                    patient_id=patient.patient_id,
                    risks=risks,
                    highest_severity=_highest_severity(risks),
                )
            )
        return BulkPredictRiskResponse(results=results)
    except Exception:
        logger.exception("Erro ao predizer riscos em lote")
        raise HTTPException(
            status_code=500,
            detail="Erro ao predizer riscos em lote",
        )
