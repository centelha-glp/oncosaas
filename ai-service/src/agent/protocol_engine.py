"""
Protocol Engine.
Evaluates clinical protocol rules and generates protocol-driven actions.
"""

from typing import Dict, List, Optional, Any
import logging
from datetime import datetime, date

logger = logging.getLogger(__name__)


# Protocol rule definitions per cancer type
# These mirror the NestJS clinical-protocols templates but in Python for AI-side evaluation
PROTOCOL_RULES: Dict[str, Dict[str, Any]] = {
    "colorectal": {
        "stages": {
            "SCREENING": {
                "check_in_frequency": "weekly",
                "questionnaire": None,
                "critical_symptoms": [
                    "sangramento retal",
                    "mudança nos hábitos intestinais",
                    "sangue nas fezes",
                ],
            },
            "DIAGNOSIS": {
                "check_in_frequency": "twice_weekly",
                "questionnaire": None,
                "critical_symptoms": [
                    "obstrução intestinal",
                    "dor abdominal intensa",
                    "sangramento retal",
                ],
            },
            "TREATMENT": {
                "check_in_frequency": "daily",
                "questionnaire": "ESAS",
                "critical_symptoms": [
                    "febre neutropênica",
                    "obstrução intestinal",
                    "diarreia severa",
                    "mucosite grave",
                    "sangramento retal",
                ],
            },
            "FOLLOW_UP": {
                "check_in_frequency": "weekly",
                "questionnaire": "PRO_CTCAE",
                "critical_symptoms": [
                    "sangramento retal",
                    "dor abdominal persistente",
                ],
            },
        },
        "check_in_triggers": {
            "missed_check_in": "ALERT_NURSING",
            "critical_symptom": "ESCALATE_IMMEDIATELY",
            "high_score": "ALERT_NURSING",
        },
    },
    "bladder": {
        "stages": {
            "SCREENING": {
                "check_in_frequency": "weekly",
                "questionnaire": None,
                "critical_symptoms": ["hematúria", "sangue na urina", "dor ao urinar"],
            },
            "DIAGNOSIS": {
                "check_in_frequency": "twice_weekly",
                "questionnaire": None,
                "critical_symptoms": ["retenção urinária", "hematúria intensa"],
            },
            "TREATMENT": {
                "check_in_frequency": "daily",
                "questionnaire": "ESAS",
                "critical_symptoms": [
                    "hematúria intensa",
                    "retenção urinária",
                    "febre neutropênica",
                    "cistite grave",
                ],
            },
            "FOLLOW_UP": {
                "check_in_frequency": "weekly",
                "questionnaire": "PRO_CTCAE",
                "critical_symptoms": ["hematúria recorrente", "dor pélvica"],
            },
        },
        "check_in_triggers": {
            "missed_check_in": "ALERT_NURSING",
            "critical_symptom": "ESCALATE_IMMEDIATELY",
            "high_score": "ALERT_NURSING",
        },
    },
    "renal": {
        "stages": {
            "SCREENING": {
                "check_in_frequency": "weekly",
                "questionnaire": None,
                "critical_symptoms": ["hematúria", "dor lombar"],
            },
            "DIAGNOSIS": {
                "check_in_frequency": "twice_weekly",
                "questionnaire": None,
                "critical_symptoms": ["hematúria macroscópica", "dor lombar intensa"],
            },
            "TREATMENT": {
                "check_in_frequency": "daily",
                "questionnaire": "ESAS",
                "critical_symptoms": [
                    "hematúria macroscópica",
                    "hipertensão severa",
                    "síndrome mão-pé grau 3",
                    "febre neutropênica",
                    "trombose",
                ],
            },
            "FOLLOW_UP": {
                "check_in_frequency": "weekly",
                "questionnaire": "PRO_CTCAE",
                "critical_symptoms": ["hematúria recorrente", "dor lombar persistente"],
            },
        },
        "check_in_triggers": {
            "missed_check_in": "ALERT_NURSING",
            "critical_symptom": "ESCALATE_IMMEDIATELY",
            "high_score": "ALERT_NURSING",
        },
    },
    "prostate": {
        "stages": {
            "SCREENING": {
                "check_in_frequency": "weekly",
                "questionnaire": None,
                "critical_symptoms": [
                    "dificuldade urinária grave",
                    "hematúria",
                    "dor óssea intensa",
                ],
            },
            "DIAGNOSIS": {
                "check_in_frequency": "twice_weekly",
                "questionnaire": None,
                "critical_symptoms": [
                    "retenção urinária aguda",
                    "compressão medular",
                ],
            },
            "TREATMENT": {
                "check_in_frequency": "daily",
                "questionnaire": "ESAS",
                "critical_symptoms": [
                    "compressão medular",
                    "retenção urinária aguda",
                    "embolia pulmonar",
                    "dor óssea intensa",
                    "ginecomastia dolorosa",
                ],
            },
            "FOLLOW_UP": {
                "check_in_frequency": "weekly",
                "questionnaire": "PRO_CTCAE",
                "critical_symptoms": [
                    "dor óssea progressiva",
                    "dificuldade urinária grave",
                ],
            },
        },
        "check_in_triggers": {
            "missed_check_in": "ALERT_NURSING",
            "critical_symptom": "ESCALATE_IMMEDIATELY",
            "high_score": "ALERT_NURSING",
        },
    },
}

