"""
Intent Classifier for the Oncology Navigation Agent.
Classifies patient messages before the main pipeline to enable
differentiated handling (fast greeting responses, emergency escalation, etc.).
Classification uses the LLM when API keys are configured; otherwise returns a
safe default without calling the model.
"""

import re
import logging
from typing import Any, Dict, List, Optional

from .llm_provider import llm_provider

logger = logging.getLogger(__name__)

MAX_INTENT_HISTORY_MESSAGES = 20

_INTENT_LLM_SYSTEM = """Você é um classificador de intenção para um assistente de navegação oncológica.
Classifique a mensagem do paciente em exatamente um dos intents abaixo.

Use as mensagens anteriores (user/assistant) quando existirem para desambiguar respostas curtas,
confirmações ("sim", "ok") e continuação de tópico; a intenção deve refletir o sentido no contexto
da conversa recente.

Regras de saída (obrigatório):
- Responda com UMA ÚNICA LINHA.
- Essa linha deve conter APENAS o nome do intent em LETRAS MAIÚSCULAS, sem pontuação, sem explicação.

Intents válidos (use exatamente estes rótulos):
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
    Classifies patient intent via LLM when keys are available;
    otherwise returns GENERAL without calling the model.
    """

    _NO_LLM_CONFIDENCE = 0.5
    _LLM_SUCCESS_CONFIDENCE = 0.85

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
        return intent == INTENT_GREETING

    def _no_llm_result(self, reason: str = "no_llm_keys") -> Dict[str, Any]:
        return self._result(
            INTENT_GENERAL,
            self._NO_LLM_CONFIDENCE,
            skip_pipeline=False,
            metadata={"source": "no_llm", "reason": reason},
        )

    def _llm_error_result(
        self,
        detail: str,
        *,
        llm_provider_name: Optional[str] = None,
        llm_model_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        meta: Dict[str, Any] = {"source": "llm_error", "detail": detail[:200]}
        if llm_provider_name:
            meta["llm_provider"] = llm_provider_name
        if llm_model_name:
            meta["llm_model"] = llm_model_name
        return self._result(
            INTENT_GENERAL,
            self._NO_LLM_CONFIDENCE,
            skip_pipeline=False,
            metadata=meta,
        )

    def _normalize_conversation_turn(self, item: Any) -> Optional[Dict[str, str]]:
        """Return a single {role, content} turn or None if invalid."""
        if not isinstance(item, dict):
            return None
        role = item.get("role")
        if role not in ("user", "assistant"):
            return None
        raw = item.get("content", "")
        if not isinstance(raw, str):
            raw = str(raw) if raw is not None else ""
        content = raw.strip()
        if not content:
            return None
        return {"role": role, "content": content}

    def _build_intent_messages(
        self,
        message: str,
        conversation_history: Optional[List[Dict[str, str]]],
        agent_config: Dict[str, Any],
    ) -> List[Dict[str, str]]:
        """
        Monta a lista de mensagens para o LLM: histórico normalizado, sem duplicar
        a última mensagem user se já for igual à mensagem atual; truncado às últimas N.
        """
        max_messages = agent_config.get(
            "intent_classifier_history_messages", MAX_INTENT_HISTORY_MESSAGES
        )
        try:
            max_messages = int(max_messages)
        except (TypeError, ValueError):
            max_messages = MAX_INTENT_HISTORY_MESSAGES
        if max_messages < 1:
            max_messages = MAX_INTENT_HISTORY_MESSAGES

        normalized: List[Dict[str, str]] = []
        if conversation_history:
            for item in conversation_history:
                turn = self._normalize_conversation_turn(item)
                if turn:
                    normalized.append(turn)

        msg_stripped = (message or "").strip()
        messages = list(normalized)

        if msg_stripped:
            last = messages[-1] if messages else None
            last_is_same_user = (
                last is not None
                and last.get("role") == "user"
                and (last.get("content") or "").strip() == msg_stripped
            )
            if not last_is_same_user:
                messages.append({"role": "user", "content": msg_stripped})

        if len(messages) > max_messages:
            messages = messages[-max_messages:]
        return messages

    async def classify_async(
        self,
        message: str,
        agent_state: Optional[Dict[str, Any]] = None,
        agent_config: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        Classify intent using the LLM when API keys exist and
        ``use_llm_intent_classifier`` is not False; otherwise GENERAL with
        ``metadata["source"] == "no_llm"``.
        """
        agent_config = agent_config or {}
        _ = agent_state  # Orchestrator passes state; reserved for future intent context.
        text = (message or "").strip()

        if not text:
            return self._no_llm_result("empty_message")

        has_llm_keys = llm_provider.has_any_llm_key(agent_config)
        use_llm = agent_config.get("use_llm_intent_classifier", True) is not False
        if not has_llm_keys or not use_llm:
            reason = "disabled" if not use_llm else "no_llm_keys"
            return self._no_llm_result(reason)

        try:
            llm_config = {
                "anthropic_api_key": agent_config.get("anthropic_api_key"),
                "openai_api_key": agent_config.get("openai_api_key"),
                "llm_provider": agent_config.get("llm_provider", "anthropic"),
                "llm_model": agent_config.get("llm_model", "claude-sonnet-4-6"),
            }
            intent_messages = self._build_intent_messages(
                text, conversation_history, agent_config
            )
            token_usage_events: List[Dict[str, Any]] = []
            resp = await llm_provider.generate(
                system_prompt=_INTENT_LLM_SYSTEM,
                messages=intent_messages,
                config=llm_config,
                usage_events=token_usage_events,
                usage_step="intent_classification",
            )
            parsed = self._parse_llm_intent(resp if isinstance(resp, str) else str(resp))
            if not parsed:
                logger.warning("Intent LLM returned unparseable output; using GENERAL")
                err = self._llm_error_result(
                    "parse_failed",
                    llm_provider_name=llm_config.get("llm_provider"),
                    llm_model_name=llm_config.get("llm_model"),
                )
                err["token_usage_events"] = token_usage_events
                return err

            metadata: Dict[str, Any] = {
                "source": "llm",
                "llm_provider": llm_config.get("llm_provider"),
                "llm_model": llm_config.get("llm_model"),
            }
            if parsed == INTENT_EMERGENCY:
                metadata["escalate_immediately"] = True

            logger.info(
                "Intent LLM: '%s...' -> %s",
                text[:40],
                parsed,
            )
            out = self._result(
                parsed,
                confidence=self._LLM_SUCCESS_CONFIDENCE,
                skip_pipeline=self._skip_pipeline_for_intent(parsed),
                metadata=metadata,
            )
            out["token_usage_events"] = token_usage_events
            return out
        except Exception as e:  # noqa: BLE001
            logger.warning("Intent LLM classification failed: %s", e)
            err = self._llm_error_result(
                str(e),
                llm_provider_name=agent_config.get("llm_provider", "anthropic"),
                llm_model_name=agent_config.get("llm_model", "claude-sonnet-4-6"),
            )
            err["token_usage_events"] = []
            return err


intent_classifier = IntentClassifier()
