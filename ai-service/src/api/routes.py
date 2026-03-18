import logging
from typing import Dict, List, Optional
from ..models.priority_model import priority_model, FEATURE_COLUMNS, extract_features, STAGE_MAP as PRIORITY_STAGE_MAP, CANCER_TYPE_MAP as PRIORITY_CANCER_MAP
from ..agent.tracer import tracer
from ..models.schemas import (
    AgentProcessRequest,
    AgentProcessResponse,
    BuildContextRequest,
    ClinicalContextResponse,
    SymptomAnalysisRequest,
    SymptomAnalysisResponse,
    DetectedSymptom,
    QuestionnaireScoreRequest,
    QuestionnaireScoreResponse,
    ProtocolEvaluateRequest,
    ProtocolEvaluateResponse,
    CheckInMessageRequest,
    CheckInMessageResponse,
    PredictRiskRequest,
    PredictRiskResponse,
    RiskPrediction,
    BulkPredictRiskRequest,
    BulkPredictRiskResponse,
    NurseAssistRequest,
    NurseAssistResponse,
    SuggestedReply,
    SuggestedAction,
    PatientSummaryRequest,
    PatientSummaryResponse,
    SummaryHighlight,
    SummaryRisk,
    SummaryNextStep,
)
from ..agent.whatsapp_agent import whatsapp_agent
from ..agent.orchestrator import orchestrator
from ..agent.context_builder import context_builder
from ..agent.symptom_analyzer import symptom_analyzer
from ..agent.questionnaire_engine import questionnaire_engine
from ..agent.protocol_engine import protocol_engine
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================
# Models de requisição/resposta (legacy)
# ============================================

@router.get("/debug/llm-status")
async def debug_llm_status():
    """Diagnostic endpoint: check if LLM keys are available."""
    import os
    from ..agent.llm_provider import llm_provider

    has_any = llm_provider.has_any_llm_key({})
    has_anthropic = llm_provider.has_anthropic_key({})

    anthropic_env = os.getenv("ANTHROPIC_API_KEY", "")
    openai_env = os.getenv("OPENAI_API_KEY", "")

    def mask(k: str) -> str:
        if not k or len(k) < 8:
            return f"(len={len(k)})"
        return f"{k[:6]}...{k[-4:]} (len={len(k)})"

    return {
        "has_any_llm_key": has_any,
        "has_anthropic_key": has_anthropic,
        "anthropic_from_env": mask(anthropic_env),
        "openai_from_env": mask(openai_env),
        "anthropic_from_dotenv": mask(llm_provider._resolve_api_key("ANTHROPIC_API_KEY", None) or ""),
        "openai_from_dotenv": mask(llm_provider._resolve_api_key("OPENAI_API_KEY", None) or ""),
    }


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


class AgentMessageRequest(BaseModel):
    message: str
    patient_id: str
    patient_context: Dict
    conversation_history: List[Dict]


class AgentMessageResponse(BaseModel):
    response: str
    critical_symptoms: List[str]
    structured_data: Dict
    should_alert: bool


# ============================================
# Priority endpoint
# ============================================

# Mapeamento disposição → score 0-100 (legado) para resposta do /prioritize
DISPOSITION_TO_SCORE = {
    "REMOTE_NURSING": 12.5,
    "SCHEDULED_CONSULT": 37.5,
    "ADVANCE_CONSULT": 62.5,
    "ER_DAYS": 87.5,
    "ER_IMMEDIATE": 100.0,
}


def _build_features(req: PriorityRequest) -> Dict[str, float]:
    """Monta dict com as 32 features do modelo; faltando = 0 (compatível com predict_single)."""
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
    return (
        "; ".join(reasons)
        if reasons
        else "Priorização baseada em múltiplos fatores clínicos"
    )


def _fallback_score(req: PriorityRequest) -> float:
    score = 0.0
    stage_str = (req.stage or "II").upper().strip()
    perf = req.performance_status if req.performance_status is not None else 0
    days_visit = req.days_since_last_visit if req.days_since_last_visit is not None else 0
    if req.has_fever:
        score += 40  # Febre em paciente oncológico = prioridade alta
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
    """Calculate priority score for a single patient."""
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
    """Calculate priority scores for multiple patients at once (used by daily scheduler)."""
    try:
        import pandas as pd

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
        raise HTTPException(
            status_code=500, detail=f"Erro ao calcular prioridade em lote: {str(e)}"
        )


# ============================================
# Rich risk prediction endpoint (Phase 3)
# ============================================


class RiskPredictRequest(BaseModel):
    """Rich risk prediction from full clinical context."""
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
    clinical_rules_findings: List[Dict] = []


