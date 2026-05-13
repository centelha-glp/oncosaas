from typing import Any, Dict, List

from .system_prompt import LAYER1_PRECALCULATED_ORCHESTRATOR_NOTE

"""
Orchestrator prompts and routing tool definitions for the multi-agent pipeline.

The orchestrator uses Claude Opus with adaptive thinking to route patient messages
to specialized subagents, then synthesizes their analyses into a final patient response.
"""

APPOINTMENT_QUERY_ORCHESTRATOR_NOTE = """## CONSULTA DE AGENDA (RAMO APPOINTMENT_QUERY)

Neste turno a intenção é **consulta sobre datas/horários** de consultas, exames ou retornos.
- **Não há bloco de triagem Layer 1** no contexto — **não simule** avaliação R01–R23 nem disposição clínica.
- **Invoque `consultar_agente_navegacao`** para usar as etapas do plano; o subagente deve chamar a ferramenta
  **`informar_agenda_navegacao`** ao concluir a orientação sobre agenda/prazos (auditoria).
- Distinga **prazo meta** da etapa de **agendamento confirmado** (ver diretrizes do subagente de navegação).
- Se a mensagem parecer misturar urgência clínica grave com pergunta de agenda, oriente buscar ajuda presencial/SAMU quando aplicável, sem inventar resultado de triagem."""

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
            "quiser saber o que vem depois no plano, **perguntar sobre datas/horários de consultas, "
            "exames ou retornos**, ou quando for necessário agendar acompanhamento ou recomendar consulta. "
            "Em dúvidas de **agenda ou prazos**, invoque este agente e peça que use `informar_agenda_navegacao` "
            "para registrar a resposta na auditoria."
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
    {
        "name": "consultar_agente_secretaria",
        "description": (
            "Invoca a secretária eletrônica para CONSULTAR VAGAS REAIS na agenda, "
            "AGENDAR, REAGENDAR, CANCELAR ou CONFIRMAR uma consulta. "
            "Use quando o paciente pedir: "
            "(1) disponibilidade real ('quais horários têm?', 'tem vaga semana que vem?'); "
            "(2) marcar nova consulta ('quero marcar com Dr. João'); "
            "(3) reagendar para uma faixa/dia ('preciso remarcar para a próxima semana'); "
            "(4) cancelar consulta; (5) confirmar presença. "
            "NÃO use para perguntas informativas sobre prazos meta de etapas do plano "
            "('qual o prazo da minha biópsia?', 'quando é o retorno previsto?') — "
            "essas vão para `consultar_agente_navegacao`. A secretária consulta vagas em "
            "tempo real via tool read-only `consultar_vagas_consulta` antes de oferecer "
            "horários ao paciente."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "acao": {
                    "type": "string",
                    "enum": ["criar", "reagendar", "cancelar", "confirmar", "auto"],
                    "description": (
                        "Ação solicitada pelo paciente. 'auto' permite a secretária decidir."
                    ),
                },
                "foco": {
                    "type": "string",
                    "description": (
                        "Pistas relevantes para a secretária (ex.: profissional citado, "
                        "data sugerida, indicação de paciente novo)."
                    ),
                },
            },
            "required": [],
        },
    },
]


def build_orchestrator_prompt(
    clinical_context: str,
    *,
    appointment_query: bool = False,
) -> str:
    """
    Build the orchestrator system prompt with full clinical context.

    The orchestrator uses this prompt to route patient messages to the
    appropriate specialized subagents and synthesize their responses.

    Args:
        clinical_context: Formatted clinical context string (from context_builder + RAG)
        appointment_query: Se True, omite a nota de Layer 1 pré-calculada e insere instruções do ramo agenda.
        Complete orchestrator system prompt
    """
    layer_note = (
        APPOINTMENT_QUERY_ORCHESTRATOR_NOTE
        if appointment_query
        else LAYER1_PRECALCULATED_ORCHESTRATOR_NOTE
    )
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
- **Agente de Navegação** (`consultar_agente_navegacao`): etapas do tratamento, check-ins, encaminhamentos, **consulta informativa** de datas/prazos (tool `informar_agenda_navegacao` no subagente)
- **Agente de Questionários** (`consultar_agente_questionario`): ESAS e PRO-CTCAE
- **Agente de Suporte Emocional** (`consultar_agente_suporte_emocional`): apoio psicológico
- **Secretária Eletrônica** (`consultar_agente_secretaria`): **consulta de vagas em tempo real** (tool read-only `consultar_vagas_consulta`) + **mutações de agenda** — marcar, reagendar, cancelar e confirmar consulta; cuida de coleta de dados para paciente novo

## DIRETRIZES DE ROTEAMENTO
- Sintoma físico de qualquer natureza → **SEMPRE** invocar agente de sintomas
- **Consultar prazo meta / próximas etapas / "qual o prazo da minha biópsia?" / "quando é o retorno previsto?"** (sem pedir vaga real) → agente de **navegação** (e `informar_agenda_navegacao` quando for só agenda/prazos)
- **Consultar vagas reais** ("quais horários têm?", "tem vaga semana que vem?", "qual o próximo dia disponível?"), **marcar / agendar / criar nova consulta**, **reagendar**, **cancelar**, **confirmar presença** → **secretária eletrônica** (`consultar_agente_secretaria`)
- Sofrimento emocional explícito → agente de suporte emocional
- Múltiplos sintomas vagos ou avaliação periódica → agente de questionários
- Mensagens podem precisar de **múltiplos subagentes** — invoque todos os necessários (ex.: sintoma + pedido de remarcar → sintomas têm prioridade; a secretária só age depois que o tópico clínico estiver resolvido)
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

{layer_note}

---

## CONTEXTO CLÍNICO DO PACIENTE

{clinical_context}"""
