"""
Agent Orchestrator.
Main processing pipeline for the oncology navigation agent.
Receives message + context → returns response + actions.
"""

from typing import Dict, List, Optional, Any
import logging

from .llm_provider import llm_provider
from .context_builder import context_builder
from .symptom_analyzer import symptom_analyzer
from .protocol_engine import protocol_engine
from .questionnaire_engine import questionnaire_engine
from .prompts.system_prompt import build_system_prompt

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """
    Orquestrador principal do agente de navegação oncológica.
    Recebe mensagem + contexto → retorna resposta + ações.
    """

    async def process(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main processing pipeline.

        Args:
            request: Dict containing:
                - message: Patient message
                - patient_id: Patient UUID
                - tenant_id: Tenant UUID
                - clinical_context: Full clinical data
                - protocol: Active clinical protocol
                - conversation_history: Recent messages
                - agent_state: Persistent state
                - agent_config: Tenant LLM config

        Returns:
            Dict with response, actions, symptom_analysis, new_state, decisions
        """
        message = request.get("message", "")
        clinical_context = request.get("clinical_context", {})
        protocol = request.get("protocol")
        conversation_history = request.get("conversation_history", [])
        agent_state = request.get("agent_state", {})
        agent_config = request.get("agent_config") or {}

        # 1. Check if we're in a questionnaire flow
        if agent_state.get("active_questionnaire"):
            return await self._process_questionnaire_answer(request)

        # 2. Analyze symptoms (keyword-based, fast)
        cancer_type = clinical_context.get("patient", {}).get("cancerType")
        journey_stage = clinical_context.get("patient", {}).get("currentStage")
        symptom_analysis = await symptom_analyzer.analyze(
            message=message,
            clinical_context=clinical_context,
            cancer_type=cancer_type,
            use_llm=False,  # Keyword-only for speed; LLM analysis can be enabled per config
            llm_config=agent_config,
        )

        # 3. Evaluate protocol rules (check-ins, questionnaire triggers, critical symptoms)
        protocol_actions = protocol_engine.evaluate(
            cancer_type=cancer_type,
            journey_stage=journey_stage,
            symptom_analysis=symptom_analysis,
            agent_state=agent_state,
            protocol=protocol,
        )

        # 4. Build clinical context for the prompt (RAG)
        rag_context = context_builder.build(
            clinical_context=clinical_context,
            protocol=protocol,
            symptom_analysis=symptom_analysis,
            conversation_history=conversation_history,
        )

        # 5. Build protocol context string
        protocol_context = None
        if protocol:
            protocol_context = context_builder._format_protocol_context(protocol)

        # 6. Build system prompt
        language = agent_config.get("agent_language", "pt-BR")
        system_prompt = build_system_prompt(
            clinical_context=rag_context,
            protocol_context=protocol_context,
            language=language,
        )

        # 7. Generate response via LLM
        response_text = await llm_provider.generate(
            system_prompt=system_prompt,
            messages=conversation_history + [{"role": "user", "content": message}],
            config=agent_config,
        )

        # 8. Check if a questionnaire should start (from protocol actions)
        questionnaire_to_start = next(
            (a for a in protocol_actions if a.get("type") == "START_QUESTIONNAIRE"),
            None,
        )
        if questionnaire_to_start:
            q_type = questionnaire_to_start.get("questionnaire_type", "ESAS")
            patient_name = clinical_context.get("patient", {}).get("name")
            greeting = questionnaire_engine.format_greeting(q_type, patient_name)
            q_state = questionnaire_engine.build_initial_state(q_type)
            first_question = questionnaire_engine.get_current_question(q_state)
            response_text = f"{greeting}\n\n{first_question}" if first_question else greeting

        # 9. Compile actions based on symptom analysis + protocol actions
        actions, decisions = self._compile_actions(
            symptom_analysis=symptom_analysis,
            agent_state=agent_state,
            clinical_context=clinical_context,
            protocol_actions=protocol_actions,
            questionnaire_to_start=questionnaire_to_start,
        )

        # 10. Update agent state
        new_state = self._update_state(
            agent_state, symptom_analysis, message,
            questionnaire_state=questionnaire_engine.build_initial_state(
                questionnaire_to_start["questionnaire_type"]
            ) if questionnaire_to_start else None,
        )

        return {
            "response": response_text,
            "actions": actions,
            "symptom_analysis": symptom_analysis,
            "new_state": new_state,
            "decisions": decisions,
        }

    async def _process_questionnaire_answer(
        self, request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle a message that's part of an active questionnaire flow."""
        agent_state = request.get("agent_state", {})
        agent_config = request.get("agent_config") or {}
        message = request.get("message", "")
        questionnaire_progress = agent_state.get("active_questionnaire", {})

        use_llm = bool(agent_config.get("anthropic_api_key") or agent_config.get("openai_api_key"))

        is_complete, updated_progress, next_content = await questionnaire_engine.process_answer(
            answer_text=message,
            questionnaire_state=questionnaire_progress,
            use_llm=use_llm,
            llm_config=agent_config,
        )

        new_state = dict(agent_state)
        actions = []
        decisions = []

        if is_complete:
            # Score the questionnaire
            q_type = questionnaire_progress.get("type", "ESAS")
            answers = updated_progress.get("answers", {})
            scores = questionnaire_engine.score_responses(q_type, answers)

            # Clear active questionnaire from state
            new_state.pop("active_questionnaire", None)
            new_state["last_questionnaire_at"] = None  # Will be set by backend
            new_state[f"last_{q_type.lower()}_scores"] = scores.get("items") or scores.get("grades")

            # Generate alerts for high scores
            for alert in scores.get("alerts", []):
                severity = alert.get("severity", "HIGH")
                actions.append({
                    "type": "CREATE_LOW_ALERT" if severity == "HIGH" else "CREATE_HIGH_CRITICAL_ALERT",
                    "payload": {
                        "type": "QUESTIONNAIRE_ALERT",
                        "severity": severity,
                        "message": (
                            f"Score alto no questionário {q_type}: "
                            f"{alert.get('item', '')} = {alert.get('score') or alert.get('grade', '')}"
                        ),
                    },
                    "requiresApproval": severity == "CRITICAL",
                })

            # Record questionnaire completion
            actions.append({
                "type": "QUESTIONNAIRE_COMPLETE",
                "payload": {
                    "questionnaireType": q_type,
                    "answers": answers,
                    "scores": scores,
                },
                "requiresApproval": False,
            })

            decisions.append({
                "decisionType": "QUESTIONNAIRE_SCORED",
                "reasoning": f"Questionário {q_type} concluído. {scores.get('interpretation', '')}",
                "confidence": 0.95,
                "inputData": {"answers": answers},
                "outputAction": {"type": "QUESTIONNAIRE_COMPLETE", "payload": scores},
                "requiresApproval": False,
            })

            response = next_content or "Questionário concluído. Obrigado!"
        else:
            # Questionnaire still in progress — store updated progress
            new_state["active_questionnaire"] = updated_progress
            response = next_content or "Por favor, responda a pergunta anterior."

            decisions.append({
                "decisionType": "QUESTIONNAIRE_SCORED",
                "reasoning": f"Resposta registrada para {questionnaire_progress.get('type', 'unknown')}",
                "confidence": 0.8,
                "inputData": {"message": message},
                "outputAction": {"type": "CONTINUE_QUESTIONNAIRE"},
                "requiresApproval": False,
            })

        return {
            "response": response,
            "actions": actions,
            "symptom_analysis": None,
            "new_state": new_state,
            "decisions": decisions,
        }

    def _compile_actions(
        self,
        symptom_analysis: Dict[str, Any],
        agent_state: Dict[str, Any],
        clinical_context: Dict[str, Any],
        protocol_actions: Optional[List[Dict[str, Any]]] = None,
        questionnaire_to_start: Optional[Dict[str, Any]] = None,
    ) -> tuple:
        """
        Compile actions and decisions based on analysis results.

        Returns:
            Tuple of (actions list, decisions list)
        """
        actions = []
        decisions = []

        detected = symptom_analysis.get("detectedSymptoms", [])
        overall_severity = symptom_analysis.get("overallSeverity", "LOW")
        requires_escalation = symptom_analysis.get("requiresEscalation", False)

        # Record detected symptoms
        for symptom in detected:
            actions.append({
                "type": "RECORD_SYMPTOM",
                "payload": {
                    "code": f"symptom_{symptom['name']}",
                    "display": symptom["name"],
                    "value": symptom.get("severity"),
                },
                "requiresApproval": False,
            })

            decisions.append({
                "decisionType": "SYMPTOM_DETECTED",
                "reasoning": (
                    f"Detected symptom '{symptom['name']}' with "
                    f"severity {symptom.get('severity', 'UNKNOWN')} "
                    f"(confidence: {symptom.get('confidence', 0):.0%})"
                ),
                "confidence": symptom.get("confidence", 0.85),
                "inputData": {"symptom": symptom},
                "outputAction": {
                    "type": "RECORD_SYMPTOM",
                    "payload": {
                        "code": f"symptom_{symptom['name']}",
                        "display": symptom["name"],
                        "value": symptom.get("severity"),
                    },
                },
                "requiresApproval": False,
            })

        # Create alerts for significant symptoms
        if overall_severity in ("HIGH", "CRITICAL"):
            alert_severity = overall_severity
            alert_type = "CRITICAL_SYMPTOM" if alert_severity == "CRITICAL" else "SYMPTOM_WORSENING"

            symptom_names = [s["name"] for s in detected]
            alert_message = (
                f"Sintomas detectados pelo agente: {', '.join(symptom_names)} "
                f"(severidade: {alert_severity})"
            )

            if requires_escalation:
                # Critical alert - auto-approved but logged
                actions.append({
                    "type": "CREATE_LOW_ALERT" if alert_severity == "HIGH" else "CREATE_HIGH_CRITICAL_ALERT",
                    "payload": {
                        "type": alert_type,
                        "severity": alert_severity,
                        "message": alert_message,
                    },
                    "requiresApproval": alert_severity == "CRITICAL",
                })

                decisions.append({
                    "decisionType": "CRITICAL_ESCALATION" if requires_escalation else "ALERT_CREATED",
                    "reasoning": symptom_analysis.get("escalationReason", alert_message),
                    "confidence": 0.9,
                    "inputData": {"symptoms": detected, "severity": alert_severity},
                    "outputAction": {
                        "type": "CREATE_HIGH_CRITICAL_ALERT",
                        "payload": {
                            "type": alert_type,
                            "severity": alert_severity,
                            "message": alert_message,
                        },
                    },
                    "requiresApproval": True,
                })
            else:
                actions.append({
                    "type": "CREATE_LOW_ALERT",
                    "payload": {
                        "type": alert_type,
                        "severity": alert_severity,
                        "message": alert_message,
                    },
                    "requiresApproval": False,
                })

                decisions.append({
                    "decisionType": "ALERT_CREATED",
                    "reasoning": alert_message,
                    "confidence": 0.85,
                    "inputData": {"symptoms": detected},
                    "outputAction": {
                        "type": "CREATE_LOW_ALERT",
                        "payload": {
                            "type": alert_type,
                            "severity": alert_severity,
                            "message": alert_message,
                        },
                    },
                    "requiresApproval": False,
                })

        # Protocol-driven actions
        if protocol_actions:
            for pa in protocol_actions:
                pa_type = pa.get("type")

                if pa_type == "SCHEDULE_CHECK_IN":
                    actions.append({
                        "type": "SCHEDULE_CHECK_IN",
                        "payload": {"frequency": pa.get("frequency", "weekly")},
                        "requiresApproval": False,
                    })
                    decisions.append({
                        "decisionType": "CHECK_IN_SCHEDULED",
                        "reasoning": pa.get("reason", "Protocol check-in"),
                        "confidence": 0.9,
                        "inputData": {},
                        "outputAction": {"type": "SCHEDULE_CHECK_IN"},
                        "requiresApproval": False,
                    })

                elif pa_type == "PROTOCOL_ALERT":
                    severity = "HIGH"
                    actions.append({
                        "type": "CREATE_LOW_ALERT",
                        "payload": {
                            "type": "PROTOCOL_CRITICAL_SYMPTOM",
                            "severity": severity,
                            "message": pa.get("reason", "Sintoma crítico do protocolo detectado"),
                        },
                        "requiresApproval": False,
                    })
                    decisions.append({
                        "decisionType": "ALERT_CREATED",
                        "reasoning": pa.get("reason", "Protocol alert"),
                        "confidence": 0.85,
                        "inputData": {"protocol_action": pa},
                        "outputAction": {"type": "CREATE_LOW_ALERT"},
                        "requiresApproval": False,
                    })

                elif pa_type in ("HIGH_ESAS_SCORE", "HIGH_ESAS_TOTAL"):
                    severity = "HIGH"
                    actions.append({
                        "type": "CREATE_LOW_ALERT",
                        "payload": {
                            "type": "HIGH_ESAS_SCORE",
                            "severity": severity,
                            "message": pa.get("reason", "Score ESAS alto"),
                        },
                        "requiresApproval": False,
                    })

        # If questionnaire was triggered, add action
        if questionnaire_to_start:
            q_type = questionnaire_to_start.get("questionnaire_type", "ESAS")
            actions.append({
                "type": "START_QUESTIONNAIRE",
                "payload": {"questionnaireType": q_type},
                "requiresApproval": False,
            })
            decisions.append({
                "decisionType": "APPLY_QUESTIONNAIRE",
                "reasoning": questionnaire_to_start.get("reason", f"Questionário {q_type} agendado"),
                "confidence": 0.9,
                "inputData": {},
                "outputAction": {"type": "START_QUESTIONNAIRE", "payload": {"type": q_type}},
                "requiresApproval": False,
            })

        # Always log the response generation
        decisions.append({
            "decisionType": "RESPONSE_GENERATED",
            "reasoning": "Agent generated response to patient message",
            "confidence": 0.95,
            "inputData": {},
            "outputAction": {"type": "RESPOND_TO_QUESTION"},
            "requiresApproval": False,
        })

        return actions, decisions

    def _update_state(
        self,
        current_state: Dict[str, Any],
        symptom_analysis: Dict[str, Any],
        message: str,
        questionnaire_state: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Update agent state with new information."""
        new_state = dict(current_state)

        # Store questionnaire state if a new questionnaire is starting
        if questionnaire_state:
            new_state["active_questionnaire"] = questionnaire_state

        # Track message count
        new_state["message_count"] = new_state.get("message_count", 0) + 1

        # Store latest symptom analysis summary
        detected = symptom_analysis.get("detectedSymptoms", [])
        if detected:
            new_state["last_symptoms"] = [
                {"name": s["name"], "severity": s.get("severity")}
                for s in detected
            ]
            new_state["last_symptom_severity"] = symptom_analysis.get(
                "overallSeverity", "LOW"
            )

        # Store extracted scales
        structured = symptom_analysis.get("structuredData", {})
        scales = structured.get("scales", {})
        if scales:
            existing_scales = new_state.get("tracked_scales", {})
            existing_scales.update(scales)
            new_state["tracked_scales"] = existing_scales

        return new_state


# Global instance
orchestrator = AgentOrchestrator()