_DISPOSITION_LABELS = {
    "REMOTE_NURSING": "Enfermagem remota",
    "SCHEDULED_CONSULT": "Consulta programada",
    "ADVANCE_CONSULT": "Antecipar consulta",
    "ER_DAYS": "PS nos próximos dias",
    "ER_IMMEDIATE": "PS imediatamente",
}


@router.post("/risk/predict", response_model=RiskPredictResult)
async def predict_risk(request: RiskPredictRequest):
    """
    Full clinical risk prediction using 4-layer architecture:
      Layer 1: Clinical rules (deterministic)
      Layer 2: Validated scores (MASCC/CISNE)
      Layer 3: ML ordinal classifier
    Returns the highest-priority recommendation.
    """
    from ..agent.clinical_rules import clinical_rules_engine
    from ..agent.clinical_scores import clinical_scores

    try:
        # Layer 1+2: Rules engine (already incorporates MASCC/CISNE)
        rules_result = clinical_rules_engine.evaluate(
            symptom_analysis=request.symptom_analysis,
            clinical_context=request.clinical_context,
            structured_vitals=request.vitals,
        )

        # Layer 2: Explicit MASCC/CISNE for response enrichment
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

        # Layer 3: ML model (only used for non-rule-firing cases for now)
        ml_features = extract_features(
            request.clinical_context,
            request.symptom_analysis,
            vitals=request.vitals,
            mascc_score=mascc_score,
            cisne_score=cisne_score,
        )
        ml_result = priority_model.predict_single(ml_features)

        # Final disposition: rules take precedence, ML informs ambiguous cases
        from ..agent.clinical_rules import REMOTE_NURSING, _SEVERITY_ORDER
        final_disposition = rules_result.disposition
        source = "clinical_rules"

        if final_disposition == REMOTE_NURSING and ml_result["source"] != "fallback_rules":
            # If rules say remote nursing but ML is more concerned, take ML
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk prediction failed: {str(e)}")


# ============================================
# Legacy agent message endpoint
# ============================================


@router.post("/agent/message", response_model=AgentMessageResponse)
async def process_agent_message(request: AgentMessageRequest):
    """
    Processa mensagem do paciente via agente de IA (endpoint legado)
    """
    try:
        result = whatsapp_agent.process_message(
            message=request.message,
            patient_context=request.patient_context,
            conversation_history=request.conversation_history,
        )
        return AgentMessageResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao processar mensagem: {str(e)}"
        )


# ============================================
# New Agent Orchestrator endpoints
# ============================================


@router.post("/agent/process", response_model=AgentProcessResponse)
async def process_message(request: AgentProcessRequest):
    """
    Endpoint principal: processa mensagem e retorna resposta + ações.
    Called by the NestJS backend agent service.
    """
    try:
        result = await orchestrator.process(
            {
                "message": request.message,
                "patient_id": request.patient_id,
                "tenant_id": request.tenant_id,
                "clinical_context": request.clinical_context,
                "protocol": request.protocol,
                "conversation_history": request.conversation_history,
                "agent_state": request.agent_state,
                "agent_config": request.agent_config,
            }
        )

        return AgentProcessResponse(
            response=result.get("response", ""),
            actions=result.get("actions", []),
            symptom_analysis=result.get("symptom_analysis"),
            clinical_disposition=result.get("clinical_disposition"),
            clinical_disposition_reason=result.get("clinical_disposition_reason"),
            clinical_rules_findings=result.get("clinical_rules_findings", []),
            new_state=result.get("new_state", {}),
            decisions=result.get("decisions", []),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar mensagem pelo agente: {str(e)}",
        )


@router.post("/agent/build-context", response_model=ClinicalContextResponse)
async def build_clinical_context(request: BuildContextRequest):
    """
    Monta contexto clínico RAG para um paciente.
    """
    try:
        context_str = context_builder.build(
            clinical_context=request.clinical_context,
            protocol=request.protocol,
        )

        patient = request.clinical_context.get("patient", {})
        patient_summary = (
            f"{patient.get('name', 'Paciente')}: "
            f"{patient.get('cancerType', 'N/A')}, "
            f"estágio {patient.get('stage', 'N/A')}, "
            f"etapa {patient.get('currentStage', 'N/A')}, "
            f"prioridade {patient.get('priorityCategory', 'N/A')}"
        )

        return ClinicalContextResponse(
            context=context_str,
            patient_summary=patient_summary,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao montar contexto clínico: {str(e)}",
        )


