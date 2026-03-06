"""
Intent Classifier for the Oncology Navigation Agent.
Classifies patient messages before the main pipeline to enable
differentiated handling (fast greeting responses, emergency escalation, etc.).
Uses regex/patterns for fast path; LLM fallback for ambiguous messages.
"""

import re
import logging
from typing import Dict, Any, Optional, List

from .llm_provider import llm_provider

logger = logging.getLogger(__name__)

# Confidence threshold below which we try LLM fallback
CONFIDENCE_THRESHOLD_LLM = 0.75

_INTENT_LLM_SYSTEM = """Você é um classificador de intenção para um assistente de navegação oncológica.
Sua tarefa: classificar a mensagem do paciente em exatamente um dos intents abaixo.
Responda APENAS com o nome do intent, nada mais.

Intents válidos:
- EMERGENCY: urgência médica, sangramento grave, convulsão, desmaio, dor muito forte no peito, não consigo respirar
- SYMPTOM_REPORT: relato de sintomas físicos (dor, náusea, febre, tosse, cansaço, etc.)
- GREETING: cumprimento simples (oi, olá, bom dia, tudo bem)
- QUESTION: pergunta sobre tratamento, exame, medicação ou procedimento
- EMOTIONAL_SUPPORT: sofrimento emocional, medo, ansiedade, tristeza, desânimo
- APPOINTMENT_QUERY: consulta sobre data/horário de consulta, exame ou retorno
- OFF_TOPIC: assunto fora do contexto oncológico
- GENERAL: não se enquadra nos anteriores"""

INTENT_EMERGENCY = "EMERGENCY"
INTENT_SYMPTOM_REPORT = "SYMPTOM_REPORT"
INTENT_GREETING = "GREETING"
INTENT_QUESTION = "QUESTION"
INTENT_EMOTIONAL_SUPPORT = "EMOTIONAL_SUPPORT"
INTENT_APPOINTMENT_QUERY = "APPOINTMENT_QUERY"
INTENT_OFF_TOPIC = "OFF_TOPIC"
INTENT_GENERAL = "GENERAL"

_EMERGENCY_PATTERNS = [
    r"\b(sangrando\s+muito|hemorragia|sangue\s+(?:na\s+boca|nariz|urina|fezes))\b",
    r"\b(n[aã]o\s+consigo\s+respirar|falta\s+de\s+ar\s+(?:forte|intensa|grave))\b",
    r"\b(desmaiei|desmaio|perdi\s+a\s+consci[eê]ncia|apaguei)\b",
    r"\b(convuls[aã]o|convulsionando)\b",
    r"\b(febre\s+(?:muito\s+)?alta|febre\s+(?:acima\s+de\s+)?3[89])\b",
    r"\b(dor\s+(?:muito\s+forte|insuport[aá]vel|10|no\s+peito))\b",
    r"\b(emerg[eê]ncia|urgente|socorro|me\s+ajud[ae]m?)\b",
    r"\b(ca[ií]\s+e|fraturei|quebrei)\b",
    r"\b(vomitando\s+sangue|hemoptise|mel[ae]na)\b",
    r"\b(confus[aã]o\s+mental|desorientad[oa])\b",
]

_GREETING_PATTERNS = [
    r"^\s*(oi|ol[aá]|bom\s+dia|boa\s+(?:tarde|noite)|hey|e\s+a[ií]|tudo\s+bem|como\s+vai)\s*[!?.]*\s*$",
    r"^\s*(oi+|ol[aá]+)\s*[!?.]*\s*$",
]

_APPOINTMENT_PATTERNS = [
    r"\b(consulta|retorno|exame|pr[oó]xim[oa]\s+(?:consulta|exame|retorno))\b",
    r"\b(quando\s+(?:[eé]|ser[aá])\s+(?:a|o)\s+(?:consulta|exame|retorno))\b",
    r"\b(agendar|marcar|remarcar|desmarcar|cancelar)\b.*\b(consulta|exame|retorno)\b",
    r"\b(data|hor[aá]rio|dia)\b.*\b(consulta|exame|retorno)\b",
]

