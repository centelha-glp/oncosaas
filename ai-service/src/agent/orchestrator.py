import json
import time
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from .llm_provider import llm_provider
from .context_builder import context_builder
from .symptom_analyzer import symptom_analyzer
from .protocol_engine import protocol_engine
from .questionnaire_engine import questionnaire_engine
from .intent_classifier import intent_classifier, INTENT_GREETING, INTENT_EMERGENCY, INTENT_APPOINTMENT_QUERY, INTENT_EMOTIONAL_SUPPORT
from .prompts.orchestrator_prompt import build_orchestrator_prompt, ORCHESTRATOR_ROUTING_TOOLS
from .subagents import SymptomAgent, NavigationAgent, QuestionnaireAgent, EmotionalSupportAgent
from .clinical_rules import clinical_rules_engine, ER_IMMEDIATE
from .tracer import tracer

"""
Agent Orchestrator.
Main processing pipeline for the oncology navigation agent.
Receives message + context → returns response + actions.
"""

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
        # Uma resolução por request — has_any_llm_key relê .env a cada chamada
        has_llm_keys = llm_provider.has_any_llm_key(agent_config)
        has_anthropic = llm_provider.has_anthropic_key(agent_config)

        patient_id = request.get("patient_id", "")
        tenant_id = request.get("tenant_id", "")
        trace = tracer.start_trace(patient_id, tenant_id)

        try:
            result = await self._process_with_trace(
                trace, message, clinical_context, protocol,
                conversation_history, agent_state, agent_config,
                has_llm_keys=has_llm_keys,
                has_anthropic=has_anthropic,
            )
        except Exception as exc:
            tracer.finish_trace(trace, error=str(exc))
            raise
        else:
            tracer.finish_trace(trace)
            return result

    async def _process_with_trace(
        self,
        trace,
        message: str,
        clinical_context: Dict[str, Any],
        protocol,
        conversation_history: List[Dict[str, str]],
        agent_state: Dict[str, Any],
        agent_config: Dict[str, Any],
        *,
        has_llm_keys: bool,
        has_anthropic: bool,
    ) -> Dict[str, Any]:
        """Inner implementation of process(), called with an active trace."""

        # 1. Check if we're in a questionnaire flow
        if agent_state.get("active_questionnaire"):
            trace.pipeline_path = "questionnaire"
            return await self._process_questionnaire_answer(
                {
                    "message": message,
                    "clinical_context": clinical_context,
                    "protocol": protocol,
                    "conversation_history": conversation_history,
                    "agent_state": agent_state,
                    "agent_config": agent_config,
                },
                has_llm_keys=has_llm_keys,
            )

        # 1.5. Classify intent for differentiated handling (with LLM fallback for ambiguous)
        span_intent = tracer.start_span(trace, "intent_classification")
        intent_result = await intent_classifier.classify_async(
            message, agent_state, agent_config
        )
        intent = intent_result["intent"]
        span_intent.finish(intent=intent, confidence=intent_result.get("confidence"))
        trace.intent = intent
        trace.intent_confidence = intent_result.get("confidence")
        logger.info(f"Intent classified: {intent} (confidence={intent_result['confidence']:.2f})")

        if intent == INTENT_EMERGENCY:
            emergency_meta = intent_result.get("metadata", {})
            if emergency_meta.get("escalate_immediately"):
                trace.pipeline_path = "emergency"
                # Run symptom analysis even for emergency path to register the symptom
                cancer_type = clinical_context.get("patient", {}).get("cancerType")
                use_llm_analysis = agent_config.get("use_llm_symptom_analysis", True) and has_llm_keys
                symptom_analysis = await symptom_analyzer.analyze(
                    message=message,
                    clinical_context=clinical_context,
                    cancer_type=cancer_type,
                    use_llm=use_llm_analysis,
                    llm_config=agent_config or {},
                )
                return self._build_emergency_response(
                    message, clinical_context, agent_state, symptom_analysis
                )

        if intent == INTENT_GREETING and intent_result.get("skip_full_pipeline"):
            trace.pipeline_path = "greeting"
            return self._build_greeting_response(clinical_context, agent_state)

        if intent == INTENT_APPOINTMENT_QUERY and intent_result.get("skip_full_pipeline"):
            trace.pipeline_path = "appointment_query"
            return self._build_appointment_response(clinical_context, agent_state)

        trace.pipeline_path = "main"

        # 2. Analyze symptoms (keyword + optional LLM for nuanced detection)
        cancer_type = clinical_context.get("patient", {}).get("cancerType")
        journey_stage = clinical_context.get("patient", {}).get("currentStage")
        logger.info(
            "LLM key check: has_any=%s has_anthropic=%s agent_config_keys=%s",
            has_llm_keys, has_anthropic,
            [k for k in (agent_config or {}).keys()],
        )
        use_llm_analysis = agent_config.get("use_llm_symptom_analysis", True) and has_llm_keys

        span_symptoms = tracer.start_span(trace, "symptom_analysis")
        symptom_analysis = await symptom_analyzer.analyze(
            message=message,
            clinical_context=clinical_context,
            cancer_type=cancer_type,
            use_llm=use_llm_analysis,
            llm_config=agent_config,
        )
        detected = symptom_analysis.get("detectedSymptoms", []) if isinstance(symptom_analysis, dict) else getattr(symptom_analysis, "detectedSymptoms", [])
        severity = symptom_analysis.get("overallSeverity") if isinstance(symptom_analysis, dict) else getattr(symptom_analysis, "overallSeverity", None)
        span_symptoms.finish(symptoms_count=len(detected), overall_severity=severity)
        trace.symptoms_detected = len(detected)
        trace.overall_severity = severity

        # 2.5. Layer 1: deterministic clinical rules (pre-ML, cannot be overridden)
        span_rules = tracer.start_span(trace, "clinical_rules")
        clinical_rules_result = clinical_rules_engine.evaluate(
            symptom_analysis=symptom_analysis,
            clinical_context=clinical_context,
        )
        rules_fired = [f.rule_id for f in clinical_rules_result.findings]
        span_rules.finish(disposition=clinical_rules_result.disposition, rules_fired=rules_fired)
        trace.clinical_disposition = clinical_rules_result.disposition
        trace.clinical_rules_fired = rules_fired
        if clinical_rules_result.is_immediate:
            logger.warning(
                f"ClinicalRules ER_IMMEDIATE: {clinical_rules_result.reasoning[:120]}"
            )
        elif clinical_rules_result.is_er:
            logger.info(
                f"ClinicalRules ER_DAYS: {clinical_rules_result.reasoning[:120]}"
            )

        # 3. Evaluate protocol rules (check-ins, questionnaire triggers, critical symptoms)
        span_protocol = tracer.start_span(trace, "protocol_evaluation")
        protocol_actions = protocol_engine.evaluate(
            cancer_type=cancer_type,
            journey_stage=journey_stage,
            symptom_analysis=symptom_analysis,
            agent_state=agent_state,
            protocol=protocol,
        )
        span_protocol.finish(actions_count=len(protocol_actions))

        # 4. Build clinical context for the prompt (RAG with knowledge retrieval)
        span_rag = tracer.start_span(trace, "rag_context_build")
        rag_context = context_builder.build_with_rag(
            patient_message=message,
            clinical_context=clinical_context,
            protocol=protocol,
            symptom_analysis=symptom_analysis,
            conversation_history=conversation_history,
            agent_state=agent_state,
        )
        span_rag.finish()

        # 5. Build protocol context string
        # 7. Multi-agent pipeline: orchestrator (Opus) routes to specialized subagents
        llm_actions = []
        llm_decisions = []

        intent_hint = ""
        if intent == INTENT_EMOTIONAL_SUPPORT:
            intent_hint = "\n[CONTEXTO: O paciente está em sofrimento emocional. Responda com empatia e acolhimento.]\n"
        elif intent_result.get("metadata", {}).get("emotional_component"):
            intent_hint = "\n[CONTEXTO: O paciente relata sintomas com componente emocional. Aborde ambos.]\n"

        final_message = f"{intent_hint}{message}" if intent_hint else message

        # Multi-agent pipeline: Anthropic preferred, OpenAI fallback (handled inside run_agentic_loop).
        if has_llm_keys:
            span_llm = tracer.start_span(trace, "multi_agent_pipeline")
            llm_start = time.monotonic()
            response_text, all_tool_calls, llm_meta = await self._run_multi_agent_pipeline(
                message=final_message,
                rag_context=rag_context,
                conversation_history=conversation_history,
                agent_config=agent_config,
                trace=trace,
            )
            llm_dur = (time.monotonic() - llm_start) * 1000
            span_llm.finish(tool_calls=len(all_tool_calls))
            tracer.record_llm_call(
                trace,
                "orchestrator",
                llm_meta.get("provider", "unknown"),
                llm_meta.get("model", agent_config.get("orchestrator_model", "")),
                llm_dur,
            )
            if all_tool_calls:
                llm_actions, llm_decisions = self._parse_tool_calls_to_actions(all_tool_calls)
                logger.info(
                    f"Multi-agent tool calls ({len(all_tool_calls)}): "
                    f"{[tc['name'] for tc in all_tool_calls]}"
                )
        else:
            response_text = llm_provider._fallback_response()

        # 8. Check if a questionnaire should start (from protocol or LLM tool calls)
        questionnaire_to_start = next(
            (a for a in protocol_actions if a.get("type") == "START_QUESTIONNAIRE"),
            None,
        )
        llm_questionnaire = next(
            (a for a in llm_actions if a.get("type") == "START_QUESTIONNAIRE"),
            None,
        )
        if not questionnaire_to_start and llm_questionnaire:
            questionnaire_to_start = {
                "type": "START_QUESTIONNAIRE",
                "questionnaire_type": llm_questionnaire.get("payload", {}).get("questionnaireType", "ESAS"),
                "reason": "LLM decided to start questionnaire",
            }

        if questionnaire_to_start:
            q_type = questionnaire_to_start.get("questionnaire_type", "ESAS")
            patient_name = clinical_context.get("patient", {}).get("name")
            greeting = questionnaire_engine.format_greeting(q_type, patient_name)
            q_state = questionnaire_engine.build_initial_state(q_type)
            first_question = questionnaire_engine.get_current_question(q_state)
            response_text = f"{greeting}\n\n{first_question}" if first_question else greeting

        # 9. Compile rule-based actions, then merge with LLM-driven actions
        rule_actions, rule_decisions = self._compile_actions(
            symptom_analysis=symptom_analysis,
            agent_state=agent_state,
            clinical_context=clinical_context,
            protocol_actions=protocol_actions,
            questionnaire_to_start=questionnaire_to_start,
            clinical_rules_result=clinical_rules_result,
        )
        actions = self._merge_actions(llm_actions, rule_actions)
        decisions = llm_decisions + rule_decisions

        # 10. Update agent state
        new_state = self._update_state(
            agent_state, symptom_analysis, message,
            questionnaire_state=questionnaire_engine.build_initial_state(
                questionnaire_to_start["questionnaire_type"]
            ) if questionnaire_to_start else None,
        )

        trace.actions_generated = [a.get("type", "UNKNOWN") for a in actions]

        return {
            "response": response_text,
            "actions": actions,
            "symptom_analysis": symptom_analysis,
            "clinical_disposition": clinical_rules_result.disposition,
            "clinical_disposition_reason": clinical_rules_result.reasoning,
            "clinical_rules_findings": [
                {"rule_id": f.rule_id, "disposition": f.disposition, "reason": f.reason}
                for f in clinical_rules_result.findings
            ],
            "new_state": new_state,
            "decisions": decisions,
            "intent": intent_result,
        }

    async def _process_questionnaire_answer(
        self, request: Dict[str, Any], *, has_llm_keys: bool
    ) -> Dict[str, Any]:
        """Handle a message that's part of an active questionnaire flow."""
        agent_state = request.get("agent_state", {})
        agent_config = request.get("agent_config") or {}
        message = request.get("message", "")
        questionnaire_progress = agent_state.get("active_questionnaire", {})

        use_llm = has_llm_keys

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
            new_state["last_questionnaire_at"] = datetime.now(timezone.utc).isoformat()
            new_state[f"last_{q_type.lower()}_scores"] = scores.get("items") or scores.get("grades")

            # Generate alerts for high scores (action + decision so backend creates alert)
            for alert in scores.get("alerts", []):
                severity = alert.get("severity", "HIGH")
                action_type = (
                    "CREATE_HIGH_CRITICAL_ALERT" if severity in ("HIGH", "CRITICAL") else "CREATE_LOW_ALERT"
                )
                payload = {
                    "type": "QUESTIONNAIRE_ALERT",
                    "severity": severity,
                    "message": (
                        f"Score alto no questionário {q_type}: "
                        f"{alert.get('item', '')} = {alert.get('score') or alert.get('grade', '')}"
                    ),
                }
                actions.append({
                    "type": action_type,
                    "payload": payload,
                    "requiresApproval": severity == "CRITICAL",
                })
                decisions.append({
                    "decisionType": "ALERT_CREATED",
                    "reasoning": payload["message"],
                    "confidence": 0.9,
                    "inputData": {"questionnaire_scores": scores, "alert": alert},
                    "outputAction": {"type": action_type, "payload": payload},
                    "requiresApproval": severity == "CRITICAL",
                })

            # Record questionnaire completion (backend needs questionnaireType, answers, scores)
            completion_payload = {
                "questionnaireType": q_type,
                "answers": answers,
                "scores": scores,
            }
            actions.append({
                "type": "QUESTIONNAIRE_COMPLETE",
                "payload": completion_payload,
                "requiresApproval": False,
            })

            decisions.append({
                "decisionType": "QUESTIONNAIRE_SCORED",
                "reasoning": f"Questionário {q_type} concluído. {scores.get('interpretation', '')}",
                "confidence": 0.95,
                "inputData": {"answers": answers},
                "outputAction": {"type": "QUESTIONNAIRE_COMPLETE", "payload": completion_payload},
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

    async def _run_multi_agent_pipeline(
        self,
        message: str,
        rag_context: str,
        conversation_history: List[Dict[str, str]],
        agent_config: Dict[str, Any],
        trace=None,
    ) -> tuple:
        """
        Run the multi-agent pipeline:
        1. Orchestrator LLM (Opus + adaptive thinking) routes to specialized subagents
        2. Subagents analyze their domain and call their tools
        3. Orchestrator generates the final patient-facing response

        Returns:
            Tuple of:
            - response_text: str
            - all_tool_calls: List[Dict]
            - llm_meta: Dict[str, str] with provider/model
        """
        orch_config = {
            **agent_config,
            "llm_model": agent_config.get("orchestrator_model", "claude-opus-4-6"),
            "use_adaptive_thinking": True,
            "max_tokens": 4096,
        }
        subagent_config = {
            **agent_config,
            "llm_model": agent_config.get("subagent_model", "claude-sonnet-4-6"),
            "max_tokens": 1024,
        }

        agents = {
            "consultar_agente_sintomas": SymptomAgent(),
            "consultar_agente_navegacao": NavigationAgent(),
            "consultar_agente_questionario": QuestionnaireAgent(),
            "consultar_agente_suporte_emocional": EmotionalSupportAgent(),
        }

        all_tool_calls: List[Dict[str, Any]] = []
        conv_messages = conversation_history + [{"role": "user", "content": message}]

        async def routing_tool_executor(tool_name: str, tool_input: Dict[str, Any]) -> str:
            agent = agents.get(tool_name)
            if not agent:
                logger.warning(f"Unknown routing tool: {tool_name}")
                return json.dumps({"error": f"Subagente desconhecido: {tool_name}"})

            result = await agent.run(
                context=rag_context,
                conversation_history=conv_messages,
                config=subagent_config,
            )

            all_tool_calls.extend(result.tool_calls)

            if result.error:
                logger.error(f"Subagent {tool_name} error: {result.error}")

            if trace is not None:
                trace.subagents_called.append(tool_name)

            logger.info(
                f"Subagent {result.agent_name} completed: "
                f"{len(result.tool_calls)} tool calls, {result.iterations} iterations"
            )

            return json.dumps({
                "agente": result.agent_name,
                "analise": result.response,
                "acoes_identificadas": len(result.tool_calls),
            }, ensure_ascii=False)

        orchestrator_system = build_orchestrator_prompt(rag_context)

        try:
            orch_result = await llm_provider.run_agentic_loop(
                system_prompt=orchestrator_system,
                initial_messages=conv_messages,
                tools=ORCHESTRATOR_ROUTING_TOOLS,
                config=orch_config,
                tool_executor=routing_tool_executor,
                max_iterations=8,
            )

            response_text = orch_result.get("response", "").strip()
            if not response_text:
                logger.warning(
                    "Multi-agent pipeline returned empty response, using fallback message"
                )
                response_text = llm_provider._fallback_response()

            logger.info(
                f"Orchestrator pipeline complete: "
                f"{len(all_tool_calls)} total tool calls, "
                f"{orch_result.get('iterations', 0)} orchestrator iterations"
            )

        except Exception as e:
            logger.error(
                "Multi-agent pipeline failed: %s (type=%s)", e, type(e).__name__, exc_info=True
            )
            response_text = llm_provider._fallback_response()
            orch_result = {}

        llm_meta = {
            "provider": orch_result.get("provider", "unknown") if isinstance(orch_result, dict) else "unknown",
            "model": orch_result.get("model", orch_config.get("llm_model", "")) if isinstance(orch_result, dict) else orch_config.get("llm_model", ""),
        }
        return response_text, all_tool_calls, llm_meta

    def _build_emergency_response(
        self,
        message: str,
        clinical_context: Dict[str, Any],
        agent_state: Dict[str, Any],
        symptom_analysis: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Fast-path response for detected emergency messages.
        Includes RECORD_SYMPTOM decisions when symptom_analysis has detected symptoms.
        """
        patient_name = clinical_context.get("patient", {}).get("name", "")
        first_name = patient_name.split()[0] if patient_name else ""
        greeting = f"{first_name}, " if first_name else ""

        response = (
            f"{greeting}entendo que você está passando por uma situação urgente. "
            "Sua mensagem já foi encaminhada com prioridade máxima para a equipe de enfermagem. "
            "Se você estiver com risco de vida imediato, por favor ligue para o SAMU (192) "
            "ou vá ao pronto-socorro mais próximo. "
            "A equipe entrará em contato com você o mais rápido possível."
        )

        payload = {
            "type": "EMERGENCY_DETECTED",
            "severity": "CRITICAL",
            "message": f"Paciente relatou emergência: {message[:200]}",
        }
        actions = [{
            "type": "CREATE_HIGH_CRITICAL_ALERT",
            "payload": payload,
            "requiresApproval": False,
            "source": "intent_classifier",
        }]

        decisions = [{
            "decisionType": "CRITICAL_ESCALATION",
            "reasoning": f"Intent classifier detected EMERGENCY in message: {message[:200]}",
            "confidence": 0.95,
            "inputData": {"message": message},
            "outputAction": {"type": "CREATE_HIGH_CRITICAL_ALERT", "payload": payload},
            "requiresApproval": False,
        }]

        # Add RECORD_SYMPTOM for detected symptoms so they are registered in the backend
        detected = (symptom_analysis or {}).get("detectedSymptoms", [])
        for symptom in detected:
            actions.append({
                "type": "RECORD_SYMPTOM",
                "payload": {
                    "code": f"symptom_{symptom.get('name', 'unknown')}",
                    "display": symptom.get("name", ""),
                    "value": symptom.get("severity"),
                },
                "requiresApproval": False,
            })
            decisions.append({
                "decisionType": "SYMPTOM_DETECTED",
                "reasoning": (
                    f"Detected symptom '{symptom.get('name')}' (severity {symptom.get('severity')}) "
                    "during emergency escalation"
                ),
                "confidence": symptom.get("confidence", 0.9),
                "inputData": {"symptom": symptom},
                "outputAction": {
                    "type": "RECORD_SYMPTOM",
                    "payload": {
                        "code": f"symptom_{symptom.get('name', 'unknown')}",
                        "display": symptom.get("name", ""),
                        "value": symptom.get("severity"),
                    },
                },
                "requiresApproval": False,
            })

        if detected:
            logger.info(f"Emergency path: registering {len(detected)} symptom(s): {[s.get('name') for s in detected]}")

        return {
            "response": response,
            "actions": actions,
            "symptom_analysis": symptom_analysis,
            "new_state": agent_state,
            "decisions": decisions,
        }

    def _build_greeting_response(
        self,
        clinical_context: Dict[str, Any],
        agent_state: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Fast-path response for greetings, skipping the full pipeline."""
        patient_name = clinical_context.get("patient", {}).get("name", "")
        first_name = patient_name.split()[0] if patient_name else ""

        hour = datetime.now().hour
        if hour < 12:
            period = "Bom dia"
        elif hour < 18:
            period = "Boa tarde"
        else:
            period = "Boa noite"

        greeting = f"{period}, {first_name}!" if first_name else f"{period}!"
        response = (
            f"{greeting} Sou seu navegador oncológico. "
            "Como posso te ajudar hoje? Pode me contar como está se sentindo, "
            "tirar dúvidas sobre seu tratamento ou perguntar sobre suas próximas etapas (consultas, exames, avaliações)."
        )

        return {
            "response": response,
            "actions": [],
            "symptom_analysis": None,
            "new_state": agent_state,
            "decisions": [{
                "decisionType": "GREETING_HANDLED",
                "reasoning": "Simple greeting detected, fast response without full pipeline",
                "confidence": 0.9,
                "inputData": {},
                "outputAction": {"type": "GREETING_RESPONSE"},
                "requiresApproval": False,
            }],
        }

    def _build_appointment_response(
        self,
        clinical_context: Dict[str, Any],
        agent_state: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Fast-path response for appointment queries."""
        patient_name = clinical_context.get("patient", {}).get("name", "")
        first_name = patient_name.split()[0] if patient_name else ""
        greeting = f"{first_name}, " if first_name else ""

        nav_steps = clinical_context.get("navigationSteps", [])
        upcoming = [
            s for s in nav_steps
            if s.get("status") in ("PENDING", "SCHEDULED", "IN_PROGRESS")
        ]

        if upcoming:
            steps_text = "\n".join(
                f"• {s.get('stepName', s.get('name', 'Etapa'))}: "
                f"{s.get('dueDate', s.get('scheduledDate', 'data a confirmar'))}"
                for s in upcoming[:5]
            )
            response = (
                f"{greeting}aqui estão suas próximas etapas:\n\n"
                f"{steps_text}\n\n"
                "Se precisar remarcar ou tiver dúvidas sobre alguma etapa, é só me avisar!"
            )
        else:
            response = (
                f"{greeting}no momento não encontrei etapas pendentes no seu plano. "
                "Se você acha que deveria ter algo agendado, posso encaminhar para "
                "a equipe verificar. Deseja que eu faça isso?"
            )

        return {
            "response": response,
            "actions": [],
            "symptom_analysis": None,
            "new_state": agent_state,
            "decisions": [{
                "decisionType": "APPOINTMENT_QUERY_HANDLED",
                "reasoning": "Appointment query detected, fast response with navigation steps",
                "confidence": 0.8,
                "inputData": {"upcoming_steps": len(upcoming)},
                "outputAction": {"type": "APPOINTMENT_RESPONSE"},
                "requiresApproval": False,
            }],
        }

    def _parse_tool_calls_to_actions(
        self, tool_calls: List[Dict[str, Any]]
    ) -> tuple:
        """
        Convert LLM tool calls into structured actions and decisions.
        Each tool call maps to an action the backend can execute and a
        decision record for the audit trail.
        """
        actions = []
        decisions = []

        for tc in tool_calls:
            name = tc.get("name", "")
            inp = tc.get("input", {})

            if name == "registrar_sintoma":
                actions.append({
                    "type": "RECORD_SYMPTOM",
                    "payload": {
                        "code": f"symptom_{inp.get('nome', 'unknown')}",
                        "display": inp.get("nome", ""),
                        "value": inp.get("severidade", "MEDIUM"),
                        "description": inp.get("descricao", ""),
                    },
                    "requiresApproval": False,
                    "source": "llm_tool_call",
                })
                decisions.append({
                    "decisionType": "SYMPTOM_DETECTED",
                    "reasoning": (
                        f"LLM detected symptom '{inp.get('nome')}' "
                        f"severity {inp.get('severidade')} - {inp.get('descricao', '')}"
                    ),
                    "confidence": 0.9,
                    "inputData": {"tool_call": tc},
                    "outputAction": {
                        "type": "RECORD_SYMPTOM",
                        "payload": {
                            "code": f"symptom_{inp.get('nome', 'unknown')}",
                            "display": inp.get("nome", ""),
                            "value": inp.get("severidade", "MEDIUM"),
                        },
                    },
                    "requiresApproval": False,
                })

            elif name == "criar_alerta":
                severity = inp.get("severidade", "HIGH")
                is_critical = severity == "CRITICAL"
                action_type = "CREATE_HIGH_CRITICAL_ALERT" if is_critical else "CREATE_LOW_ALERT"
                actions.append({
                    "type": action_type,
                    "payload": {
                        "type": "AI_DETECTED_ALERT",
                        "severity": severity,
                        "message": inp.get("motivo", "Alerta gerado pelo agente de IA"),
                    },
                    "requiresApproval": is_critical,
                    "source": "llm_tool_call",
                })
                payload = {
                    "type": "AI_DETECTED_ALERT",
                    "severity": severity,
                    "message": inp.get("motivo", "Alerta gerado pelo agente de IA"),
                }
                decisions.append({
                    "decisionType": "CRITICAL_ESCALATION" if is_critical else "ALERT_CREATED",
                    "reasoning": inp.get("motivo", ""),
                    "confidence": 0.9,
                    "inputData": {"tool_call": tc},
                    "outputAction": {"type": action_type, "payload": payload},
                    "requiresApproval": is_critical,
                })

            elif name == "iniciar_questionario":
                q_type = inp.get("tipo", "ESAS")
                actions.append({
                    "type": "START_QUESTIONNAIRE",
                    "payload": {"questionnaireType": q_type},
                    "requiresApproval": False,
                    "source": "llm_tool_call",
                })
                decisions.append({
                    "decisionType": "QUESTIONNAIRE_STARTED",
                    "reasoning": inp.get("motivo", f"LLM decided to start {q_type}"),
                    "confidence": 0.9,
                    "inputData": {"tool_call": tc},
                    "outputAction": {"type": "START_QUESTIONNAIRE", "payload": {"type": q_type}},
                    "requiresApproval": False,
                })

            elif name == "agendar_checkin":
                days = inp.get("dias", 7)
                payload = {
                    "days": days,
                    "reason": inp.get("motivo", ""),
                }
                actions.append({
                    "type": "SCHEDULE_CHECK_IN",
                    "payload": payload,
                    "requiresApproval": False,
                    "source": "llm_tool_call",
                })
                decisions.append({
                    "decisionType": "CHECK_IN_SCHEDULED",
                    "reasoning": (
                        f"LLM scheduled check-in in {days} days: "
                        f"{inp.get('motivo', '')}"
                    ),
                    "confidence": 0.9,
                    "inputData": {"tool_call": tc},
                    "outputAction": {"type": "SCHEDULE_CHECK_IN", "payload": payload},
                    "requiresApproval": False,
                })

            elif name == "escalar_para_enfermagem":
                urgency = inp.get("urgencia", "HIGH")
                needs_approval = urgency == "CRITICAL"
                actions.append({
                    "type": "CREATE_HIGH_CRITICAL_ALERT",
                    "payload": {
                        "type": "NURSING_ESCALATION",
                        "severity": urgency,
                        "message": inp.get("motivo", "Escalação para enfermagem pelo agente de IA"),
                    },
                    "requiresApproval": needs_approval,
                    "source": "llm_tool_call",
                })
                payload = {
                    "type": "NURSING_ESCALATION",
                    "severity": urgency,
                    "message": inp.get("motivo", "Escalação para enfermagem pelo agente de IA"),
                }
                decisions.append({
                    "decisionType": "CRITICAL_ESCALATION",
                    "reasoning": inp.get("motivo", ""),
                    "confidence": 0.95,
                    "inputData": {"tool_call": tc},
                    "outputAction": {"type": "CREATE_HIGH_CRITICAL_ALERT", "payload": payload},
                    "requiresApproval": needs_approval,
                })

            elif name == "recomendar_consulta":
                payload = {
                    "specialty": inp.get("especialidade", ""),
                    "reason": inp.get("motivo", ""),
                    "urgency": inp.get("urgencia", "HIGH"),
                }
                actions.append({
                    "type": "RECOMMEND_APPOINTMENT",
                    "payload": payload,
                    "requiresApproval": True,
                    "source": "llm_tool_call",
                })
                decisions.append({
                    "decisionType": "APPOINTMENT_RECOMMENDED",
                    "reasoning": (
                        f"LLM recommends {inp.get('especialidade')} appointment: "
                        f"{inp.get('motivo', '')}"
                    ),
                    "confidence": 0.85,
                    "inputData": {"tool_call": tc},
                    "outputAction": {"type": "RECOMMEND_APPOINTMENT", "payload": payload},
                    "requiresApproval": True,
                })

            elif name == "enviar_lembrete":
                dias = max(1, min(30, int(inp.get("dias", 1)) if inp.get("dias") is not None else 1))
                payload = {
                    "message": inp.get("mensagem", ""),
                    "daysFromNow": dias,
                    "actionType": inp.get("tipo", "FOLLOW_UP"),
                }
                actions.append({
                    "type": "SEND_REMINDER",
                    "payload": payload,
                    "requiresApproval": False,
                    "source": "llm_tool_call",
                })
                decisions.append({
                    "decisionType": "REMINDER_SCHEDULED",
                    "reasoning": (
                        f"LLM scheduled reminder in {dias} days: {inp.get('mensagem', '')[:80]}..."
                    ),
                    "confidence": 0.9,
                    "inputData": {"tool_call": tc},
                    "outputAction": {"type": "SEND_REMINDER", "payload": payload},
                    "requiresApproval": False,
                })

            elif name == "recalcular_prioridade":
                motivo = inp.get("motivo", "Dado clínico coletado")
                payload = {"motivo": motivo}
                actions.append({
                    "type": "RECALCULATE_PRIORITY",
                    "payload": payload,
                    "requiresApproval": False,
                    "source": "llm_tool_call",
                })
                decisions.append({
                    "decisionType": "PRIORITY_RECALCULATED",
                    "reasoning": f"Recálculo de prioridade acionado: {motivo}",
                    "confidence": 0.95,
                    "inputData": {"tool_call": tc},
                    "outputAction": {"type": "RECALCULATE_PRIORITY", "payload": payload},
                    "requiresApproval": False,
                })

            elif name == "atualizar_etapa_navegacao":
                concluida = inp.get("concluida", False)
                payload = {
                    "stepKey": inp.get("step_key", ""),
                    "isCompleted": concluida,
                    "status": "COMPLETED" if concluida else "IN_PROGRESS",
                }
                actions.append({
                    "type": "UPDATE_NAVIGATION_STEP",
                    "payload": payload,
                    "requiresApproval": False,
                    "source": "llm_tool_call",
                })
                decisions.append({
                    "decisionType": "NAVIGATION_STEP_UPDATED",
                    "reasoning": (
                        f"LLM updated step {inp.get('step_key')} to "
                        f"{'completed' if concluida else 'in progress'}"
                    ),
                    "confidence": 0.9,
                    "inputData": {"tool_call": tc},
                    "outputAction": {"type": "UPDATE_NAVIGATION_STEP", "payload": payload},
                    "requiresApproval": False,
                })

            else:
                logger.warning(f"Unknown tool call from LLM: {name}")

        return actions, decisions

    def _merge_actions(
        self,
        llm_actions: List[Dict[str, Any]],
        rule_actions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Merge LLM-driven actions with rule-based actions, deduplicating.
        LLM actions take priority when both detect the same symptom/alert.
        """
        if not llm_actions:
            return rule_actions
        if not rule_actions:
            return llm_actions

        merged = list(llm_actions)
        llm_keys = set()
        for a in llm_actions:
            key = self._action_dedupe_key(a)
            llm_keys.add(key)

        for a in rule_actions:
            key = self._action_dedupe_key(a)
            if key not in llm_keys:
                merged.append(a)

        return merged

    def _action_dedupe_key(self, action: Dict[str, Any]) -> tuple:
        action_type = action.get("type", "")
        payload = action.get("payload", {}) or {}

        if action_type == "RECORD_SYMPTOM":
            identifier = payload.get("code") or payload.get("display", "")
        elif action_type == "START_QUESTIONNAIRE":
            identifier = payload.get("questionnaireType") or payload.get("type", "")
        elif action_type == "UPDATE_NAVIGATION_STEP":
            identifier = payload.get("stepKey", "")
        elif action_type == "SEND_REMINDER":
            identifier = (
                payload.get("actionType", ""),
                payload.get("daysFromNow", ""),
                payload.get("message", ""),
            )
        elif action_type == "SCHEDULE_CHECK_IN":
            identifier = (
                payload.get("days", ""),
                payload.get("frequency", ""),
                payload.get("reason", ""),
            )
        elif "ALERT" in action_type:
            identifier = (
                payload.get("type", ""),
                payload.get("severity", ""),
                payload.get("message", ""),
            )
        else:
            try:
                identifier = json.dumps(payload, sort_keys=True, ensure_ascii=False)
            except TypeError:
                identifier = str(payload)

        return (action_type, identifier)

    def _compile_actions(
        self,
        symptom_analysis: Dict[str, Any],
        agent_state: Dict[str, Any],
        clinical_context: Dict[str, Any],
        protocol_actions: Optional[List[Dict[str, Any]]] = None,
        questionnaire_to_start: Optional[Dict[str, Any]] = None,
        clinical_rules_result=None,
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

        if detected:
            logger.info(f"_compile_actions: registering {len(detected)} symptom(s): {[s.get('name') for s in detected]}")

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

        # Recalculate priority when symptoms detected (dado clínico coletado)
        if detected:
            actions.append({
                "type": "RECALCULATE_PRIORITY",
                "payload": {"motivo": f"Sintoma(s) registrado(s): {', '.join(s['name'] for s in detected)}"},
                "requiresApproval": False,
            })
            decisions.append({
                "decisionType": "PRIORITY_RECALCULATED",
                "reasoning": f"Dado clínico coletado: {len(detected)} sintoma(s) — recálculo automático de prioridade",
                "confidence": 0.95,
                "inputData": {"symptoms": [s["name"] for s in detected]},
                "outputAction": {"type": "RECALCULATE_PRIORITY", "payload": {}},
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
                    "type": (
                        "CREATE_HIGH_CRITICAL_ALERT"
                        if alert_severity in ("HIGH", "CRITICAL")
                        else "CREATE_LOW_ALERT"
                    ),
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

        # Clinical rules: persist disposition to backend and escalate when needed
        if clinical_rules_result and clinical_rules_result.disposition != "REMOTE_NURSING":
            disposition = clinical_rules_result.disposition
            reasoning = clinical_rules_result.reasoning

            actions.append({
                "type": "UPDATE_CLINICAL_DISPOSITION",
                "payload": {
                    "disposition": disposition,
                    "reason": reasoning,
                },
                "requiresApproval": False,
                "source": "clinical_rules_engine",
            })
            decisions.append({
                "decisionType": "CLINICAL_DISPOSITION_SET",
                "reasoning": reasoning,
                "confidence": clinical_rules_result.confidence,
                "inputData": {
                    "rules_fired": [f.rule_id for f in clinical_rules_result.findings],
                    "disposition": disposition,
                },
                "outputAction": {
                    "type": "UPDATE_CLINICAL_DISPOSITION",
                    "payload": {"disposition": disposition, "reason": reasoning},
                },
                "requiresApproval": False,
            })

            # Auto-create alert for ER-level dispositions not yet covered by symptom analysis
            if clinical_rules_result.is_er and not requires_escalation:
                is_critical = disposition == ER_IMMEDIATE
                alert_payload = {
                    "type": "CLINICAL_RULES_ALERT",
                    "severity": "CRITICAL" if is_critical else "HIGH",
                    "message": f"Disposição clínica: {disposition}. {reasoning[:200]}",
                }
                actions.append({
                    "type": "CREATE_HIGH_CRITICAL_ALERT",
                    "payload": alert_payload,
                    "requiresApproval": False,
                    "source": "clinical_rules_engine",
                })
                decisions.append({
                    "decisionType": "CRITICAL_ESCALATION" if is_critical else "ALERT_CREATED",
                    "reasoning": reasoning,
                    "confidence": clinical_rules_result.confidence,
                    "inputData": {"disposition": disposition},
                    "outputAction": {"type": "CREATE_HIGH_CRITICAL_ALERT", "payload": alert_payload},
                    "requiresApproval": False,
                })

        # Protocol-driven actions
        if protocol_actions:
            for pa in protocol_actions:
                pa_type = pa.get("type")

                if pa_type == "SCHEDULE_CHECK_IN":
                    payload = {"frequency": pa.get("frequency", "weekly")}
                    actions.append({
                        "type": "SCHEDULE_CHECK_IN",
                        "payload": payload,
                        "requiresApproval": False,
                    })
                    decisions.append({
                        "decisionType": "CHECK_IN_SCHEDULED",
                        "reasoning": pa.get("reason", "Protocol check-in"),
                        "confidence": 0.9,
                        "inputData": {},
                        "outputAction": {"type": "SCHEDULE_CHECK_IN", "payload": payload},
                        "requiresApproval": False,
                    })

                elif pa_type == "PROTOCOL_ALERT":
                    severity = "HIGH"
                    payload = {
                        "type": "PROTOCOL_CRITICAL_SYMPTOM",
                        "severity": severity,
                        "message": pa.get("reason", "Sintoma crítico do protocolo detectado"),
                    }
                    actions.append({
                        "type": "CREATE_LOW_ALERT",
                        "payload": payload,
                        "requiresApproval": False,
                    })
                    decisions.append({
                        "decisionType": "ALERT_CREATED",
                        "reasoning": pa.get("reason", "Protocol alert"),
                        "confidence": 0.85,
                        "inputData": {"protocol_action": pa},
                        "outputAction": {"type": "CREATE_LOW_ALERT", "payload": payload},
                        "requiresApproval": False,
                    })

                elif pa_type in ("HIGH_ESAS_SCORE", "HIGH_ESAS_TOTAL"):
                    severity = "HIGH"
                    payload = {
                        "type": "HIGH_ESAS_SCORE",
                        "severity": severity,
                        "message": pa.get("reason", "Score ESAS alto"),
                    }
                    actions.append({
                        "type": "CREATE_LOW_ALERT",
                        "payload": payload,
                        "requiresApproval": False,
                    })
                    decisions.append({
                        "decisionType": "ALERT_CREATED",
                        "reasoning": pa.get("reason", "High ESAS score"),
                        "confidence": 0.85,
                        "inputData": {"protocol_action": pa},
                        "outputAction": {"type": "CREATE_LOW_ALERT", "payload": payload},
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
                "decisionType": "QUESTIONNAIRE_STARTED",
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