@router.post("/agent/analyze-symptoms", response_model=SymptomAnalysisResponse)
async def analyze_symptoms(request: SymptomAnalysisRequest):
    """
    Analisa sintomas em uma mensagem.
    """
    try:
        result = await symptom_analyzer.analyze(
            message=request.message,
            clinical_context=request.clinical_context,
            cancer_type=request.cancer_type,
            use_llm=request.use_llm,
            llm_config=request.agent_config,
        )

        return SymptomAnalysisResponse(
            detected_symptoms=[
                DetectedSymptom(
                    name=s.get("name", ""),
                    severity=s.get("severity", "LOW"),
                    confidence=s.get("confidence", 0),
                    action=s.get("action"),
                    details=s.get("details"),
                )
                for s in result.get("detectedSymptoms", [])
            ],
            overall_severity=result.get("overallSeverity", "LOW"),
            requires_escalation=result.get("requiresEscalation", False),
            structured_data=result.get("structuredData", {}),
            escalation_reason=result.get("escalationReason"),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao analisar sintomas: {str(e)}",
        )


@router.post("/agent/score-questionnaire", response_model=QuestionnaireScoreResponse)
async def score_questionnaire(request: QuestionnaireScoreRequest):
    """
    Calcula e interpreta scores de questionário (ESAS ou PRO-CTCAE).
    """
    try:
        scores = questionnaire_engine.score_responses(
            questionnaire_type=request.questionnaire_type,
            answers=request.answers,
        )

        return QuestionnaireScoreResponse(
            questionnaire_type=request.questionnaire_type,
            scores=scores,
            interpretation=scores.get("interpretation", ""),
            alerts=scores.get("alerts", []),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao calcular score do questionário: {str(e)}",
        )


@router.post("/agent/evaluate-protocol", response_model=ProtocolEvaluateResponse)
async def evaluate_protocol(request: ProtocolEvaluateRequest):
    """
    Avalia regras do protocolo clínico para um paciente.
    """
    try:
        actions = protocol_engine.evaluate(
            cancer_type=request.cancer_type,
            journey_stage=request.journey_stage,
            symptom_analysis=request.symptom_analysis,
            agent_state=request.agent_state,
            protocol=request.protocol,
        )

        return ProtocolEvaluateResponse(
            actions=actions,
            required_questionnaire=protocol_engine.get_required_questionnaire(
                request.cancer_type or "", request.journey_stage or ""
            ),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao avaliar protocolo: {str(e)}",
        )


# ============================================
# Personalized check-in message
# ============================================


@router.post("/agent/checkin-message", response_model=CheckInMessageResponse)
async def generate_checkin_message(request: CheckInMessageRequest):
    """
    Generate a personalized check-in message for a patient using LLM + clinical context.
    Called by the backend scheduler before sending proactive messages.
    """
    from ..agent.llm_provider import llm_provider
    from ..agent.context_builder import context_builder

    patient = request.clinical_context.get("patient", {})
    patient_name = patient.get("name", "").split()[0] if patient.get("name") else ""

    action_prompts = {
        "CHECK_IN": "mensagem de check-in perguntando como o paciente está se sentindo",
        "QUESTIONNAIRE": "mensagem introduzindo um questionário de acompanhamento de sintomas",
        "MEDICATION_REMINDER": "lembrete gentil sobre medicação",
        "APPOINTMENT_REMINDER": "lembrete sobre etapa com prazo próximo (prazo não é agendamento); perguntar se o paciente já tem agendamento",
        "FOLLOW_UP": "mensagem de acompanhamento após consulta ou procedimento recente",
    }
    action_desc = action_prompts.get(request.action_type, action_prompts["CHECK_IN"])

    clinical_summary = context_builder.build(
        clinical_context=request.clinical_context,
    )

    system_prompt = (
        "Você é o assistente de navegação oncológica OncoNav. "
        "Gere UMA mensagem curta (2-4 frases) e empática para o paciente. "
        "Use linguagem simples, acolhedora e personalizada com base no contexto clínico. "
        "Trate o paciente pelo primeiro nome quando disponível. "
        "NÃO faça diagnósticos. NÃO prescreva medicamentos. "
        "Inclua perguntas abertas relevantes ao momento do tratamento. "
        "PRAZO vs AGENDAMENTO: as datas nas etapas são PRAZOS (data-meta), não agendamento confirmado. "
        "Em lembretes de etapa, use 'prazo' e pergunte se já tem agendamento; não diga 'compromisso agendado'.\n\n"
        f"CONTEXTO CLÍNICO:\n{clinical_summary}"
    )

    user_message = f"Gere uma {action_desc} para {patient_name or 'o paciente'}."

    config = request.agent_config or {}
    api_key = config.get("apiKey") or config.get("api_key")

    if not api_key:
        import os

        api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENAI_API_KEY")

    if api_key:
        try:
            result = await llm_provider.generate(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": user_message}],
                config=(
                    config if config.get("apiKey") or config.get("api_key") else None
                ),
            )
            generated = result.get("content", "").strip()
            if generated and len(generated) > 10:
                return CheckInMessageResponse(message=generated, used_llm=True)
        except Exception:
            pass

    fallbacks = {
        "CHECK_IN": f"Olá{', ' + patient_name if patient_name else ''}! Como você está se sentindo hoje? Algum sintoma novo ou preocupação?",
        "QUESTIONNAIRE": f"Olá{', ' + patient_name if patient_name else ''}! Hora do nosso acompanhamento! Vou fazer algumas perguntas sobre como você está se sentindo. Podemos começar?",
        "MEDICATION_REMINDER": f"Olá{', ' + patient_name if patient_name else ''}! Lembrete: não esqueça de tomar sua medicação conforme prescrito.",
        "APPOINTMENT_REMINDER": f"Olá{', ' + patient_name if patient_name else ''}! Lembrete: você tem uma etapa com prazo próximo. Você já tem isso agendado?",
        "FOLLOW_UP": f"Olá{', ' + patient_name if patient_name else ''}! Como você tem se sentido desde a última consulta?",
    }
    return CheckInMessageResponse(
        message=fallbacks.get(request.action_type, fallbacks["CHECK_IN"]),
        used_llm=False,
    )


