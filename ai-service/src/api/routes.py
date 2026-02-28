"""
Rotas da API do AI Service
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from ..models.priority_model import priority_model
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
)
from ..agent.whatsapp_agent import whatsapp_agent
from ..agent.orchestrator import orchestrator
from ..agent.context_builder import context_builder
from ..agent.symptom_analyzer import symptom_analyzer
from ..agent.questionnaire_engine import questionnaire_engine
from ..agent.protocol_engine import protocol_engine

router = APIRouter()


# ============================================
# Models de requisição/resposta (legacy)
# ============================================

class PriorityRequest(BaseModel):
    cancer_type: str
    stage: str
    performance_status: int
    age: int
    pain_score: Optional[int] = 0
    nausea_score: Optional[int] = 0
    fatigue_score: Optional[int] = 0
    days_since_last_visit: int
    treatment_cycle: Optional[int] = 0


class PriorityResponse(BaseModel):
    priority_score: float
    priority_category: str
    reason: str


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

@router.post("/prioritize", response_model=PriorityResponse)
async def prioritize_patient(request: PriorityRequest):
    """
    Calcula score de prioridade para um paciente
    """
    try:
        import pandas as pd

        cancer_type_map = {
            'mama': 0,
            'pulmao': 1,
            'colorectal': 2,
            'prostata': 3,
            'kidney': 4,
            'bladder': 5,
            'testicular': 6,
        }
        stage_map = {'I': 0, 'II': 1, 'III': 2, 'IV': 3}

        features = pd.DataFrame([{
            'cancer_type_encoded': cancer_type_map.get(request.cancer_type.lower(), 0),
            'stage_encoded': stage_map.get(request.stage.upper(), 0),
            'performance_status': request.performance_status,
            'age': request.age,
            'pain_score': request.pain_score,
            'nausea_score': request.nausea_score,
            'fatigue_score': request.fatigue_score,
            'days_since_last_visit': request.days_since_last_visit,
            'treatment_cycle': request.treatment_cycle,
        }])

        if not priority_model.is_trained:
            score = 0
            if request.pain_score >= 8:
                score += 30
            if request.stage == 'IV':
                score += 20
            if request.performance_status >= 3:
                score += 25
            if request.days_since_last_visit > 60:
                score += 15
            score = min(100, score)
        else:
            predictions = priority_model.predict(features)
            score = float(predictions[0])

        category = priority_model.categorize_priority(score)

        reasons = []
        if request.pain_score >= 8:
            reasons.append("Dor intensa reportada")
        if request.stage == 'IV':
            reasons.append("Estadiamento avançado")
        if request.performance_status >= 3:
            reasons.append("Performance status comprometido")

        reason = "; ".join(reasons) if reasons else "Priorização baseada em múltiplos fatores"

        return PriorityResponse(
            priority_score=score,
            priority_category=category,
            reason=reason,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao calcular prioridade: {str(e)}")


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
        raise HTTPException(status_code=500, detail=f"Erro ao processar mensagem: {str(e)}")


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
        result = await orchestrator.process({
            "message": request.message,
            "patient_id": request.patient_id,
            "tenant_id": request.tenant_id,
            "clinical_context": request.clinical_context,
            "protocol": request.protocol,
            "conversation_history": request.conversation_history,
            "agent_state": request.agent_state,
            "agent_config": request.agent_config,
        })

        return AgentProcessResponse(
            response=result.get("response", ""),
            actions=result.get("actions", []),
            symptom_analysis=result.get("symptom_analysis"),
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


