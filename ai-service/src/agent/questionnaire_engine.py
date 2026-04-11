import re
import logging
from typing import Dict, List, Optional, Any, Tuple
from .clinical_thresholds import ESAS_ALERT_THRESHOLD, PRO_CTCAE_ALERT_GRADE
from .llm_provider import llm_provider

"""
Questionnaire Engine.
Applies clinical questionnaires (PRO-CTCAE, ESAS) in conversational format.
The agent asks one question at a time, interprets free-form responses,
and extracts structured answers.
"""

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# ESAS: Edmonton Symptom Assessment System
# 0-10 numeric scale for each item
# ─────────────────────────────────────────────────────────────
ESAS_ITEMS: Dict[str, str] = {
    "pain": "De 0 a 10, como está sua *dor* agora? (0 = sem dor, 10 = pior dor possível)",
    "fatigue": "De 0 a 10, como está seu *cansaço*? (0 = sem cansaço, 10 = cansaço extremo)",
    "nausea": "De 0 a 10, como está sua *náusea*? (0 = sem náusea, 10 = náusea intensa)",
    "depression": (
        "De 0 a 10, como está seu *humor/depressão*? "
        "(0 = humor ótimo, 10 = muito deprimido)"
    ),
    "anxiety": (
        "De 0 a 10, como está sua *ansiedade*? "
        "(0 = sem ansiedade, 10 = ansiedade extrema)"
    ),
    "drowsiness": "De 0 a 10, como está sua *sonolência*? (0 = sem sonolência, 10 = muito sonolento)",
    "appetite": (
        "De 0 a 10, como está seu *apetite*? "
        "(0 = apetite normal, 10 = sem apetite nenhum)"
    ),
    "wellbeing": (
        "De 0 a 10, como você está se sentindo *no geral*? "
        "(0 = ótimo, 10 = muito mal)"
    ),
    "dyspnea": "De 0 a 10, como está sua *falta de ar*? (0 = sem falta de ar, 10 = intensa)",
}

ESAS_ITEM_ORDER: List[str] = [
    "pain", "fatigue", "nausea", "depression", "anxiety",
    "drowsiness", "appetite", "wellbeing", "dyspnea",
]