# ============================================
# Predictive Risk Analysis
# ============================================


def _analyze_patient_risk(req: PredictRiskRequest) -> List[RiskPrediction]:
    """
    Rule-based risk analysis for a single patient.
    Evaluates: step delays, ESAS worsening, no-response, abandonment.
    """
    from datetime import datetime, timezone

    risks: List[RiskPrediction] = []
    now = datetime.now(timezone.utc)

    # --- 1. Step delay risk ---
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
                    details={
                        "step_key": step.step_key,
                        "days_overdue": abs(days_until),
                    },
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

    # --- 2. ESAS worsening trend ---
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
                        details={
                            "symptom": symptom,
                            "previous": prev_val,
                            "current": curr_val,
                            "delta": delta,
                        },
                    )
                )
            elif delta >= 2 and curr_val >= 5:
                risks.append(
                    RiskPrediction(
                        risk_type="SYMPTOM_WORSENING",
                        probability=round(min(1.0, 0.5 + delta * 0.08), 2),
                        severity="MEDIUM",
                        message=f"Tendência de piora em {symptom}: {prev_val:.0f} → {curr_val:.0f} (+{delta:.0f} pontos)",
                        details={
                            "symptom": symptom,
                            "previous": prev_val,
                            "current": curr_val,
                            "delta": delta,
                        },
                    )
                )

    # --- 3. No-response risk ---
    # Só avaliar se o paciente já interagiu alguma vez (has_interacted).
    # Threshold personalizável por paciente (min_days_no_interaction_alert); padrão = 7.
    # Severidade nunca CRITICAL para NO_RESPONSE — no máximo HIGH.
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

    # --- 4. Treatment abandonment risk ---
    abandon_score = 0.0
    if req.last_interaction_days >= 10:
        abandon_score += 0.25
    if req.last_interaction_days >= 21:
        abandon_score += 0.20

    overdue_required = sum(
        1
        for s in req.navigation_steps
        if s.is_required
        and s.status == "PENDING"
        and s.due_date
        and _is_overdue(s.due_date)
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
        sev = (
            "CRITICAL"
            if abandon_score >= 0.70
            else "HIGH" if abandon_score >= 0.55 else "MEDIUM"
        )
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


def _is_overdue(due_date_str: str) -> bool:
    from datetime import datetime, timezone

    try:
        due = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
        return due < datetime.now(timezone.utc)
    except (ValueError, TypeError):
        return False


def _highest_severity(risks: List[RiskPrediction]) -> str:
    order = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    if not risks:
        return "LOW"
    return max(risks, key=lambda r: order.get(r.severity, 0)).severity


@router.post("/agent/predict-risk", response_model=PredictRiskResponse)
async def predict_risk_agent(request: PredictRiskRequest):
    """Predict risk factors for a single patient (delays, worsening, abandonment)."""
    try:
        risks = _analyze_patient_risk(request)
        return PredictRiskResponse(
            patient_id=request.patient_id,
            risks=risks,
            highest_severity=_highest_severity(risks),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao predizer risco: {str(e)}")


@router.post("/agent/predict-risk-bulk", response_model=BulkPredictRiskResponse)
async def predict_risk_bulk(request: BulkPredictRiskRequest):
    """Predict risk factors for multiple patients at once (daily scheduler)."""
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
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao predizer riscos em lote: {str(e)}"
        )


# ============================================
# Nurse AI Assistant
# ============================================

NURSE_ASSIST_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "nurse_assist_output",
            "description": "Output structured nurse assistance: summary, suggested replies and actions",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Brief clinical summary of the conversation (2-4 sentences in Portuguese)",
                    },
                    "suggested_replies": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {
                                    "type": "string",
                                    "description": "Short label: Empática, Informativa, or Ação",
                                },
                                "text": {
                                    "type": "string",
                                    "description": "Full message text for the nurse to send",
                                },
                            },
                            "required": ["label", "text"],
                        },
                        "description": "Exactly 3 suggested replies",
                    },
                    "suggested_actions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "action": {
                                    "type": "string",
                                    "description": "Action description",
                                },
                                "reason": {
                                    "type": "string",
                                    "description": "Why this action is recommended",
                                },
                                "priority": {
                                    "type": "string",
                                    "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                                },
                            },
                            "required": ["action", "reason", "priority"],
                        },
                        "description": "0-3 suggested clinical actions",
                    },
                },
                "required": ["summary", "suggested_replies", "suggested_actions"],
            },
        },
    }
]


