"""
Guardrails determinísticos para mensagens ao/ do paciente (WhatsApp).

Input: antes do pipeline LLM. Output: antes de devolver `response` ao backend.
Não registra conteúdo PHI — apenas rule_id no trace.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional, Pattern

# Limite conservador para canal WhatsApp + contexto do orquestrador.
MAX_PATIENT_MESSAGE_CHARS = 4000

_INPUT_BLOCKED_RESPONSE = (
    "Recebi sua mensagem. Por segurança, não consigo seguir instruções que peçam "
    "diagnóstico, prescrição de medicamentos ou alteração do meu papel clínico. "
    "Se você tiver sintomas ou dúvidas sobre o tratamento, descreva como se sente "
    "em suas palavras ou fale com a equipe de enfermagem. Em emergência, procure o "
    "pronto-socorro ou ligue para o SAMU (192)."
)

_OUTPUT_SAFE_RESPONSE = (
    "Não posso fornecer diagnóstico, prescrição com dose ou garantias sobre o tratamento. "
    "Posso ajudar a organizar informações e orientar quando buscar a equipe ou o pronto-socorro. "
    "Se houver piora importante ou risco imediato, procure o pronto-socorro ou ligue para o SAMU (192)."
)


@dataclass(frozen=True)
class PatientGuardrailResult:
    triggered: bool
    rule_id: Optional[str] = None
    safe_text: Optional[str] = None


def _compile(patterns: tuple[str, ...]) -> tuple[Pattern[str], ...]:
    return tuple(re.compile(p, re.IGNORECASE | re.UNICODE) for p in patterns)


# Pedidos explícitos de prescrição/diagnóstico como instrução ao modelo.
_INPUT_BLOCK_PATTERNS = _compile(
    (
        r"(?i)ignore\s+(all\s+)?(previous|prior)\s+instructions",
        r"(?i)você\s+é\s+agora\s+um",
        r"(?i)finja\s+que\s+é",
        r"(?i)modo\s+desenvolvedor",
        r"(?i)jailbreak",
        r"(?i)\b(diagno[st]|diagnosticar)\b.{0,40}\b(paciente|você|voce)\b",
        r"(?i)\b(prescrev|receite|indique)\b.{0,30}\b(mg|ml|comprimido|cp|dose)\b",
        r"(?i)\b(tome|tomar)\b.{0,25}\b(mg|ml|comprimidos?)\b",
    )
)

# Saída: diagnóstico definitivo, prescrição com dose, garantias.
_OUTPUT_BLOCK_PATTERNS: tuple[tuple[str, Pattern[str]], ...] = (
    (
        "output_diagnosis_definitive",
        re.compile(
            r"(?i)\b(você\s+tem|o\s+diagnóstico\s+é|confirmo\s+que\s+é|é\s+câncer\s+de)\b",
            re.UNICODE,
        ),
    ),
    (
        "output_prescription_dose",
        re.compile(
            r"(?i)\b(tome|tomar|use|aplique)\b.{0,40}\b\d+\s*(mg|ml|g|ui|comprimidos?|cp)\b",
            re.UNICODE,
        ),
    ),
    (
        "output_cure_guarantee",
        re.compile(
            r"(?i)\b(vai\s+curar|cura\s+completa|garanto\s+que|certeza\s+de\s+cura|100%\s+de\s+chance)\b",
            re.UNICODE,
        ),
    ),
)

# Urgência legítima — não substituir por texto “seguro” genérico.
_URGENCY_ALLOWLIST = _compile(
    (
        r"(?i)\bSAMU\b|\b192\b",
        r"(?i)pronto[\s-]?socorro",
        r"(?i)\bemergência\b|\burgência\b",
        r"(?i)atenção\s+imediata",
        r"(?i)procure\s+o\s+(ps|pronto)",
        r"(?i)ER_IMMEDIATE",
    )
)


def check_patient_input(message: str) -> PatientGuardrailResult:
    """Bloqueia input óbvio de injection ou pedido de prescrição/diagnóstico como instrução."""
    raw = (message or "").strip()
    if not raw:
        return PatientGuardrailResult(
            triggered=True,
            rule_id="input_empty",
            safe_text=(
                "Não recebi o texto da sua mensagem. Pode repetir em poucas palavras "
                "como você está se sentindo?"
            ),
        )
    if len(raw) > MAX_PATIENT_MESSAGE_CHARS:
        return PatientGuardrailResult(
            triggered=True,
            rule_id="input_oversized",
            safe_text=(
                "Sua mensagem é muito longa para eu processar de uma vez. "
                "Pode resumir o principal em até alguns parágrafos?"
            ),
        )
    for pattern in _INPUT_BLOCK_PATTERNS:
        if pattern.search(raw):
            return PatientGuardrailResult(
                triggered=True,
                rule_id="input_policy_block",
                safe_text=_INPUT_BLOCKED_RESPONSE,
            )
    return PatientGuardrailResult(triggered=False)


def _output_matches_urgency_allowlist(text: str) -> bool:
    return any(p.search(text) for p in _URGENCY_ALLOWLIST)


def check_patient_output(text: str) -> PatientGuardrailResult:
    """Filtra saída ao paciente; preserva mensagens de urgência na allowlist."""
    raw = (text or "").strip()
    if not raw:
        return PatientGuardrailResult(triggered=False)
    if _output_matches_urgency_allowlist(raw):
        return PatientGuardrailResult(triggered=False)
    for rule_id, pattern in _OUTPUT_BLOCK_PATTERNS:
        if pattern.search(raw):
            return PatientGuardrailResult(
                triggered=True,
                rule_id=rule_id,
                safe_text=_OUTPUT_SAFE_RESPONSE,
            )
    return PatientGuardrailResult(triggered=False)