# ─────────────────────────────────────────────────────────────
# PRO-CTCAE: Patient-Reported Outcomes version of CTCAE
# Frequency + Severity/Interference per symptom
# ─────────────────────────────────────────────────────────────
PRO_CTCAE_ITEMS: Dict[str, Dict[str, Any]] = {
    "nausea": {
        "frequency": "Com que frequência você sentiu *náusea* na última semana?",
        "severity": "Quando a náusea aconteceu, qual foi a *intensidade*?",
        "scale_frequency": [
            "0 - Nenhuma",
            "1 - Raramente",
            "2 - Ocasionalmente",
            "3 - Frequentemente",
            "4 - Quase constantemente",
        ],
        "scale_severity": [
            "0 - Sem sintoma",
            "1 - Leve",
            "2 - Moderada",
            "3 - Grave",
            "4 - Muito grave / incapacitante",
        ],
    },
    "pain": {
        "severity": "Na última semana, qual foi a *pior dor* que você sentiu?",
        "interference": "Quanto essa dor *atrapalhou* suas atividades do dia a dia?",
        "scale_severity": [
            "0 - Sem dor",
            "1 - Leve",
            "2 - Moderada",
            "3 - Grave",
            "4 - Muito grave / incapacitante",
        ],
        "scale_interference": [
            "0 - Nada",
            "1 - Um pouco",
            "2 - Moderadamente",
            "3 - Bastante",
            "4 - Muito",
        ],
    },
    "fatigue": {
        "severity": "Qual foi o *nível de cansaço* (fadiga) na última semana?",
        "interference": "Quanto esse cansaço *atrapalhou* suas atividades?",
        "scale_severity": [
            "0 - Sem cansaço",
            "1 - Leve",
            "2 - Moderado",
            "3 - Grave",
            "4 - Muito grave / incapacitante",
        ],
        "scale_interference": [
            "0 - Nada",
            "1 - Um pouco",
            "2 - Moderadamente",
            "3 - Bastante",
            "4 - Muito",
        ],
    },
    "diarrhea": {
        "frequency": "Com que frequência você teve *diarreia* na última semana?",
        "severity": "Quando teve diarreia, qual foi a *intensidade*?",
        "scale_frequency": [
            "0 - Nenhuma",
            "1 - Raramente",
            "2 - Ocasionalmente",
            "3 - Frequentemente",
            "4 - Quase constantemente",
        ],
        "scale_severity": [
            "0 - Sem sintoma",
            "1 - Leve",
            "2 - Moderada",
            "3 - Grave",
            "4 - Muito grave",
        ],
    },
    "constipation": {
        "severity": "Como foi sua *prisão de ventre* na última semana?",
        "scale_severity": [
            "0 - Sem sintoma",
            "1 - Leve (desconforto ocasional)",
            "2 - Moderada (uso de laxantes)",
            "3 - Grave (obstrução manual ou enema)",
            "4 - Muito grave / risco à vida",
        ],
    },
    "appetite_loss": {
        "severity": "Como foi sua *falta de apetite* na última semana?",
        "interference": "Quanto a falta de apetite *atrapalhou* sua alimentação?",
        "scale_severity": [
            "0 - Sem sintoma",
            "1 - Leve",
            "2 - Moderada",
            "3 - Grave",
            "4 - Muito grave",
        ],
        "scale_interference": [
            "0 - Nada",
            "1 - Um pouco",
            "2 - Moderadamente",
            "3 - Bastante",
            "4 - Muito",
        ],
    },
    "dyspnea": {
        "severity": "Como foi sua *falta de ar* na última semana?",
        "interference": "Quanto a falta de ar *limitou* suas atividades?",
        "scale_severity": [
            "0 - Sem sintoma",
            "1 - Leve (aos grandes esforços)",
            "2 - Moderada (aos médios esforços)",
            "3 - Grave (aos pequenos esforços)",
            "4 - Muito grave (em repouso)",
        ],
        "scale_interference": [
            "0 - Nada",
            "1 - Um pouco",
            "2 - Moderadamente",
            "3 - Bastante",
            "4 - Muito",
        ],
    },
    "insomnia": {
        "frequency": "Com que frequência você teve dificuldade para *dormir* na última semana?",
        "severity": "Quando teve problemas de sono, qual foi a *intensidade*?",
        "scale_frequency": [
            "0 - Nenhuma",
            "1 - Raramente",
            "2 - Ocasionalmente",
            "3 - Frequentemente",
            "4 - Quase todo dia",
        ],
        "scale_severity": [
            "0 - Sem sintoma",
            "1 - Leve",
            "2 - Moderado",
            "3 - Grave",
            "4 - Muito grave",
        ],
    },
    "neuropathy": {
        "severity": "Como foi o *formigamento ou dormência* nas mãos/pés na última semana?",
        "interference": "Quanto isso *atrapalhou* suas atividades?",
        "scale_severity": [
            "0 - Sem sintoma",
            "1 - Leve",
            "2 - Moderado",
            "3 - Grave",
            "4 - Muito grave / incapacitante",
        ],
        "scale_interference": [
            "0 - Nada",
            "1 - Um pouco",
            "2 - Moderadamente",
            "3 - Bastante",
            "4 - Muito",
        ],
    },
    "mucositis": {
        "severity": "Como estão as *feridas/aftas na boca* na última semana?",
        "interference": "Quanto isso *atrapalhou* sua alimentação ou fala?",
        "scale_severity": [
            "0 - Sem sintoma",
            "1 - Leve (aftas superficiais)",
            "2 - Moderado (dor mas ainda come)",
            "3 - Grave (não consegue comer)",
            "4 - Muito grave / consequências à vida",
        ],
        "scale_interference": [
            "0 - Nada",
            "1 - Um pouco",
            "2 - Moderadamente",
            "3 - Bastante",
            "4 - Muito",
        ],
    },
}

PRO_CTCAE_ITEM_ORDER: List[str] = [
    "pain", "fatigue", "nausea", "diarrhea", "constipation",
    "appetite_loss", "dyspnea", "insomnia", "neuropathy", "mucositis",
]