def _build_nurse_assist_fallback(request: NurseAssistRequest) -> NurseAssistResponse:
    """Rule-based fallback when LLM is unavailable."""
    import logging

    logger = logging.getLogger(__name__)
    logger.info("Nurse assist: using rule-based fallback")

    parts = []
    parts.append(f"Paciente: {request.patient_name}")
    if request.cancer_type:
        parts.append(f"Diagnóstico: {request.cancer_type}")
    if request.stage:
        parts.append(f"Estádio: {request.stage}")
    if request.priority_category:
        parts.append(f"Prioridade: {request.priority_category}")

    if request.recent_symptoms:
        parts.append(f"Sintomas recentes: {', '.join(request.recent_symptoms[:5])}")

    pending_steps = [
        s for s in request.navigation_steps if s.status in ("PENDING", "IN_PROGRESS")
    ]
    if pending_steps:
        parts.append(f"Etapas pendentes: {len(pending_steps)}")

    if request.alerts:
        parts.append(f"Alertas ativos: {len(request.alerts)}")

    summary = ". ".join(parts) + "."

    replies = [
        SuggestedReply(
            label="Empática",
            text=f"Olá {request.patient_name.split()[0]}, obrigada por compartilhar. Estamos acompanhando você de perto. Como está se sentindo agora?",
        ),
        SuggestedReply(
            label="Informativa",
            text=f"Olá {request.patient_name.split()[0]}, recebi suas informações. Vou verificar com a equipe e retorno em breve com orientações.",
        ),
        SuggestedReply(
            label="Ação",
            text=f"{request.patient_name.split()[0]}, com base no que você relatou, vou agendar uma avaliação. Posso entrar em contato para confirmar horário?",
        ),
    ]

    actions = []
    high_symptoms = [
        s
        for s in request.recent_symptoms
        if any(kw in s.lower() for kw in ["dor", "febre", "sangramento", "falta de ar"])
    ]
    if high_symptoms:
        actions.append(
            SuggestedAction(
                action="Avaliar sintomas reportados e considerar consulta presencial",
                reason=f"Paciente reportou: {', '.join(high_symptoms[:3])}",
                priority="HIGH",
            )
        )

    overdue = [
        s for s in request.navigation_steps if s.status == "PENDING" and s.due_date
    ]
    if overdue:
        actions.append(
            SuggestedAction(
                action=f"Verificar etapa pendente: {overdue[0].step_name}",
                reason="Etapa de navegação com prazo definido ainda pendente",
                priority="MEDIUM",
            )
        )

    return NurseAssistResponse(
        summary=summary,
        suggested_replies=replies,
        suggested_actions=actions,
        used_llm=False,
    )