_EMOTIONAL_PATTERNS = [
    r"\b(ansios[oa]|ansiedade|deprimi[do]|triste|medo|angustiad[oa])\b",
    r"\b(chorand[oa]|n[aã]o\s+aguento\s+mais|desanimad[oa]|sem\s+esperan[cç]a)\b",
    r"\b(sozinho|isolad[oa]|ningu[eé]m\s+me\s+entende)\b",
    r"\b(vontade\s+de\s+desistir|n[aã]o\s+quero\s+mais\s+(?:tratar|viver))\b",
    r"\b(psicologo|psicologica|emocional|saude\s+mental)\b",
]

_SYMPTOM_PATTERNS = [
    r"\b(dor|d[oó]i|doendo|n[aá]usea|vomit|febre|tontura|cansa[cç]o|fadiga)\b",
    r"\b(diarr[eé]ia|constipa[cç][aã]o|inchaço|edema|formigamento)\b",
    r"\b(tosse|falta\s+de\s+ar|dispneia|queda\s+de\s+cabelo|mucosite)\b",
    r"\b(insonia|n[aã]o\s+consigo\s+dormir|acordo\s+de\s+madrugada)\b",
    r"\b(piora[ndr]|piorou|sint[ao]ma|efeito\s+colateral)\b",
    r"\b(sangue|sangramento|hematoma|ferida|les[aã]o)\b",
    r"\b(apetite|peso|emagrecendo|engordando)\b",
]

_QUESTION_INDICATORS = [
    r"^(o\s+que|como|quando|onde|por\s*que|qual|quais|quanto)\b",
    r"\?\s*$",
    r"\b(pode\s+me\s+(?:explicar|dizer|falar)|gostaria\s+de\s+saber)\b",
    r"\b(o\s+que\s+(?:[eé]|significa|quer\s+dizer))\b",
    r"\b(posso|devo|preciso)\b.+\?",
]


_VALID_INTENTS = frozenset(
    {
        INTENT_EMERGENCY,
        INTENT_SYMPTOM_REPORT,
        INTENT_GREETING,
        INTENT_QUESTION,
        INTENT_EMOTIONAL_SUPPORT,
        INTENT_APPOINTMENT_QUERY,
        INTENT_OFF_TOPIC,
        INTENT_GENERAL,
    }
)

# Map LLM output variations to canonical intent
_LLM_INTENT_MAP = {
    "emergency": INTENT_EMERGENCY,
    "symptom_report": INTENT_SYMPTOM_REPORT,
    "symptom": INTENT_SYMPTOM_REPORT,
    "greeting": INTENT_GREETING,
    "question": INTENT_QUESTION,
    "emotional_support": INTENT_EMOTIONAL_SUPPORT,
    "emotional": INTENT_EMOTIONAL_SUPPORT,
    "appointment_query": INTENT_APPOINTMENT_QUERY,
    "appointment": INTENT_APPOINTMENT_QUERY,
    "off_topic": INTENT_OFF_TOPIC,
    "general": INTENT_GENERAL,
}