class QuestionnaireEngine:
    """
    Manages conversational clinical questionnaires (PRO-CTCAE, ESAS).
    Asks one question at a time, extracts numeric answers from natural language.
    """

    def build_initial_state(
        self,
        questionnaire_type: str,
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Build initial questionnaire state for a new questionnaire session.

        Args:
            questionnaire_type: "ESAS" or "PRO_CTCAE"
            patient_context: Optional patient context

        Returns:
            Initial questionnaire state dict (to be stored in Conversation.questionnaireProgress)
        """
        if questionnaire_type == "ESAS":
            items = list(ESAS_ITEM_ORDER)
        elif questionnaire_type == "PRO_CTCAE":
            items = self._build_pro_ctcae_question_sequence()
        else:
            raise ValueError(f"Unknown questionnaire type: {questionnaire_type}")

        return {
            "type": questionnaire_type,
            "items": items,
            "currentIndex": 0,
            "answers": {},
            "startedAt": None,
            "completedAt": None,
        }

    def _build_pro_ctcae_question_sequence(self) -> List[Dict[str, str]]:
        """Build an ordered list of (item, attribute) tuples for PRO-CTCAE."""
        sequence = []
        for item in PRO_CTCAE_ITEM_ORDER:
            config = PRO_CTCAE_ITEMS.get(item, {})
            for attr in ["frequency", "severity", "interference"]:
                if attr in config:
                    sequence.append({"item": item, "attribute": attr})
        return sequence

    def get_current_question(
        self, questionnaire_state: Dict[str, Any]
    ) -> Optional[str]:
        """
        Get the current question text to send to the patient.

        Args:
            questionnaire_state: Current questionnaire progress

        Returns:
            Question text or None if questionnaire is complete
        """
        q_type = questionnaire_state.get("type")
        items = questionnaire_state.get("items", [])
        idx = questionnaire_state.get("currentIndex", 0)

        if idx >= len(items):
            return None  # Questionnaire complete

        if q_type == "ESAS":
            item_key = items[idx]
            return ESAS_ITEMS.get(item_key)

        elif q_type == "PRO_CTCAE":
            item_info = items[idx]
            item_key = item_info["item"]
            attr = item_info["attribute"]
            config = PRO_CTCAE_ITEMS.get(item_key, {})
            question = config.get(attr)

            # Append scale options
            scale_key = f"scale_{attr}"
            if scale_key in config:
                options = config[scale_key]
                scale_text = "\n".join(options)
                return f"{question}\n\n{scale_text}"

            return question

        return None

    def format_greeting(
        self, questionnaire_type: str, patient_name: Optional[str] = None
    ) -> str:
        """Format the greeting message before starting a questionnaire."""
        name_part = f"_{patient_name}_" if patient_name else ""

        if questionnaire_type == "ESAS":
            return (
                f"Olá{', ' + name_part if name_part else ''}! 😊 "
                f"Chegou a hora do nosso check-in de sintomas. "
                f"Vou fazer 9 perguntinhas sobre como você está se sentindo. "
                f"É rápido, leva só 2-3 minutos. Pode começar?"
            )
        elif questionnaire_type == "PRO_CTCAE":
            return (
                f"Olá{', ' + name_part if name_part else ''}! 😊 "
                f"Vamos fazer nosso questionário de acompanhamento. "
                f"Vou perguntar sobre alguns sintomas da última semana. "
                f"Responda da forma mais honesta que puder. Pronto?"
            )
        return "Vamos começar nosso questionário de acompanhamento."

    async def process_answer(
        self,
        answer_text: str,
        questionnaire_state: Dict[str, Any],
        use_llm: bool = False,
        llm_config: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Process a patient's answer and advance the questionnaire.

        Args:
            answer_text: Free-form patient answer
            questionnaire_state: Current questionnaire progress
            use_llm: Whether to use LLM for answer extraction
            llm_config: LLM configuration

        Returns:
            Tuple of (is_complete, updated_state, next_question_or_summary)
        """
        q_type = questionnaire_state.get("type")
        items = questionnaire_state.get("items", [])
        idx = questionnaire_state.get("currentIndex", 0)

        if idx >= len(items):
            # Already complete
            return True, questionnaire_state, self._build_completion_message(questionnaire_state)

        # Extract numeric value from answer
        extracted_value = await self._extract_answer_value(
            answer_text=answer_text,
            questionnaire_type=q_type,
            current_index=idx,
            items=items,
            use_llm=use_llm,
            llm_config=llm_config,
        )

        # Record the answer
        if q_type == "ESAS":
            item_key = items[idx]
            questionnaire_state.setdefault("answers", {})[item_key] = extracted_value
        elif q_type == "PRO_CTCAE":
            item_info = items[idx]
            key = f"{item_info['item']}_{item_info['attribute']}"
            questionnaire_state.setdefault("answers", {})[key] = extracted_value

        # Advance index
        questionnaire_state["currentIndex"] = idx + 1

        # Check if complete
        if questionnaire_state["currentIndex"] >= len(items):
            # Questionnaire finished
            return True, questionnaire_state, self._build_completion_message(questionnaire_state)

        # Get next question
        next_question = self.get_current_question(questionnaire_state)
        return False, questionnaire_state, next_question

    async def _extract_answer_value(
        self,
        answer_text: str,
        questionnaire_type: str,
        current_index: int,
        items: List,
        use_llm: bool = False,
        llm_config: Optional[Dict[str, Any]] = None,
    ) -> Optional[int]:
        """
        Extract a numeric value from a free-form patient answer.
        First tries regex, falls back to LLM if enabled.
        """
        # Try regex extraction first (fast path)
        value = self._regex_extract_number(answer_text, questionnaire_type)
        if value is not None:
            return value

        # LLM extraction fallback
        if use_llm and llm_config:
            return await self._llm_extract_number(answer_text, questionnaire_type, llm_config)

        # Last resort: keyword mapping
        return self._keyword_to_number(answer_text)

    def _regex_extract_number(
        self, text: str, questionnaire_type: str
    ) -> Optional[int]:
        """Extract number from text using regex patterns."""
        text_lower = text.lower().strip()

        # Direct numeric answer (e.g. "7", "3/10", "nota 5")
        patterns = [
            r"^(\d+)\s*/\s*10",       # "7/10"
            r"^(\d+)\s*$",             # "7"
            r"nota\s+(\d+)",           # "nota 7"
            r"(\d+)\s+de\s+10",        # "7 de 10"
            r"número\s+(\d+)",         # "número 7"
        ]

        for pattern in patterns:
            match = re.search(pattern, text_lower)
            if match:
                val = int(match.group(1))
                max_val = 10 if questionnaire_type == "ESAS" else 4
                if 0 <= val <= max_val:
                    return val

        # PRO-CTCAE ordinal extraction
        if questionnaire_type == "PRO_CTCAE":
            return self._extract_ordinal(text_lower)

        return None

    def _extract_ordinal(self, text: str) -> Optional[int]:
        """Map ordinal words to PRO-CTCAE grade (0-4)."""
        mappings = {
            0: ["nenhuma", "nenhum", "não tenho", "não senti", "sem sintoma", "zero", "não"],
            1: ["leve", "pouquinho", "pouco", "raramente", "levemente", "fraco"],
            2: ["moderado", "moderada", "às vezes", "ocasionalmente", "médio", "médio"],
            3: ["frequente", "frequentemente", "bastante", "grave", "muito"],
            4: ["sempre", "constantemente", "quase sempre", "extremo", "extrema", "incapacitante"],
        }

        for grade, keywords in mappings.items():
            if any(kw in text for kw in keywords):
                return grade

        return None

    def _keyword_to_number(self, text: str) -> Optional[int]:
        """Last-resort keyword mapping for ESAS (0-10 scale)."""
        text_lower = text.lower()

        keyword_scores = {
            "zero": 0, "ótimo": 0, "perfeito": 0, "sem": 0, "nada": 0,
            "pouco": 2, "leve": 2, "levinho": 1,
            "moderado": 5, "médio": 5, "razoável": 4,
            "muito": 7, "bastante": 7, "forte": 7,
            "extremo": 9, "insuportável": 10, "horrível": 9, "péssimo": 8,
        }

        for keyword, score in keyword_scores.items():
            if keyword in text_lower:
                return score

        return None

    async def _llm_extract_number(
        self,
        text: str,
        questionnaire_type: str,
        llm_config: Dict[str, Any],
    ) -> Optional[int]:
        """Use LLM to extract a numeric answer from free-form text."""
        try:
            max_val = 10 if questionnaire_type == "ESAS" else 4
            system = (
                f"Extraia um número de 0 a {max_val} da resposta do paciente. "
                f"Responda APENAS com o número (ex: 3). "
                f"Se não conseguir extrair, responda com -1."
            )

            response = await llm_provider.generate(
                system_prompt=system,
                messages=[{"role": "user", "content": text}],
                config=llm_config,
            )

            num = int(response.strip())
            if 0 <= num <= max_val:
                return num

        except (ValueError, TypeError, Exception) as e:
            logger.warning(f"LLM number extraction failed: {e}")

        return None

    def score_responses(
        self, questionnaire_type: str, answers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate aggregate scores.

        Args:
            questionnaire_type: "ESAS" or "PRO_CTCAE"
            answers: Dict of item → numeric value

        Returns:
            Dict with total score, item scores, and alerts
        """
        if questionnaire_type == "ESAS":
            return self._score_esas(answers)
        elif questionnaire_type == "PRO_CTCAE":
            return self._score_pro_ctcae(answers)
        return {}

    def _score_esas(self, answers: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate ESAS scores and detect high-score alerts."""
        total = 0
        item_scores = {}
        alerts = []

        for item in ESAS_ITEM_ORDER:
            score = answers.get(item)
            if score is not None:
                item_scores[item] = score
                total += score
                if score >= ESAS_ALERT_THRESHOLD:
                    alerts.append({
                        "item": item,
                        "score": score,
                        "severity": "HIGH" if score >= 8 else "MEDIUM",
                    })

        return {
            "total": total,
            "items": item_scores,
            "alerts": alerts,
            "interpretation": self._interpret_esas_total(total),
        }

    def _interpret_esas_total(self, total: int) -> str:
        """Interpret ESAS total score."""
        if total <= 20:
            return "Sintomas bem controlados"
        elif total <= 40:
            return "Sintomas moderados — monitorar de perto"
        elif total <= 60:
            return "Sintomas consideráveis — revisar com equipe"
        else:
            return "Carga sintomática alta — intervenção necessária"

    def _score_pro_ctcae(self, answers: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate PRO-CTCAE grades and detect high-grade alerts."""
        item_grades: Dict[str, Dict[str, int]] = {}
        alerts = []

        for key, value in answers.items():
            if value is None:
                continue
            parts = key.rsplit("_", 1)
            if len(parts) == 2:
                item, attribute = parts[0], parts[1]
            else:
                continue

            item_grades.setdefault(item, {})[attribute] = value

            if value >= PRO_CTCAE_ALERT_GRADE:
                alerts.append({
                    "item": item,
                    "attribute": attribute,
                    "grade": value,
                    "severity": "CRITICAL" if value == 4 else "HIGH",
                })

        return {
            "grades": item_grades,
            "alerts": alerts,
            "interpretation": (
                "Sintomas severos detectados — revisão clínica necessária"
                if any(a["severity"] == "CRITICAL" for a in alerts)
                else (
                    "Sintomas moderados a graves — acompanhar de perto"
                    if alerts
                    else "Sintomas leves ou controlados"
                )
            ),
        }

    def _build_completion_message(
        self, questionnaire_state: Dict[str, Any]
    ) -> str:
        """Build a completion message after questionnaire is done."""
        q_type = questionnaire_state.get("type", "")
        answers = questionnaire_state.get("answers", {})

        scores = self.score_responses(q_type, answers)
        alerts = scores.get("alerts", [])

        base = (
            "✅ Questionário concluído! Muito obrigado pelas respostas. "
            "Suas informações foram registradas para a equipe médica."
        )

        if alerts:
            high_count = sum(1 for a in alerts if a.get("severity") in ("HIGH", "CRITICAL"))
            if high_count > 0:
                base += (
                    "\n\nPercebi que você relatou alguns sintomas que merecem atenção. "
                    "Vou notificar a equipe de enfermagem para que entrem em contato com você em breve."
                )
        else:
            base += "\n\nTudo parece bem controlado. Continue assim! 💪"

        base += "\n\nSe precisar de algo antes do próximo check-in, pode me chamar aqui."
        return base

    def should_skip_item(
        self, item: str, questionnaire_type: str, answers: Dict[str, Any]
    ) -> bool:
        """
        Determine if a questionnaire item should be skipped.
        E.g., skip 'interference' questions if severity = 0.
        """
        if questionnaire_type == "PRO_CTCAE":
            severity_key = f"{item}_severity"
            if severity_key in answers and answers[severity_key] == 0:
                return True  # Skip interference if no symptom
        return False


# Global instance
questionnaire_engine = QuestionnaireEngine()