# ESAS score thresholds for alerts
ESAS_ALERT_THRESHOLD = 7   # Score >= 7 on any item → alert nursing
ESAS_TOTAL_ALERT = 50      # Total ESAS score >= 50 → alert nursing

# PRO-CTCAE grade thresholds
PRO_CTCAE_ALERT_GRADE = 3  # Grade >= 3 → alert nursing


class ProtocolEngine:
    """
    Evaluates clinical protocol rules for a patient's cancer type and journey stage.
    Generates protocol-driven actions (check-in schedules, questionnaire triggers, escalations).
    """

    def evaluate(
        self,
        cancer_type: Optional[str],
        journey_stage: Optional[str],
        symptom_analysis: Optional[Dict[str, Any]] = None,
        agent_state: Optional[Dict[str, Any]] = None,
        protocol: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Evaluate protocol rules and return list of protocol-driven actions.

        Args:
            cancer_type: Type of cancer (colorectal, bladder, renal, prostate)
            journey_stage: Current stage (SCREENING, DIAGNOSIS, TREATMENT, FOLLOW_UP)
            symptom_analysis: Result from symptom analyzer
            agent_state: Current agent state (for tracking last check-in, etc.)
            protocol: Optional custom protocol from database

        Returns:
            List of protocol actions to execute
        """
        actions = []

        # Use custom protocol if provided, otherwise fall back to built-in rules
        rules = self._get_rules(cancer_type, protocol)
        if not rules:
            return actions

        stage_rules = rules.get("stages", {}).get(
            journey_stage or "TREATMENT", {}
        )

        # 1. Check if questionnaire should be triggered
        questionnaire_action = self._check_questionnaire_trigger(
            stage_rules, agent_state
        )
        if questionnaire_action:
            actions.append(questionnaire_action)

        # 2. Evaluate symptom analysis against protocol critical symptoms
        if symptom_analysis:
            symptom_actions = self._evaluate_symptom_protocol(
                stage_rules, symptom_analysis, cancer_type
            )
            actions.extend(symptom_actions)

        # 3. Check if check-in should be scheduled
        check_in_action = self._check_next_checkin(stage_rules, agent_state)
        if check_in_action:
            actions.append(check_in_action)

        # 4. Evaluate ESAS scores if available
        if agent_state and agent_state.get("last_esas_scores"):
            score_actions = self._evaluate_esas_scores(agent_state["last_esas_scores"])
            actions.extend(score_actions)

        logger.debug(
            f"Protocol evaluation for {cancer_type}/{journey_stage}: {len(actions)} actions"
        )
        return actions

    def _get_rules(
        self,
        cancer_type: Optional[str],
        protocol: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Get protocol rules, preferring DB protocol over built-in."""
        if protocol and protocol.get("checkInRules"):
            # Convert DB protocol format to internal format
            return self._convert_db_protocol(protocol)

        if cancer_type:
            return PROTOCOL_RULES.get(cancer_type.lower())

        return None

    def _convert_db_protocol(self, protocol: Dict[str, Any]) -> Dict[str, Any]:
        """Convert database protocol format to internal rule format."""
        check_in_rules = protocol.get("checkInRules", {})
        stages = {}

        for stage, rules in check_in_rules.items():
            stages[stage] = {
                "check_in_frequency": rules.get("frequency", "weekly"),
                "questionnaire": rules.get("questionnaire"),
                "critical_symptoms": rules.get("criticalSymptoms", []),
            }

        return {
            "stages": stages,
            "check_in_triggers": {
                "missed_check_in": "ALERT_NURSING",
                "critical_symptom": "ESCALATE_IMMEDIATELY",
                "high_score": "ALERT_NURSING",
            },
        }

    def _check_questionnaire_trigger(
        self,
        stage_rules: Dict[str, Any],
        agent_state: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Check if a questionnaire should be triggered based on schedule."""
        questionnaire_type = stage_rules.get("questionnaire")
        if not questionnaire_type:
            return None

        # Check if questionnaire is already active
        if agent_state and agent_state.get("active_questionnaire"):
            return None

        # Check if questionnaire was recently completed (within frequency window)
        if agent_state:
            last_questionnaire = agent_state.get("last_questionnaire_at")
            frequency = stage_rules.get("check_in_frequency", "weekly")

            if last_questionnaire and not self._is_questionnaire_due(
                last_questionnaire, frequency
            ):
                return None

        return {
            "type": "START_QUESTIONNAIRE",
            "questionnaire_type": questionnaire_type,
            "priority": "MEDIUM",
            "reason": f"Questionário {questionnaire_type} programado para etapa atual",
        }

    def _is_questionnaire_due(self, last_at: str, frequency: str) -> bool:
        """Check if questionnaire is due based on frequency."""
        try:
            last_date = datetime.fromisoformat(last_at).date()
            today = date.today()
            days_since = (today - last_date).days

            frequency_days = {
                "daily": 1,
                "twice_weekly": 3,
                "weekly": 7,
                "biweekly": 14,
                "monthly": 30,
            }

            required_days = frequency_days.get(frequency, 7)
            return days_since >= required_days
        except (ValueError, TypeError):
            return True  # If we can't parse, assume it's due

    def _evaluate_symptom_protocol(
        self,
        stage_rules: Dict[str, Any],
        symptom_analysis: Dict[str, Any],
        cancer_type: Optional[str],
    ) -> List[Dict[str, Any]]:
        """Evaluate symptoms against protocol critical symptom list."""
        actions = []
        critical_symptoms = stage_rules.get("critical_symptoms", [])
        detected = symptom_analysis.get("detectedSymptoms", [])

        for symptom in detected:
            symptom_name = symptom.get("name", "").lower()

            # Check if this symptom is in the protocol's critical list
            for critical in critical_symptoms:
                if critical.lower() in symptom_name or symptom_name in critical.lower():
                    if symptom.get("severity") in ("CRITICAL", "HIGH"):
                        actions.append({
                            "type": "PROTOCOL_ALERT",
                            "priority": "HIGH",
                            "symptom": symptom_name,
                            "protocol_critical": critical,
                            "cancer_type": cancer_type,
                            "reason": f"Sintoma crítico do protocolo {cancer_type}: {critical}",
                        })
                    break

        return actions

    def _check_next_checkin(
        self,
        stage_rules: Dict[str, Any],
        agent_state: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Determine if a check-in should be scheduled."""
        if not agent_state:
            return None

        frequency = stage_rules.get("check_in_frequency", "weekly")
        last_check_in = agent_state.get("last_check_in_at")

        if last_check_in and not self._is_questionnaire_due(last_check_in, frequency):
            return None

        # Only schedule if there's no pending check-in already
        if agent_state.get("pending_check_in"):
            return None

        frequency_display = {
            "daily": "diário",
            "twice_weekly": "2x por semana",
            "weekly": "semanal",
            "biweekly": "quinzenal",
            "monthly": "mensal",
        }.get(frequency, frequency)

        return {
            "type": "SCHEDULE_CHECK_IN",
            "frequency": frequency,
            "priority": "LOW",
            "reason": f"Check-in {frequency_display} programado pelo protocolo",
        }

    def _evaluate_esas_scores(
        self, scores: Dict[str, int]
    ) -> List[Dict[str, Any]]:
        """Evaluate ESAS scores and generate alerts for high scores."""
        actions = []

        # Check individual scores
        for item, score in scores.items():
            if score >= ESAS_ALERT_THRESHOLD:
                actions.append({
                    "type": "HIGH_ESAS_SCORE",
                    "priority": "HIGH",
                    "item": item,
                    "score": score,
                    "threshold": ESAS_ALERT_THRESHOLD,
                    "reason": f"ESAS {item} = {score}/10 (acima do limiar {ESAS_ALERT_THRESHOLD})",
                })

        # Check total score
        total = sum(scores.values())
        if total >= ESAS_TOTAL_ALERT:
            actions.append({
                "type": "HIGH_ESAS_TOTAL",
                "priority": "HIGH",
                "total_score": total,
                "threshold": ESAS_TOTAL_ALERT,
                "reason": f"ESAS total = {total} (acima do limiar {ESAS_TOTAL_ALERT})",
            })

        return actions

    def get_stage_info(
        self, cancer_type: str, journey_stage: str
    ) -> Optional[Dict[str, Any]]:
        """Get protocol rules for a specific cancer type and stage."""
        rules = PROTOCOL_RULES.get(cancer_type.lower())
        if not rules:
            return None
        return rules.get("stages", {}).get(journey_stage)

    def get_required_questionnaire(
        self, cancer_type: str, journey_stage: str
    ) -> Optional[str]:
        """Get the required questionnaire type for a cancer type and stage."""
        stage_info = self.get_stage_info(cancer_type, journey_stage)
        if stage_info:
            return stage_info.get("questionnaire")
        return None


# Global instance
protocol_engine = ProtocolEngine()