class IntentClassifier:
    """
    Classifies patient intent using a fast keyword/pattern approach
    with an optional LLM fallback for ambiguous messages.
    """

    def classify(
        self,
        message: str,
        agent_state: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Classify the intent of a patient message (fast path, regex only).

        Returns:
            Dict with:
                - intent: One of the INTENT_* constants
                - confidence: 0.0 to 1.0
                - skip_full_pipeline: Whether to bypass symptom analysis / protocol eval
                - metadata: Extra info relevant to the detected intent
        """
        text = message.strip().lower()

        if not text:
            return self._result(INTENT_GENERAL, 0.3)

        if self._matches_any(text, _EMERGENCY_PATTERNS):
            return self._result(
                INTENT_EMERGENCY,
                0.95,
                skip_pipeline=False,
                metadata={
                    "escalate_immediately": True,
                },
            )

        if self._matches_any(text, _GREETING_PATTERNS) and len(text) < 40:
            return self._result(INTENT_GREETING, 0.9, skip_pipeline=True)

        has_symptom = self._matches_any(text, _SYMPTOM_PATTERNS)
        has_emotional = self._matches_any(text, _EMOTIONAL_PATTERNS)
        has_question = self._matches_any(text, _QUESTION_INDICATORS)
        has_appointment = self._matches_any(text, _APPOINTMENT_PATTERNS)

        if has_symptom and has_emotional:
            return self._result(
                INTENT_SYMPTOM_REPORT,
                0.85,
                metadata={
                    "emotional_component": True,
                },
            )

        if has_symptom:
            return self._result(INTENT_SYMPTOM_REPORT, 0.85)

        if has_emotional:
            return self._result(INTENT_EMOTIONAL_SUPPORT, 0.8)

        if has_appointment:
            return self._result(INTENT_APPOINTMENT_QUERY, 0.8, skip_pipeline=True)

        if has_question and not has_symptom:
            return self._result(INTENT_QUESTION, 0.7)

        return self._result(INTENT_GENERAL, 0.4)

    def _matches_any(self, text: str, patterns: List[str]) -> bool:
        return any(re.search(p, text, re.IGNORECASE) for p in patterns)

    def _result(
        self,
        intent: str,
        confidence: float,
        skip_pipeline: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return {
            "intent": intent,
            "confidence": confidence,
            "skip_full_pipeline": skip_pipeline,
            "metadata": metadata or {},
        }

    def _parse_llm_intent(self, raw: str) -> Optional[str]:
        """Extract intent from LLM response; return None if unparseable."""
        text = (raw or "").strip()
        if not text:
            return None
        # Try exact match (case-insensitive)
        upper = text.upper()
        if upper in _VALID_INTENTS:
            return upper
        # Try first line / first word (LLM might say "EMERGENCY" or "The intent is EMERGENCY")
        first_token = text.split()[0] if text.split() else ""
        if first_token.upper() in _VALID_INTENTS:
            return first_token.upper()
        # Search for any valid intent name in the response
        for intent in _VALID_INTENTS:
            if intent.lower() in text.lower():
                return intent
        # Try normalized key
        normalized = re.sub(r"[\s_\-]+", "_", upper).strip("_")
        key = normalized.lower()
        return _LLM_INTENT_MAP.get(key)

    def _skip_pipeline_for_intent(self, intent: str) -> bool:
        """Whether this intent should skip full symptom/protocol pipeline."""
        return intent in (INTENT_GREETING, INTENT_APPOINTMENT_QUERY)

    async def classify_async(
        self,
        message: str,
        agent_state: Optional[Dict[str, Any]] = None,
        agent_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Classify intent with optional LLM fallback for ambiguous messages.
        Uses regex first; if confidence < threshold and API keys are configured,
        calls LLM for disambiguation.
        """
        regex_result = self.classify(message, agent_state)
        agent_config = agent_config or {}
        confidence = regex_result["confidence"]
        intent = regex_result["intent"]

        # Fast path: high confidence, no LLM needed
        if confidence >= CONFIDENCE_THRESHOLD_LLM:
            return regex_result

        has_llm_keys = bool(
            agent_config.get("anthropic_api_key") or agent_config.get("openai_api_key")
        )
        use_llm = agent_config.get("use_llm_intent_classifier", True) and has_llm_keys

        if not use_llm:
            return regex_result

        try:
            llm_config = {
                "anthropic_api_key": agent_config.get("anthropic_api_key"),
                "openai_api_key": agent_config.get("openai_api_key"),
                "llm_provider": agent_config.get("llm_provider", "anthropic"),
                "llm_model": agent_config.get("llm_model", "claude-sonnet-4-6"),
            }
            resp = await llm_provider.generate(
                system_prompt=_INTENT_LLM_SYSTEM,
                messages=[{"role": "user", "content": message}],
                config=llm_config,
            )
            parsed = self._parse_llm_intent(resp)
            if parsed:
                logger.info(
                    f"Intent LLM fallback: '{message[:40]}...' -> {parsed} (was {intent})"
                )
                return self._result(
                    parsed,
                    confidence=0.85,
                    skip_pipeline=self._skip_pipeline_for_intent(parsed),
                    metadata={**regex_result.get("metadata", {}), "source": "llm"},
                )
        except Exception as e:
            logger.warning(f"Intent LLM fallback failed: {e}; using regex result")

        return regex_result


intent_classifier = IntentClassifier()
