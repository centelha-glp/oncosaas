"""
Advanced Symptom Analyzer.
Combines keyword-based detection with LLM-powered analysis.
"""

import re
from typing import Dict, List, Optional, Any
import logging

from .llm_provider import llm_provider
from .prompts.symptom_prompts import SYMPTOM_ANALYSIS_PROMPT, SYMPTOM_ANALYSIS_TOOLS

logger = logging.getLogger(__name__)


# Extended keyword-based critical symptom detection
CRITICAL_KEYWORDS: Dict[str, Dict[str, Any]] = {
    "febre_neutropenica": {
        "keywords": [
            "febre", "febril", "temperatura alta", "calafrio", "calafrios",
            "38 graus", "39 graus", "40 graus",
        ],
        "severity": "CRITICAL",
        "action": "ESCALATE_IMMEDIATELY",
        "requires_treatment_context": True,  # More critical if on chemo
    },
    "dispneia": {
        "keywords": [
            "falta de ar", "não consigo respirar", "sufocando", "dispneia",
            "dificuldade para respirar", "respiração difícil", "ofegante",
        ],
        "severity": "CRITICAL",
        "action": "ESCALATE_IMMEDIATELY",
    },
    "sangramento": {
        "keywords": [
            "sangrando", "sangue", "hemorragia", "sangramento",
            "sangue nas fezes", "sangue na urina", "hematúria",
            "sangramento retal", "vomitando sangue",
        ],
        "severity": "CRITICAL",
        "action": "ESCALATE_IMMEDIATELY",
    },
    "dor_intensa": {
        "keywords": [
            "dor muito forte", "dor insuportável", "dor 10",
            "dor 9", "dor 8", "dor intensa", "não aguento de dor",
        ],
        "severity": "HIGH",
        "action": "ALERT_NURSING",
    },
    "vomito_incoercivel": {
        "keywords": [
            "vomitando muito", "não paro de vomitar", "vomitando o dia todo",
            "vômitos incessantes", "vômito persistente",
        ],
        "severity": "CRITICAL",
        "action": "ESCALATE_IMMEDIATELY",
    },
    "obstrucao_intestinal": {
        "keywords": [
            "obstrução intestinal", "barriga inchada", "não consigo evacuar",
            "distensão abdominal", "parei de evacuar",
        ],
        "severity": "CRITICAL",
        "action": "ESCALATE_IMMEDIATELY",
    },
    "confusao_mental": {
        "keywords": [
            "confuso", "confusão", "desorientado", "não sabe onde está",
            "alteração de consciência", "sonolento demais",
        ],
        "severity": "CRITICAL",
        "action": "ESCALATE_IMMEDIATELY",
    },
    "diarreia_severa": {
        "keywords": [
            "diarreia severa", "diarreia intensa", "mais de 6 vezes",
            "diarreia o dia todo", "desidratado",
        ],
        "severity": "HIGH",
        "action": "ALERT_NURSING",
    },
    "mucosite": {
        "keywords": [
            "mucosite", "feridas na boca", "não consigo comer",
            "boca toda machucada", "aftas severas",
        ],
        "severity": "HIGH",
        "action": "ALERT_NURSING",
    },
    "neuropatia": {
        "keywords": [
            "neuropatia", "formigamento", "dormência",
            "mãos dormentes", "pés dormentes", "perda de sensibilidade",
        ],
        "severity": "MEDIUM",
        "action": "RECORD_AND_MONITOR",
    },
    "fadiga": {
        "keywords": [
            "cansaço extremo", "fadiga intensa", "sem energia",
            "exausto", "não consigo levantar",
        ],
        "severity": "MEDIUM",
        "action": "RECORD_AND_MONITOR",
    },
    "nausea": {
        "keywords": [
            "náusea", "enjoo", "mal estar", "ânsia",
        ],
        "severity": "MEDIUM",
        "action": "RECORD_AND_MONITOR",
    },
    "dor": {
        "keywords": [
            "dor", "doendo", "dói", "dores", "sentindo dor",
            "estou com dor", "tenho dor", "com dor",
        ],
        "severity": "MEDIUM",
        "action": "RECORD_AND_MONITOR",
    },
    "cansaco": {
        "keywords": [
            "cansaço", "cansado", "cansaça", "cansada",
            "sem energia", "sem disposição",
        ],
        "severity": "MEDIUM",
        "action": "RECORD_AND_MONITOR",
    },
}