@router.post("/agent/nurse-assist", response_model=NurseAssistResponse)
async def nurse_assist(request: NurseAssistRequest):
    """
    AI assistant for nurses: generates conversation summary,
    suggested replies, and recommended clinical actions.
    """
    import json
    import logging
    from ..agent.llm_provider import llm_provider

    logger = logging.getLogger(__name__)

    if not llm_provider.has_any_llm_key(None):
        return _build_nurse_assist_fallback(request)

    try:
        history_text = ""
        for msg in request.conversation_history[-15:]:
            role_label = {
                "patient": "Paciente",
                "agent": "Agente",
                "nursing": "Enfermeiro(a)",
            }.get(msg.role, msg.role)
            history_text += f"[{role_label}]: {msg.content}\n"

        clinical_lines = [
            f"Nome: {request.patient_name}",
            f"Câncer: {request.cancer_type or 'N/I'}, Estádio: {request.stage or 'N/I'}",
            f"ECOG: {request.performance_status if request.performance_status is not None else 'N/I'}",
            f"Prioridade: {request.priority_score} ({request.priority_category})",
            f"Fase atual: {request.current_stage or 'N/I'}",
        ]
        if request.recent_symptoms:
            clinical_lines.append(
                f"Sintomas recentes: {', '.join(request.recent_symptoms[:8])}"
            )
        if request.esas_scores:
            esas_parts = [
                f"{k}: {v}" for k, v in request.esas_scores.items() if v is not None
            ]
            if esas_parts:
                clinical_lines.append(f"ESAS: {', '.join(esas_parts)}")

        pending_steps = [
            s
            for s in request.navigation_steps
            if s.status in ("PENDING", "IN_PROGRESS")
        ]
        if pending_steps:
            step_names = [f"{s.step_name} ({s.status})" for s in pending_steps[:5]]
            clinical_lines.append(f"Etapas pendentes: {', '.join(step_names)}")
        if request.alerts:
            clinical_lines.append(f"Alertas: {'; '.join(request.alerts[:5])}")

        clinical_context = "\n".join(clinical_lines)

        system_prompt = (
            "Você é um assistente de IA para enfermeiros navegadores oncológicos no sistema OncoNav.\n"
            "Sua função é ajudar o enfermeiro a responder mais rápido e com mais qualidade.\n\n"
            "Com base no histórico da conversa e contexto clínico, você DEVE chamar a tool "
            "'nurse_assist_output' com:\n"
            "1. summary: Resumo clínico breve (2-4 frases) destacando pontos críticos\n"
            "2. suggested_replies: EXATAMENTE 3 sugestões de resposta:\n"
            "   - 'Empática': Foco em acolhimento e suporte emocional\n"
            "   - 'Informativa': Foco em orientações e informações clínicas\n"
            "   - 'Ação': Foco em próximos passos concretos\n"
            "3. suggested_actions: 0-3 ações clínicas recomendadas com prioridade\n\n"
            "REGRAS:\n"
            "- Respostas em português brasileiro, linguagem profissional mas acessível\n"
            "- Sugestões de resposta devem usar o primeiro nome do paciente\n"
            "- NÃO prescreva medicamentos\n"
            "- NÃO faça diagnósticos definitivos\n"
            "- Priorize segurança do paciente\n\n"
            f"CONTEXTO CLÍNICO:\n{clinical_context}"
        )

        user_message = f"Analise esta conversa e gere assistência para o enfermeiro:\n\n{history_text}"

        result = await llm_provider.generate_with_tools(
            system_prompt=system_prompt,
            user_message=user_message,
            tools=NURSE_ASSIST_TOOLS,
        )

        if result.get("tool_calls"):
            for tc in result["tool_calls"]:
                if tc.get("function", {}).get("name") == "nurse_assist_output":
                    args_str = tc["function"].get("arguments", "{}")
                    try:
                        args = (
                            json.loads(args_str)
                            if isinstance(args_str, str)
                            else args_str
                        )
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse nurse_assist_output arguments")
                        break

                    replies = [
                        SuggestedReply(label=r.get("label", ""), text=r.get("text", ""))
                        for r in args.get("suggested_replies", [])
                    ]
                    actions = [
                        SuggestedAction(
                            action=a.get("action", ""),
                            reason=a.get("reason", ""),
                            priority=a.get("priority", "MEDIUM"),
                        )
                        for a in args.get("suggested_actions", [])
                    ]

                    return NurseAssistResponse(
                        summary=args.get("summary", ""),
                        suggested_replies=replies[:3],
                        suggested_actions=actions[:3],
                        used_llm=True,
                    )

        if result.get("content"):
            return NurseAssistResponse(
                summary=result["content"][:500],
                suggested_replies=[],
                suggested_actions=[],
                used_llm=True,
            )

        return _build_nurse_assist_fallback(request)

    except Exception as e:
        logger.error(f"Nurse assist LLM error: {e}")
        return _build_nurse_assist_fallback(request)


# ============================================
# Patient Summary (P8)
# ============================================

