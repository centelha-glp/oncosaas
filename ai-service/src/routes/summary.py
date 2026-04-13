import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..auth import require_service_token
from ..models.schemas import (
    PatientSummaryRequest,
    PatientSummaryResponse,
    SummaryHighlight,
    SummaryNextStep,
    SummaryRisk,
)

logger = logging.getLogger(__name__)
router = APIRouter()

PATIENT_SUMMARY_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_patient_summary",
            "description": "Gera um resumo inteligente e estruturado do paciente oncologico.",
            "parameters": {
                "type": "object",
                "properties": {
                    "narrative": {
                        "type": "string",
                        "description": "Resumo narrativo de 3-5 linhas descrevendo a situacao clinica atual do paciente.",
                    },
                    "highlights": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "icon": {
                                    "type": "string",
                                    "enum": ["info", "warning", "success", "clock"],
                                    "description": "Tipo do icone para o destaque.",
                                },
                                "text": {
                                    "type": "string",
                                    "description": "Texto curto do destaque clinico.",
                                },
                            },
                            "required": ["icon", "text"],
                        },
                        "description": "Lista de destaques clinicos importantes (3-6 itens).",
                    },
                    "risks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "risk": {
                                    "type": "string",
                                    "description": "Descricao do risco identificado.",
                                },
                                "severity": {
                                    "type": "string",
                                    "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                                    "description": "Gravidade do risco.",
                                },
                            },
                            "required": ["risk", "severity"],
                        },
                        "description": "Riscos identificados baseados no contexto clinico.",
                    },
                    "next_steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "step": {
                                    "type": "string",
                                    "description": "Descricao do proximo passo recomendado.",
                                },
                                "urgency": {
                                    "type": "string",
                                    "enum": ["LOW", "NORMAL", "HIGH", "URGENT"],
                                    "description": "Urgencia do passo.",
                                },
                            },
                            "required": ["step", "urgency"],
                        },
                        "description": "Proximos passos recomendados para o cuidado do paciente.",
                    },
                },
                "required": ["narrative", "highlights", "risks", "next_steps"],
            },
        },
    }
]


def _is_overdue(due_date_str: str) -> bool:
    try:
        due = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
        return due < datetime.now(timezone.utc)
    except (ValueError, TypeError):
        return False


def _build_patient_summary_fallback(request: PatientSummaryRequest) -> PatientSummaryResponse:
    highlights = []
    risks = []
    next_steps = []

    if request.cancer_type:
        highlights.append(SummaryHighlight(icon="info", text=f"Diagnostico: {request.cancer_type}"))
    if request.stage:
        highlights.append(SummaryHighlight(icon="info", text=f"Estadiamento: {request.stage}"))
    if request.priority_category in ("HIGH", "CRITICAL"):
        highlights.append(SummaryHighlight(icon="warning", text=f"Prioridade {request.priority_category}"))
    if request.performance_status is not None:
        highlights.append(SummaryHighlight(icon="info", text=f"ECOG: {request.performance_status}"))

    overdue = [
        s
        for s in request.navigation_steps
        if s.status in ("PENDING", "IN_PROGRESS") and s.due_date and _is_overdue(s.due_date)
    ]
    completed = [s for s in request.navigation_steps if s.status == "COMPLETED"]

    if overdue:
        risks.append(SummaryRisk(risk=f"{len(overdue)} etapa(s) de navegacao atrasada(s)", severity="HIGH"))
    if request.recent_symptoms:
        risks.append(
            SummaryRisk(
                risk=f"Sintomas recentes: {', '.join(request.recent_symptoms[:3])}",
                severity="MEDIUM",
            )
        )

    if completed:
        highlights.append(SummaryHighlight(icon="success", text=f"{len(completed)} etapa(s) concluida(s)"))

    pending = [s for s in request.navigation_steps if s.status in ("PENDING", "IN_PROGRESS")]
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
        narrative += f" estagio {request.stage}"
    narrative += f". Prioridade: {request.priority_category}."
    if completed:
        narrative += f" {len(completed)} de {len(request.navigation_steps)} etapas concluidas."
    if overdue:
        narrative += f" {len(overdue)} etapa(s) atrasada(s) requerem atencao."

    return PatientSummaryResponse(
        narrative=narrative,
        highlights=highlights,
        risks=risks,
        next_steps=next_steps,
        used_llm=False,
    )


