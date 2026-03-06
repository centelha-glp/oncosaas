"""
Orchestrator prompts and routing tool definitions for the multi-agent pipeline.

The orchestrator uses Claude Opus with adaptive thinking to route patient messages
to specialized subagents, then synthesizes their analyses into a final patient response.
"""

from typing import Any, Dict, List


# Routing tools: each tool represents a specialized subagent
ORCHESTRATOR_ROUTING_TOOLS: List[Dict[str, Any]] = [
    {
        "name": "consultar_agente_sintomas",
        "description": (
            "Invoca o agente especialista em análise de sintomas oncológicos. "
            "Use SEMPRE que o paciente relatar qualquer sintoma físico: "
            "dor, febre, náusea, vômito, fadiga, falta de ar, sangramento, "
            "tontura, insônia, diarreia, constipação, inchaço, formigamento, "
            "mucosite, queda de cabelo, efeitos colaterais ou qualquer mudança "
            "no estado de saúde físico."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "foco": {
                    "type": "string",
                    "description": (
                        "Sintomas específicos ou aspectos clínicos identificados "
                        "na mensagem que requerem análise especializada."
                    ),
                },
            },
            "required": [],
        },
    },
    {
        "name": "consultar_agente_navegacao",
        "description": (
            "Invoca o agente de navegação oncológica. "
            "Use quando o paciente: perguntar sobre próximas etapas do tratamento, "
            "mencionar que realizou algum exame ou consulta, "
            "querer saber o que vem depois no seu plano de tratamento, "
            "ou quando for necessário agendar acompanhamento ou recomendar consulta especializada."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "foco": {
                    "type": "string",
                    "description": "Etapa ou aspecto específico da navegação oncológica.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "consultar_agente_questionario",
        "description": (
            "Invoca o agente de questionários clínicos padronizados (ESAS e PRO-CTCAE). "
            "Use quando: o paciente relatar múltiplos sintomas vagos ou difusos, "
            "for necessária uma avaliação sistemática de qualidade de vida, "
            "o paciente estiver em tratamento ativo e relatar efeitos colaterais variados, "
            "ou quando for momento de avaliação periódica programada."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "tipo_sugerido": {
                    "type": "string",
                    "enum": ["ESAS", "PRO_CTCAE", "auto"],
                    "description": (
                        "ESAS: qualidade de vida geral. "
                        "PRO_CTCAE: toxicidades de tratamento. "
                        "auto: o agente decide o mais adequado."
                    ),
                },
            },
            "required": [],
        },
    },
    {
        "name": "consultar_agente_suporte_emocional",
        "description": (
            "Invoca o agente de suporte emocional e psicológico. "
            "Use quando o paciente expressar: ansiedade, medo, tristeza, choro, "
            "desânimo, desesperança, sensação de estar sozinho, frustração, "
            "raiva, dificuldades emocionais, ou qualquer sofrimento psicológico "
            "relacionado ao diagnóstico ou tratamento oncológico."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "emocao": {
                    "type": "string",
                    "description": "Estado emocional ou sentimento identificado na mensagem.",
                },
            },
            "required": [],
        },
    },
]


def build_orchestrator_prompt(clinical_context: str) -> str:
    """
    Build the orchestrator system prompt with full clinical context.

    The orchestrator uses this prompt to route patient messages to the
    appropriate specialized subagents and synthesize their responses.

    Args:
        clinical_context: Formatted clinical context string (from context_builder + RAG)

    Returns:
        Complete orchestrator system prompt
    """
    return f"""# Orquestrador Principal - ONCONAV

Você é o orquestrador inteligente do sistema de navegação oncológica ONCONAV.
Você conversa com pacientes oncológicos via WhatsApp e coordena subagentes especializados
para oferecer o melhor atendimento clínico e humano possível.

## SUA FUNÇÃO
1. Analisar a mensagem do paciente e o contexto clínico
2. Invocar os subagentes especialistas adequados (usando as ferramentas disponíveis)
3. Integrar as análises dos subagentes
4. Formular a resposta final ao paciente em português brasileiro

## SUBAGENTES DISPONÍVEIS
- **Agente de Sintomas** (`consultar_agente_sintomas`): análise de sintomas, alertas, escalação
- **Agente de Navegação** (`consultar_agente_navegacao`): etapas do tratamento, check-ins, encaminhamentos
- **Agente de Questionários** (`consultar_agente_questionario`): ESAS e PRO-CTCAE
- **Agente de Suporte Emocional** (`consultar_agente_suporte_emocional`): apoio psicológico

## DIRETRIZES DE ROTEAMENTO
- Sintoma físico de qualquer natureza → **SEMPRE** invocar agente de sintomas
- Pergunta sobre etapas, exames ou procedimentos → agente de navegação
- Sofrimento emocional explícito → agente de suporte emocional
- Múltiplos sintomas vagos ou avaliação periódica → agente de questionários
- Mensagens podem precisar de **múltiplos subagentes** — invoque todos os necessários
- Mensagens simples (sem domínio clínico específico) → responda diretamente sem subagentes

## RESPOSTA FINAL AO PACIENTE
Após consultar os subagentes necessários, formule a resposta seguindo estes princípios:
- Linguagem simples, acessível e empática
- Uma pergunta por vez ao paciente
- Valide as preocupações antes de fazer perguntas
- Nunca faça diagnósticos ou prescrições médicas
- Integre as perspectivas de todos os subagentes em uma mensagem coerente
- **Sintomas têm prioridade**: aborde sintomas antes de falar de agendamentos
- Se houve escalação, informe o paciente de forma tranquilizadora

## COERÊNCIA DE TÓPICO
- Conclua o tópico atual antes de iniciar outro
- Se o paciente confirma algo (sim, ok, é isso), continue exatamente o mesmo tópico
- Febre ≥38°C em quimioterapia = orientação de urgência + escalação, sem mudar de assunto

---

## CONTEXTO CLÍNICO DO PACIENTE

{clinical_context}"""
