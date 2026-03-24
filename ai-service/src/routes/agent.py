import logging
import os
from typing import Dict, List

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from ..agent.context_builder import context_builder
from ..agent.orchestrator import orchestrator
from ..agent.protocol_engine import protocol_engine
from ..agent.questionnaire_engine import questionnaire_engine
from ..agent.symptom_analyzer import symptom_analyzer
from ..agent.whatsapp_agent import whatsapp_agent
from ..models.schemas import (
    AgentProcessRequest,
    AgentProcessResponse,
    BuildContextRequest,
    CheckInMessageRequest,
    CheckInMessageResponse,
    ClinicalContextResponse,
    DetectedSymptom,
    ProtocolEvaluateRequest,
    ProtocolEvaluateResponse,
    QuestionnaireScoreRequest,
    QuestionnaireScoreResponse,
    SymptomAnalysisRequest,
    SymptomAnalysisResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


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


@router.get("/debug/llm-status")
async def debug_llm_status():
    from ..agent.llm_provider import llm_provider

    if os.getenv("ENABLE_DEBUG_ENDPOINTS", "").strip().lower() not in ("1", "true", "yes"):
        raise HTTPException(status_code=404, detail="Not found")

    has_any = llm_provider.has_any_llm_key({})
    has_anthropic = llm_provider.has_anthropic_key({})

    return {
        "has_any_llm_key": has_any,
        "has_anthropic_key": has_anthropic,
    }


@router.post("/agent/message", response_model=AgentMessageResponse)
async def process_agent_message(request: AgentMessageRequest):
    try:
        result = await run_in_threadpool(
            whatsapp_agent.process_message,
            request.message,
            request.patient_context,
            request.conversation_history,
        )
        return AgentMessageResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar mensagem: {str(e)}")


@router.post("/agent/process", response_model=AgentProcessResponse)
async def process_message(request: AgentProcessRequest):
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
        raise HTTPException(status_code=500, detail=f"Erro ao processar mensagem pelo agente: {str(e)}")


@router.post("/agent/build-context", response_model=ClinicalContextResponse)
async def build_clinical_context(request: BuildContextRequest):
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

        return ClinicalContextResponse(context=context_str, patient_summary=patient_summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao montar contexto clínico: {str(e)}")


@router.post("/agent/analyze-symptoms", response_model=SymptomAnalysisResponse)
async def analyze_symptoms(request: SymptomAnalysisRequest):
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
        raise HTTPException(status_code=500, detail=f"Erro ao analisar sintomas: {str(e)}")


@router.post("/agent/score-questionnaire", response_model=QuestionnaireScoreResponse)
async def score_questionnaire(request: QuestionnaireScoreRequest):
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
        raise HTTPException(status_code=500, detail=f"Erro ao calcular score do questionário: {str(e)}")


@router.post("/agent/evaluate-protocol", response_model=ProtocolEvaluateResponse)
async def evaluate_protocol(request: ProtocolEvaluateRequest):
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
        raise HTTPException(status_code=500, detail=f"Erro ao avaliar protocolo: {str(e)}")


@router.post("/agent/checkin-message", response_model=CheckInMessageResponse)
async def generate_checkin_message(request: CheckInMessageRequest):
    from ..agent.llm_provider import llm_provider

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

    clinical_summary = context_builder.build(clinical_context=request.clinical_context)

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
        api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENAI_API_KEY")

    if api_key:
        try:
            llm_cfg = dict(config) if config else {}
            if "llm_provider" not in llm_cfg:
                llm_cfg["llm_provider"] = "anthropic" if llm_provider.has_anthropic_key(llm_cfg) else "openai"
            if "llm_model" not in llm_cfg:
                llm_cfg["llm_model"] = "claude-sonnet-4-6" if llm_cfg["llm_provider"] == "anthropic" else "gpt-4o-mini"

            result = await llm_provider.generate(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": user_message}],
                config=llm_cfg,
            )
            generated = (result or "").strip()
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