# Cancer-type-specific critical symptoms
CANCER_SPECIFIC_SYMPTOMS: Dict[str, List[Dict[str, Any]]] = {
    "colorectal": [
        {"keyword": "sangramento retal", "severity": "CRITICAL", "action": "ESCALATE_IMMEDIATELY"},
        {"keyword": "obstrução intestinal", "severity": "CRITICAL", "action": "ESCALATE_IMMEDIATELY"},
    ],
    "bladder": [
        {"keyword": "hematúria intensa", "severity": "CRITICAL", "action": "ESCALATE_IMMEDIATELY"},
        {"keyword": "retenção urinária", "severity": "CRITICAL", "action": "ESCALATE_IMMEDIATELY"},
    ],
    "renal": [
        {"keyword": "hematúria macroscópica", "severity": "CRITICAL", "action": "ESCALATE_IMMEDIATELY"},
        {"keyword": "dor lombar intensa", "severity": "CRITICAL", "action": "ESCALATE_IMMEDIATELY"},
    ],
    "prostate": [
        {"keyword": "retenção urinária aguda", "severity": "CRITICAL", "action": "ESCALATE_IMMEDIATELY"},
        {"keyword": "compressão medular", "severity": "CRITICAL", "action": "ESCALATE_IMMEDIATELY"},
    ],
}