PATIENT_SUMMARY_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_patient_summary",
            "description": "Gera um resumo inteligente e estruturado do paciente oncológico.",
            "parameters": {
                "type": "object",
                "properties": {
                    "narrative": {
                        "type": "string",
                        "description": "Resumo narrativo de 3-5 linhas descrevendo a situação clínica atual do paciente.",
                    },
                    "highlights": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "icon": {
                                    "type": "string",
                                    "enum": ["info", "warning", "success", "clock"],
                                    "description": "Tipo do ícone para o destaque.",
                                },
                                "text": {
                                    "type": "string",
                                    "description": "Texto curto do destaque clínico.",
                                },
                            },
                            "required": ["icon", "text"],
                        },
                        "description": "Lista de destaques clínicos importantes (3-6 itens).",
                    },
                    "risks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "risk": {
                                    "type": "string",
                                    "description": "Descrição do risco identificado.",
                                },
                                "severity": {
                                    "type": "string",
                                    "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                                    "description": "Gravidade do risco.",
                                },
                            },
                            "required": ["risk", "severity"],
                        },
                        "description": "Riscos identificados baseados no contexto clínico.",
                    },
                    "next_steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "step": {
                                    "type": "string",
                                    "description": "Descrição do próximo passo recomendado.",
                                },
                                "urgency": {
                                    "type": "string",
                                    "enum": ["LOW", "NORMAL", "HIGH", "URGENT"],
                                    "description": "Urgência do passo.",
                                },
                            },
                            "required": ["step", "urgency"],
                        },
                        "description": "Próximos passos recomendados para o cuidado do paciente.",
                    },
                },
                "required": ["narrative", "highlights", "risks", "next_steps"],
            },
        },
    }
]


def _build_patient_summary_fallback(
    request: PatientSummaryRequest,
) -> PatientSummaryResponse:
    """Rule-based fallback when LLM is unavailable."""
    highlights = []
    risks = []
    next_steps = []

    if request.cancer_type:
        highlights.append(
            SummaryHighlight(icon="info", text=f"Diagnóstico: {request.cancer_type}")
        )
    if request.stage:
        highlights.append(
            SummaryHighlight(icon="info", text=f"Estadiamento: {request.stage}")
        )
    if request.priority_category in ("HIGH", "CRITICAL"):
        highlights.append(
            SummaryHighlight(
                icon="warning", text=f"Prioridade {request.priority_category}"
            )
        )
    if request.performance_status is not None:
        highlights.append(
            SummaryHighlight(icon="info", text=f"ECOG: {request.performance_status}")
        )

    overdue = [
        s
        for s in request.navigation_steps
        if s.status in ("PENDING", "IN_PROGRESS")
        and s.due_date
        and _is_overdue(s.due_date)
    ]
    completed = [s for s in request.navigation_steps if s.status == "COMPLETED"]

    if overdue:
        risks.append(
            SummaryRisk(
                risk=f"{len(overdue)} etapa(s) de navegação atrasada(s)",
                severity="HIGH",
            )
        )
    if request.recent_symptoms:
        risks.append(
            SummaryRisk(
                risk=f"Sintomas recentes: {', '.join(request.recent_symptoms[:3])}",
                severity="MEDIUM",
            )
        )

    if completed:
        highlights.append(
            SummaryHighlight(
                icon="success", text=f"{len(completed)} etapa(s) concluída(s)"
            )
        )

    pending = [
        s for s in request.navigation_steps if s.status in ("PENDING", "IN_PROGRESS")
    ]
    if pending:
        next_steps.append(
            SummaryNextStep(
                step=f"Concluir etapa: {pending[0].step_name}",
                urgency="HIGH" if overdue else "NORMAL",
            )
        )

    narrative = f"Paciente {request.patient_name}"
    if request.cancer_type:
        narrative += f", com {request.cancer_type}"
    if request.stage:
        narrative += f" estágio {request.stage}"
    narrative += f". Prioridade: {request.priority_category}."
    if completed:
        narrative += (
            f" {len(completed)} de {len(request.navigation_steps)} etapas concluídas."
        )
    if overdue:
        narrative += f" {len(overdue)} etapa(s) atrasada(s) requerem atenção."

    return PatientSummaryResponse(
        narrative=narrative,
        highlights=highlights,
        risks=risks,
        next_steps=next_steps,
        used_llm=False,
    )