@router.post("/agent/patient-summary", response_model=PatientSummaryResponse)
async def patient_summary(
    request: PatientSummaryRequest,
    _: None = Depends(require_service_token),
):
    from ..agent.llm_provider import llm_provider

    steps_desc = []
    for s in request.navigation_steps:
        status_str = s.status
        if s.due_date and _is_overdue(s.due_date):
            status_str += " (ATRASADO)"
        steps_desc.append(f"  - {s.step_name}: {status_str}")

    alerts_desc = "\n".join(f"  - {a}" for a in request.alerts) if request.alerts else "  Nenhum alerta ativo."
    symptoms_desc = ", ".join(request.recent_symptoms) if request.recent_symptoms else "Nenhum sintoma recente reportado."
    treatments_desc = ", ".join(request.treatments) if request.treatments else "Nenhum tratamento registrado."
    comorbidities_desc = ", ".join(request.comorbidities) if request.comorbidities else "Nenhuma comorbidade registrada."

    esas_desc = "Nao disponivel."
    if request.esas_scores:
        parts = [f"{k}: {v}" for k, v in request.esas_scores.items() if v is not None]
        if parts:
            esas_desc = ", ".join(parts)

    prompt = f"""Voce e um assistente de navegacao oncologica. Analise o contexto clinico abaixo e gere um resumo inteligente para a equipe de saude.

PACIENTE:
- Nome: {request.patient_name}
- Diagnostico: {request.cancer_type or 'Nao informado'}
- Estadiamento: {request.stage or 'Nao informado'}
- Performance Status (ECOG): {request.performance_status if request.performance_status is not None else 'Nao informado'}
- Prioridade: {request.priority_category} (score: {request.priority_score})
- Fase da jornada: {request.current_stage or 'Nao informada'}
- Genero: {request.gender or 'N/I'}
- Data de nascimento: {request.date_of_birth or 'N/I'}
- Comorbidades: {comorbidities_desc}
- Tratamentos: {treatments_desc}

ETAPAS DE NAVEGACAO:
{chr(10).join(steps_desc) if steps_desc else '  Nenhuma etapa registrada.'}

SINTOMAS RECENTES: {symptoms_desc}

SCORES ESAS: {esas_desc}

ALERTAS ATIVOS:
{alerts_desc}

INTERACOES: {request.recent_conversations_count} conversas. Ultima interacao: {request.last_interaction_date or 'N/I'}.

Use a ferramenta generate_patient_summary para produzir:
1. narrative: Resumo narrativo (3-5 linhas) com linguagem clinica acessivel
2. highlights: 3-6 destaques clinicos importantes com icone (info/warning/success/clock)
3. risks: Riscos identificados com severidade
4. next_steps: Proximos passos recomendados com urgencia"""

    try:
        llm_cfg = {
            "llm_provider": "anthropic" if llm_provider.has_anthropic_key({}) else "openai",
            "llm_model": "claude-sonnet-4-6" if llm_provider.has_anthropic_key({}) else "gpt-4o-mini",
        }
        result = await llm_provider.generate_with_tools(
            messages=[{"role": "user", "content": prompt}],
            tools=PATIENT_SUMMARY_TOOLS,
            system_prompt="Voce e um especialista em navegacao oncologica. Gere resumos clinicos estruturados e precisos.",
            config=llm_cfg,
        )

        tool_calls = result.get("tool_calls", [])
        for tc in tool_calls:
            fn_name = tc.get("function", {}).get("name", "")
            if fn_name == "generate_patient_summary":
                args_raw = tc["function"].get("arguments", "{}")
                args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw

                return PatientSummaryResponse(
                    narrative=args.get("narrative", ""),
                    highlights=[SummaryHighlight(**h) for h in args.get("highlights", [])],
                    risks=[SummaryRisk(**r) for r in args.get("risks", [])],
                    next_steps=[SummaryNextStep(**s) for s in args.get("next_steps", [])],
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
        logger.error("Patient summary LLM error: %s", e)
        return _build_patient_summary_fallback(request)