class SymptomAnalyzer:
    """
    Advanced symptom analyzer combining keyword detection with optional LLM analysis.
    """

    async def analyze(
        self,
        message: str,
        clinical_context: Optional[Dict[str, Any]] = None,
        cancer_type: Optional[str] = None,
        use_llm: bool = True,
        llm_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Analyze a patient message for symptoms.

        Args:
            message: Patient message text
            clinical_context: Patient clinical context
            cancer_type: Cancer type for type-specific detection
            use_llm: Whether to use LLM for advanced analysis
            llm_config: LLM configuration

        Returns:
            Dict with detected symptoms, severity, and escalation info
        """
        # 1. Keyword-based detection (fast, always runs)
        keyword_results = self._keyword_detection(message, cancer_type, clinical_context)

        # 2. Extract structured data (pain scores, etc.)
        structured_data = self._extract_structured_data(message)

        # 3. Optional LLM-based analysis for more nuanced detection
        llm_results = None
        if use_llm and llm_config:
            llm_results = await self._llm_analysis(message, clinical_context, llm_config)

        # 4. Merge results
        detected_symptoms = keyword_results["symptoms"]

        if llm_results and llm_results.get("symptoms"):
            detected_symptoms = self._merge_symptoms(
                detected_symptoms, llm_results["symptoms"]
            )

        # 4b. Add fever when temperature >= 38°C from structured_data (e.g. user said "38")
        temp = structured_data.get("scales", {}).get("temperature")
        if temp is not None and float(temp) >= 38.0:
            has_fever = any(
                s.get("name", "").lower() in ("febre", "febre neutropênica")
                for s in detected_symptoms
            )
            if not has_fever:
                detected_symptoms.append({
                    "name": "febre",
                    "severity": "HIGH",
                    "confidence": 0.9,
                    "action": "ESCALATE_IMMEDIATELY",
                    "detectedBy": "structured_temperature",
                })

        # 4c. Add pain with HIGH severity when score >= 7 from structured_data (e.g. user said "8")
        pain_score = structured_data.get("scales", {}).get("pain")
        if pain_score is not None and int(pain_score) >= 7:
            has_high_pain = any(
                s.get("name", "").lower() in ("dor", "dor_intensa", "pain")
                and s.get("severity") in ("HIGH", "CRITICAL")
                for s in detected_symptoms
            )
            if not has_high_pain:
                detected_symptoms.append({
                    "name": "dor",
                    "severity": "HIGH",
                    "confidence": 0.9,
                    "action": "ALERT_NURSING",
                    "detectedBy": "structured_pain_scale",
                    "score": int(pain_score),
                })

        # 5. Determine overall severity
        overall_severity = self._calculate_overall_severity(detected_symptoms)
        requires_escalation = overall_severity in ("CRITICAL",) or any(
            s.get("action") == "ESCALATE_IMMEDIATELY" for s in detected_symptoms
        )

        return {
            "detectedSymptoms": detected_symptoms,
            "overallSeverity": overall_severity,
            "requiresEscalation": requires_escalation,
            "structuredData": structured_data,
            "escalationReason": (
                llm_results.get("escalation_reason")
                if llm_results
                else (
                    f"Sintoma crítico detectado: {detected_symptoms[0].get('name')}"
                    if requires_escalation and detected_symptoms
                    else None
                )
            ),
        }

    def _keyword_detection(
        self,
        message: str,
        cancer_type: Optional[str] = None,
        clinical_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Keyword-based symptom detection."""
        message_lower = message.lower()
        symptoms = []

        # General symptoms
        for symptom_key, config in CRITICAL_KEYWORDS.items():
            matched = any(kw in message_lower for kw in config["keywords"])
            if not matched:
                continue

            severity = config["severity"]

            # Context-aware severity adjustment
            if config.get("requires_treatment_context") and clinical_context:
                treatments = clinical_context.get("treatments", [])
                in_chemo = any(
                    t.get("treatmentType") in ("CHEMOTHERAPY", "COMBINED")
                    and t.get("isActive")
                    for t in treatments
                )
                if in_chemo and symptom_key == "febre_neutropenica":
                    severity = "CRITICAL"

            symptoms.append({
                "name": symptom_key,
                "severity": severity,
                "confidence": 0.85,
                "action": config["action"],
                "detectedBy": "keyword",
            })

        # Cancer-type-specific symptoms
        if cancer_type:
            specific = CANCER_SPECIFIC_SYMPTOMS.get(cancer_type.lower(), [])
            for spec in specific:
                if spec["keyword"].lower() in message_lower:
                    symptoms.append({
                        "name": spec["keyword"],
                        "severity": spec["severity"],
                        "confidence": 0.9,
                        "action": spec["action"],
                        "detectedBy": "cancer_specific_keyword",
                    })

        return {"symptoms": symptoms}

    def _extract_structured_data(self, message: str) -> Dict[str, Any]:
        """Extract structured data from message (pain scores, etc.)."""
        data: Dict[str, Any] = {"symptoms": {}, "scales": {}}

        # Pain score (0-10)
        pain_patterns = [
            r"dor[^\d]*(\d+)\s*/?\s*10",
            r"dor[^\d]*(\d+)\s+de\s+10",
            r"nivel\s+de\s+dor[^\d]*(\d+)",
            r"escala\s+de\s+dor[^\d]*(\d+)",
            r"^(\d{1,2})\s*$",  # Standalone 0-10 (reply to "qual nota para sua dor?")
            r"^(\d{1,2})\s*/\s*10\s*$",  # "7/10", "8/10"
            r"uns?\s*(\d{1,2})",  # "uns 7", "um 8"
        ]
        for pattern in pain_patterns:
            match = re.search(pattern, message.lower().strip())
            if match:
                score = int(match.group(1))
                if 0 <= score <= 10:
                    data["scales"]["pain"] = score
                    data["symptoms"]["pain"] = score
                break

        # Temperature
        temp_patterns = [
            r"(\d{2}[.,]\d)\s*°?\s*[cC]",
            r"febre\s+de\s+(\d{2}[.,]\d)",
            r"temperatura\s+(\d{2}[.,]\d)",
            r"^(\d{2})\s*$",  # Standalone number: "38", "39" (common after "qual sua temperatura?")
            r"^(\d{2}[.,]\d)\s*$",  # Standalone decimal: "38,5"
        ]
        for pattern in temp_patterns:
            match = re.search(pattern, message.strip())
            if match:
                temp = float(match.group(1).replace(",", "."))
                if 35.0 <= temp <= 42.0:
                    data["scales"]["temperature"] = temp
                break

        # Nausea score
        nausea_patterns = [
            r"n[áa]usea[^\d]*(\d+)\s*/?\s*10",
            r"enjoo[^\d]*(\d+)\s*/?\s*10",
        ]
        for pattern in nausea_patterns:
            match = re.search(pattern, message.lower())
            if match:
                score = int(match.group(1))
                if 0 <= score <= 10:
                    data["scales"]["nausea"] = score
                break

        # Fatigue score
        fatigue_patterns = [
            r"cansa[çc]o[^\d]*(\d+)\s*/?\s*10",
            r"fadiga[^\d]*(\d+)\s*/?\s*10",
        ]
        for pattern in fatigue_patterns:
            match = re.search(pattern, message.lower())
            if match:
                score = int(match.group(1))
                if 0 <= score <= 10:
                    data["scales"]["fatigue"] = score
                break

        return data

    async def _llm_analysis(
        self,
        message: str,
        clinical_context: Optional[Dict[str, Any]],
        config: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Use LLM for advanced symptom analysis with tool use."""
        try:
            context_str = ""
            if clinical_context:
                patient = clinical_context.get("patient", {})
                context_str = (
                    f"\nContexto: {patient.get('cancerType', 'N/A')}, "
                    f"estágio {patient.get('stage', 'N/A')}, "
                    f"etapa {patient.get('currentStage', 'N/A')}"
                )

            result = await llm_provider.generate_with_tools(
                system_prompt=SYMPTOM_ANALYSIS_PROMPT + context_str,
                messages=[{"role": "user", "content": message}],
                tools=SYMPTOM_ANALYSIS_TOOLS,
                config=config,
            )

            # Extract tool call results
            for tc in result.get("tool_calls", []):
                if tc.get("name") == "analyze_symptoms":
                    return tc.get("input", {})

            return None
        except Exception as e:
            logger.error(f"LLM symptom analysis failed: {e}")
            return None

    def _merge_symptoms(
        self,
        keyword_symptoms: List[Dict],
        llm_symptoms: List[Dict],
    ) -> List[Dict]:
        """Merge keyword and LLM-detected symptoms, preferring higher severity."""
        merged = {s["name"]: s for s in keyword_symptoms}

        for s in llm_symptoms:
            name = s.get("name", "")
            if name in merged:
                # Keep the higher severity
                severity_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
                existing_sev = severity_order.get(merged[name].get("severity", "LOW"), 0)
                new_sev = severity_order.get(s.get("severity", "LOW"), 0)
                if new_sev > existing_sev:
                    merged[name]["severity"] = s["severity"]
                    merged[name]["confidence"] = max(
                        merged[name].get("confidence", 0),
                        s.get("confidence", 0),
                    )
            else:
                s["detectedBy"] = "llm"
                merged[name] = s

        return list(merged.values())

    @staticmethod
    def _calculate_overall_severity(symptoms: List[Dict]) -> str:
        """Calculate overall severity from detected symptoms."""
        if not symptoms:
            return "LOW"

        severity_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
        max_severity = max(
            severity_order.get(s.get("severity", "LOW"), 0) for s in symptoms
        )

        reverse = {v: k for k, v in severity_order.items()}
        return reverse.get(max_severity, "LOW")


# Global instance
symptom_analyzer = SymptomAnalyzer()
