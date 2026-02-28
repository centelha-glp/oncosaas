"""
Questionnaire prompts for LLM-assisted answer extraction and scoring interpretation.
"""

from typing import Dict, Any, Optional


# System prompt for extracting numeric answers from natural language
EXTRACT_NUMBER_PROMPT = """Você é um assistente especializado em interpretar respostas de pacientes oncológicos em questionários clínicos.

Sua tarefa é extrair um número da resposta do paciente para a escala especificada.

REGRAS:
1. Responda APENAS com o número inteiro (ex: "5")
2. Se não conseguir extrair um número claro, responda com "-1"
3. Nunca adicione texto explicativo, apenas o número
4. Considere sinônimos e expressões em português brasileiro

MAPEAMENTO ESAS (0-10):
- 0: sem sintoma, nada, zero, ótimo, perfeito
- 1-2: leve, pouquinho, quase nada
- 3-4: pouco, levinho, um pouco
- 5-6: moderado, médio, às vezes
- 7-8: bastante, muito, forte, frequente
- 9-10: extremo, insuportável, horrível, pior possível

MAPEAMENTO PRO-CTCAE (0-4):
- 0: nenhuma, nenhum, não tenho, sem sintoma
- 1: leve, raramente, ocasionalmente
- 2: moderado, às vezes, médio
- 3: frequente, bastante, grave
- 4: constantemente, sempre, extremo, incapacitante"""


def build_extraction_prompt(
    question: str,
    answer: str,
    scale_type: str,
    scale_options: Optional[list] = None,
) -> str:
    """Build a prompt for extracting a numeric value from a patient answer."""
    scale_info = ""
    if scale_options:
        scale_info = "\n\nOPÇÕES DA ESCALA:\n" + "\n".join(scale_options)

    return (
        f"PERGUNTA FEITA AO PACIENTE:\n{question}\n\n"
        f"RESPOSTA DO PACIENTE:\n{answer}\n\n"
        f"ESCALA: {scale_type}{scale_info}\n\n"
        f"Extraia o valor numérico correspondente (apenas o número):"
    )


def build_questionnaire_intro(
    questionnaire_type: str,
    patient_name: Optional[str] = None,
    cancer_type: Optional[str] = None,
    stage: Optional[str] = None,
) -> str:
    """Build the introductory message for a questionnaire session."""
    name_part = f" {patient_name}" if patient_name else ""
    context_parts = []

    if cancer_type:
        cancer_display = {
            "colorectal": "colorretal",
            "bladder": "bexiga",
            "renal": "renal",
            "prostate": "próstata",
        }.get(cancer_type.lower(), cancer_type)
        context_parts.append(f"câncer de {cancer_display}")

    if stage:
        stage_display = {
            "TREATMENT": "tratamento",
            "FOLLOW_UP": "acompanhamento",
            "DIAGNOSIS": "diagnóstico",
            "SCREENING": "triagem",
        }.get(stage, stage.lower())
        context_parts.append(f"etapa de {stage_display}")

    if questionnaire_type == "ESAS":
        return (
            f"Olá{name_part}! 😊 É hora do nosso check-in de sintomas.\n\n"
            f"Vou fazer *9 perguntas rápidas* sobre como você está se sentindo hoje. "
            f"Cada resposta é de 0 a 10. Leva apenas 2-3 minutinhos.\n\n"
            f"Vamos começar?"
        )
    elif questionnaire_type == "PRO_CTCAE":
        return (
            f"Olá{name_part}! 😊 Vamos fazer nosso questionário de acompanhamento.\n\n"
            f"Vou perguntar sobre *sintomas da última semana*. "
            f"Responda com honestidade — suas respostas ajudam a equipe médica "
            f"a cuidar melhor de você.\n\n"
            f"Pronto para começar?"
        )
    return f"Olá{name_part}! Vamos iniciar o questionário de acompanhamento."


QUESTIONNAIRE_SUMMARY_SYSTEM_PROMPT = """Você é um assistente de saúde oncológico empático.
Analise os resultados do questionário e gere um resumo amigável para o paciente.

REGRAS:
1. Use linguagem simples e acolhedora (não técnica)
2. Reconheça o esforço do paciente em responder
3. Se houver sintomas preocupantes, avise que a equipe vai entrar em contato
4. Se tudo estiver bem, encoraje o paciente
5. Seja conciso (máximo 3-4 frases)
6. Use emojis com moderação"""


def build_summary_prompt(
    questionnaire_type: str,
    scores: Dict[str, Any],
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Build a prompt for generating a patient-friendly questionnaire summary."""
    alerts = scores.get("alerts", [])
    interpretation = scores.get("interpretation", "")

    alert_text = ""
    if alerts:
        alert_items = []
        for alert in alerts[:3]:  # Max 3 alerts in summary
            item = alert.get("item", "")
            score = alert.get("score") or alert.get("grade", "")
            alert_items.append(f"- {item}: {score}")
        alert_text = "\nALERTAS:\n" + "\n".join(alert_items)

    if questionnaire_type == "ESAS":
        total = scores.get("total", 0)
        return (
            f"RESULTADO ESAS:\n"
            f"Pontuação total: {total}/90\n"
            f"Interpretação: {interpretation}"
            f"{alert_text}\n\n"
            f"Gere uma mensagem de encerramento amigável para o paciente."
        )
    else:
        return (
            f"RESULTADO PRO-CTCAE:\n"
            f"Interpretação: {interpretation}"
            f"{alert_text}\n\n"
            f"Gere uma mensagem de encerramento amigável para o paciente."
        )