@router.post("/agent/patient-summary", response_model=PatientSummaryResponse)
async def patient_summary(request: PatientSummaryRequest):
    """
    Generates an intelligent patient summary using LLM tool calling.
    Falls back to rule-based generation if LLM is unavailable.
    """
    import json
    from ..agent.llm_provider import llm_provider

    steps_desc = []
    for s in request.navigation_steps:
        status_str = s.status
        if s.due_date and _is_overdue(s.due_date):
            status_str += " (ATRASADO)"
        steps_desc.append(f"  - {s.step_name}: {status_str}")

    alerts_desc = (
        "\n".join(f"  - {a}" for a in request.alerts)
        if request.alerts
        else "  Nenhum alerta ativo."
    )
    symptoms_desc = (
        ", ".join(request.recent_symptoms)
        if request.recent_symptoms
        else "Nenhum sintoma recente reportado."
    )
    treatments_desc = (
        ", ".join(request.treatments)
        if request.treatments
        else "Nenhum tratamento registrado."
    )
    comorbidities_desc = (
        ", ".join(request.comorbidities)
        if request.comorbidities
        else "Nenhuma comorbidade registrada."
    )

    esas_desc = "Não disponível."
    if request.esas_scores:
        parts = [f"{k}: {v}" for k, v in request.esas_scores.items() if v is not None]
        if parts:
            esas_desc = ", ".join(parts)

    prompt = f"""Você é um assistente de navegação oncológica. Analise o contexto clínico abaixo e gere um resumo inteligente para a equipe de saúde.

PACIENTE:
- Nome: {request.patient_name}
- Diagnóstico: {request.cancer_type or 'Não informado'}
- Estadiamento: {request.stage or 'Não informado'}
- Performance Status (ECOG): {request.performance_status if request.performance_status is not None else 'Não informado'}
- Prioridade: {request.priority_category} (score: {request.priority_score})
- Fase da jornada: {request.current_stage or 'Não informada'}
- Gênero: {request.gender or 'N/I'}
- Data de nascimento: {request.date_of_birth or 'N/I'}
- Comorbidades: {comorbidities_desc}
- Tratamentos: {treatments_desc}

ETAPAS DE NAVEGAÇÃO:
{chr(10).join(steps_desc) if steps_desc else '  Nenhuma etapa registrada.'}

SINTOMAS RECENTES: {symptoms_desc}

SCORES ESAS: {esas_desc}

ALERTAS ATIVOS:
{alerts_desc}

INTERAÇÕES: {request.recent_conversations_count} conversas. Última interação: {request.last_interaction_date or 'N/I'}.

Use a ferramenta generate_patient_summary para produzir:
1. narrative: Resumo narrativo (3-5 linhas) com linguagem clínica acessível
2. highlights: 3-6 destaques clínicos importantes com ícone (info/warning/success/clock)
3. risks: Riscos identificados com severidade
4. next_steps: Próximos passos recomendados com urgência"""

    try:
        result = await llm_provider.generate_with_tools(
            messages=[{"role": "user", "content": prompt}],
            tools=PATIENT_SUMMARY_TOOLS,
            system_prompt="Você é um especialista em navegação oncológica. Gere resumos clínicos estruturados e precisos.",
        )

        tool_calls = result.get("tool_calls", [])
        for tc in tool_calls:
            fn_name = tc.get("function", {}).get("name", "")
            if fn_name == "generate_patient_summary":
                args_raw = tc["function"].get("arguments", "{}")
                args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw

                return PatientSummaryResponse(
                    narrative=args.get("narrative", ""),
                    highlights=[
                        SummaryHighlight(**h) for h in args.get("highlights", [])
                    ],
                    risks=[SummaryRisk(**r) for r in args.get("risks", [])],
                    next_steps=[
                        SummaryNextStep(**s) for s in args.get("next_steps", [])
                    ],
                    used_llm=True,
                )

        content = result.get("content", "")
        if content:
            return PatientSummaryResponse(
                narrative=content[:500],
                highlights=[],
                risks=[],
                next_steps=[],
                used_llm=True,
            )

        return _build_patient_summary_fallback(request)

    except Exception as e:
        logger.error(f"Patient summary LLM error: {e}")
        return _build_patient_summary_fallback(request)


# ============================================
# Health check
# ============================================


@router.get("/health")
async def health():
    """Health check"""
    return {
        "status": "ok",
        "service": "ai-service",
        "version": "0.3.0",
        "model_trained": priority_model.is_trained,
        "capabilities": [
            "prioritization",
            "agent_orchestrator",
            "symptom_analysis",
            "context_building",
            "questionnaire_engine",
            "protocol_engine",
        ],
    }


# ============================================
# Observability
# ============================================


@router.get("/observability/traces")
async def get_traces(limit: int = 50):
    """Return the most recent agent execution traces (last N, newest first)."""
    limit = max(1, min(limit, 500))
    return {"traces": tracer.get_traces(limit=limit)}


@router.get("/observability/stats")
async def get_stats():
    """Return aggregate statistics over all stored traces."""
    return tracer.get_stats()


@router.delete("/observability/traces")
async def clear_traces():
    """Clear all stored traces (useful for resetting during testing)."""
    tracer._traces.clear()
    return {"cleared": True}
