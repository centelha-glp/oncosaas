import logging

from fastapi import APIRouter, Depends

from ..auth import require_service_token
from ..models.schemas import NurseAssistRequest, NurseAssistResponse, SuggestedAction, SuggestedReply

logger = logging.getLogger(__name__)
router = APIRouter()

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

    pending_steps = [s for s in request.navigation_steps if s.status in ("PENDING", "IN_PROGRESS")]
    if pending_steps:
        parts.append(f"Etapas pendentes: {len(pending_steps)}")

    if request.alerts:
        parts.append(f"Alertas ativos: {len(request.alerts)}")

    summary = ". ".join(parts) + "."

    first_name = request.patient_name.split()[0] if request.patient_name else "Paciente"
    replies = [
        SuggestedReply(
            label="Empática",
            text=f"Olá {first_name}, obrigada por compartilhar. Estamos acompanhando você de perto. Como está se sentindo agora?",
        ),
        SuggestedReply(
            label="Informativa",
            text=f"Olá {first_name}, recebi suas informações. Vou verificar com a equipe e retorno em breve com orientações.",
        ),
        SuggestedReply(
            label="Ação",
            text=f"{first_name}, com base no que você relatou, vou agendar uma avaliação. Posso entrar em contato para confirmar horário?",
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

    overdue = [s for s in request.navigation_steps if s.status == "PENDING" and s.due_date]
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
async def nurse_assist(
    request: NurseAssistRequest,
    _: None = Depends(require_service_token),
):
    import json

    from ..agent.llm_provider import llm_provider

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
            clinical_lines.append(f"Sintomas recentes: {', '.join(request.recent_symptoms[:8])}")
        if request.esas_scores:
            esas_parts = [f"{k}: {v}" for k, v in request.esas_scores.items() if v is not None]
            if esas_parts:
                clinical_lines.append(f"ESAS: {', '.join(esas_parts)}")

        pending_steps = [s for s in request.navigation_steps if s.status in ("PENDING", "IN_PROGRESS")]
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
            "- NAO prescreva medicamentos\n"
            "- NAO faça diagnósticos definitivos\n"
            "- Priorize segurança do paciente\n\n"
            f"CONTEXTO CLÍNICO:\n{clinical_context}"
        )

        user_message = f"Analise esta conversa e gere assistência para o enfermeiro:\n\n{history_text}"

        llm_cfg = {
            "llm_provider": "anthropic" if llm_provider.has_anthropic_key({}) else "openai",
            "llm_model": "claude-sonnet-4-6" if llm_provider.has_anthropic_key({}) else "gpt-4o-mini",
        }
        result = await llm_provider.generate_with_tools(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_message}],
            tools=NURSE_ASSIST_TOOLS,
            config=llm_cfg,
        )

        if result.get("tool_calls"):
            for tc in result["tool_calls"]:
                if tc.get("function", {}).get("name") == "nurse_assist_output":
                    args_str = tc["function"].get("arguments", "{}")
                    try:
                        args = json.loads(args_str) if isinstance(args_str, str) else args_str
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
        logger.error("Nurse assist LLM error: %s", e)
        return _build_nurse_assist_fallback(request)
