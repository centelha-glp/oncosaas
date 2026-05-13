import json
import time
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone

from src.config.llm_defaults import merge_agent_llm_config

from .llm_provider import llm_provider
from .context_builder import context_builder
from .symptom_analyzer import symptom_analyzer
from .protocol_engine import protocol_engine
from .questionnaire_engine import questionnaire_engine
from .intent_classifier import (
    intent_classifier,
    INTENT_GREETING,
    INTENT_EMERGENCY,
    INTENT_APPOINTMENT_QUERY,
    INTENT_EMOTIONAL_SUPPORT,
    INTENT_SYMPTOM_REPORT,
)
from .prompts.orchestrator_prompt import build_orchestrator_prompt, ORCHESTRATOR_ROUTING_TOOLS
from .subagents import (
    SymptomAgent,
    NavigationAgent,
    QuestionnaireAgent,
    EmotionalSupportAgent,
    SchedulingSecretaryAgent,
)
from .clinical_rules import (
    ClinicalRulesResult,
    ER_IMMEDIATE,
    REMOTE_NURSING,
    clinical_rules_engine,
)
from .tracer import (
    TRACE_ORCH_MESSAGE_MAX_CHARS,
    TRACE_ORCH_SYSTEM_MAX_CHARS,
    TRACE_RAG_CONTEXT_MAX_CHARS,
    TRACE_SUBAGENT_RESPONSE_MAX_CHARS,
    pack_trace_text,
    tracer,
)
from .llm_pricing import sum_usage_events

"""
Agent Orchestrator.
Main processing pipeline for the oncology navigation agent.
Receives message + context → returns response + actions.
"""

logger = logging.getLogger(__name__)


def _pending_navigation_steps(clinical_context: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Etapas de navegação ainda não concluídas (PENDING, SCHEDULED, IN_PROGRESS)."""
    if not clinical_context:
        return []
    nav_steps = clinical_context.get("navigationSteps") or []
    return [
        s
        for s in nav_steps
        if s.get("status") in ("PENDING", "SCHEDULED", "IN_PROGRESS")
    ]


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
            result["pipeline_trace"] = trace.to_dict()
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

        # Estado no início do turno — usado para fase pós-main de questionário (sem fast-path de coleta).
        had_active_questionnaire = bool(agent_state.get("active_questionnaire"))

        # 1. Classify intent (LLM via classify_async quando há chaves; senão GENERAL)
        span_intent = tracer.start_span(trace, "intent_classification")
        intent_result = await intent_classifier.classify_async(
            message,
            agent_state,
            agent_config,
            conversation_history=conversation_history,
        )
        intent = intent_result["intent"]
        tu = intent_result.pop("token_usage_events", None)
        if tu:
            trace.token_usage_events.extend(tu)
        span_intent.finish(intent=intent, confidence=intent_result.get("confidence"))
        trace.intent = intent
        trace.intent_confidence = intent_result.get("confidence")
        logger.info(f"Intent classified: {intent} (confidence={intent_result['confidence']:.2f})")

        if intent == INTENT_EMERGENCY:
            emergency_meta = intent_result.get("metadata", {})
            if emergency_meta.get("escalate_immediately"):
                trace.pipeline_path = "emergency"
                symptom_analysis, clinical_rules_result = await self._run_safety_triage(
                    trace=trace,
                    message=message,
                    clinical_context=clinical_context,
                    agent_config=agent_config,
                    has_llm_keys=has_llm_keys,
                )
                response = self._build_emergency_response(
                    message, clinical_context, agent_state, symptom_analysis
                )
                rule_actions, rule_decisions = self._compile_clinical_rules_actions(
                    clinical_rules_result,
                    requires_escalation=True,
                )
                response["actions"] = self._merge_actions(response["actions"], rule_actions)
                response["decisions"].extend(rule_decisions)
                response["clinical_disposition"] = clinical_rules_result.disposition
                response["clinical_disposition_reason"] = clinical_rules_result.reasoning
                response["clinical_rules_findings"] = [
                    {"rule_id": f.rule_id, "disposition": f.disposition, "reason": f.reason}
                    for f in clinical_rules_result.findings
                ]
                response["intent"] = intent_result
                trace.actions_generated = [a.get("type", "UNKNOWN") for a in response["actions"]]
                return response

        # Questionário ativo: não há fast-path de coleta antes do main (plano pós-pipeline).
        # ER imediato é tratado após o main com merge por precedência de urgência (ver fim do ramo main).

        # Saudação: triagem mínima (Layer 1) antes do return rápido — não prevalece sobre ER.
        if intent == INTENT_GREETING and intent_result.get("skip_full_pipeline"):
            trace.pipeline_path = "greeting"
            symptom_analysis, clinical_rules_result = await self._run_safety_triage(
                trace=trace,
                message=message,
                clinical_context=clinical_context,
                agent_config=agent_config,
                has_llm_keys=has_llm_keys,
            )
            if clinical_rules_result.is_er:
                trace.pipeline_path = "greeting_safety_override"
                response = self._build_layer1_override_response(
                    message=message,
                    clinical_context=clinical_context,
                    agent_state=agent_state,
                    symptom_analysis=symptom_analysis,
                    clinical_rules_result=clinical_rules_result,
                    intent_result=intent_result,
                    interrupt_kind="fast_path",
                )
                trace.actions_generated = [
                    a.get("type", "UNKNOWN") for a in response["actions"]
                ]
                return response
            base = self._build_greeting_response(clinical_context, agent_state)
            return self._attach_layer1_audit_fields(
                base, symptom_analysis, clinical_rules_result, intent_result
            )

        appointment_query_branch = intent == INTENT_APPOINTMENT_QUERY

        if appointment_query_branch:
            trace.pipeline_path = "appointment_query"
            # Contrato SymptomAnalysisResult / AgentProcessResponse: overallSeverity é str obrigatória.
            symptom_analysis = {
                "detectedSymptoms": [],
                "overallSeverity": "LOW",
                "requiresEscalation": False,
                "structuredData": {},
            }
            clinical_rules_result = ClinicalRulesResult(
                disposition=REMOTE_NURSING,
                reasoning=(
                    "Ramo appointment_query: análise de sintomas e Layer 1 não executadas neste turno; "
                    "resposta produzida pelo pipeline multi-agente com foco em navegação/agenda."
                ),
                findings=[],
                requires_immediate_action=False,
                confidence=1.0,
            )
            trace.symptoms_detected = 0
            trace.overall_severity = None
            trace.clinical_disposition = clinical_rules_result.disposition
            trace.clinical_rules_fired = []
        else:
            trace.pipeline_path = "main"
            symptom_analysis, clinical_rules_result = await self._run_safety_triage(
                trace=trace,
                message=message,
                clinical_context=clinical_context,
                agent_config=agent_config,
                has_llm_keys=has_llm_keys,
            )

        cancer_type = clinical_context.get("patient", {}).get("cancerType")
        journey_stage = clinical_context.get("patient", {}).get("currentStage")
        logger.info(
            "LLM key check: has_any=%s has_anthropic=%s agent_config_keys=%s",
            has_llm_keys,
            has_anthropic,
            [k for k in (agent_config or {}).keys()],
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
        trace.rag_context_output = pack_trace_text(rag_context, TRACE_RAG_CONTEXT_MAX_CHARS)
        span_rag.finish(
            total_chars=len(rag_context or ""),
            truncated=trace.rag_context_output.get("truncated", False),
        )

        # 5. Build protocol context string
        # 7. Multi-agent pipeline: orchestrator (Opus) routes to specialized subagents
        llm_actions = []
        llm_decisions = []

        intent_hint = ""
        if intent == INTENT_EMOTIONAL_SUPPORT:
            intent_hint = "\n[CONTEXTO: O paciente está em sofrimento emocional. Responda com empatia e acolhimento.]\n"
        elif intent == INTENT_APPOINTMENT_QUERY:
            intent_hint = (
                "\n[CONTEXTO: Intenção APPOINTMENT_QUERY — consulta sobre datas/horários de consultas, "
                "exames ou retornos. Invoque `consultar_agente_navegacao` e, ao concluir a orientação, "
                "use a ferramenta `informar_agenda_navegacao` no subagente de navegação para registro "
                "de auditoria.]\n"
            )
        elif intent_result.get("metadata", {}).get("emotional_component"):
            intent_hint = "\n[CONTEXTO: O paciente relata sintomas com componente emocional. Aborde ambos.]\n"

        final_message = f"{intent_hint}{message}" if intent_hint else message

        # Multi-agent pipeline: Anthropic preferred, OpenAI fallback (handled inside run_agentic_loop).
        if has_llm_keys:
            trace.main_multi_agent_llm_used = True
            span_llm = tracer.start_span(trace, "multi_agent_pipeline")
            llm_start = time.monotonic()
            response_text, all_tool_calls, llm_meta = await self._run_multi_agent_pipeline(
                message=final_message,
                rag_context=rag_context,
                conversation_history=conversation_history,
                agent_config=agent_config,
                trace=trace,
                appointment_query=appointment_query_branch,
            )
            llm_dur = (time.monotonic() - llm_start) * 1000
            span_llm.finish(tool_calls=len(all_tool_calls))
            tracer.record_llm_call(
                trace,
                "orchestrator",
                llm_meta.get("provider", "unknown"),
                llm_meta.get("model") or llm_meta.get("orchestrator_model", ""),
                llm_dur,
            )
            if all_tool_calls:
                llm_actions, llm_decisions = self._parse_tool_calls_to_actions(
                    all_tool_calls,
                    clinical_context=clinical_context,
                )
                logger.info(
                    f"Multi-agent tool calls ({len(all_tool_calls)}): "
                    f"{[tc.get('name') or (tc.get('function') or {}).get('name') for tc in all_tool_calls]}"
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

        # Já existe questionário em andamento: não reiniciar nem sobrescrever resposta com novo START.
        if had_active_questionnaire and questionnaire_to_start:
            questionnaire_to_start = None

        # Ramo agenda (APPOINTMENT_QUERY): exclusão mútua com arranque de questionário neste turno —
        # preserva a resposta do multi-agent e não emite START_QUESTIONNAIRE na mesma mensagem.
        if appointment_query_branch:
            questionnaire_to_start = None
            llm_actions = [a for a in llm_actions if a.get("type") != "START_QUESTIONNAIRE"]

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

        # Agenda: se o subagente não chamou `informar_agenda_navegacao`, ainda registramos decisão
        # mínima para auditoria / decision gate (auto-aprovada como APPOINTMENT_RESPONSE).
        if appointment_query_branch and not any(
            d.get("decisionType") == "APPOINTMENT_QUERY_HANDLED" for d in llm_decisions
        ):
            pending = _pending_navigation_steps(clinical_context)
            decisions.append(
                {
                    "decisionType": "APPOINTMENT_QUERY_HANDLED",
                    "reasoning": (
                        "Consulta de agenda respondida em texto; o subagente não invocou "
                        "`informar_agenda_navegacao` neste turno (registro mínimo de auditoria)."
                    )[:500],
                    "confidence": 0.75,
                    "inputData": {
                        "source": "appointment_query_no_navigation_tool",
                        "pending_navigation_steps_count": len(pending),
                    },
                    "outputAction": {"type": "APPOINTMENT_RESPONSE"},
                    "requiresApproval": False,
                }
            )

        # 10. Update agent state
        new_state = self._update_state(
            agent_state, symptom_analysis, message,
            questionnaire_state=questionnaire_engine.build_initial_state(
                questionnaire_to_start["questionnaire_type"]
            ) if questionnaire_to_start else None,
        )

        trace.actions_generated = [a.get("type", "UNKNOWN") for a in actions]

        # Pós-main — questionário ativo: fusão com precedência de urgência (Layer 1 imediato > ESAS).
        # Contrato HTTP: uma única `response` por request. Com urgência imediata, não consumimos
        # a mensagem como resposta ao item do questionário; a continuação ESAS fica para o
        # próximo turno (duas bolhas / segundo envio: ver todo contract-two-messages no plano).
        if had_active_questionnaire and clinical_rules_result.is_immediate:
            merged = self._build_layer1_override_response(
                message=message,
                clinical_context=clinical_context,
                agent_state=agent_state,
                symptom_analysis=symptom_analysis,
                clinical_rules_result=clinical_rules_result,
                intent_result=intent_result,
                interrupt_kind="questionnaire",
            )
            trace.actions_generated = [a.get("type", "UNKNOWN") for a in merged["actions"]]
            return {**merged, "intent": intent_result}

        # Continuação literal do ESAS: não consumir o turno como próxima pergunta quando o paciente
        # mudou de assunto (agenda) ou fez relato explícito de sintoma (prioriza multi-agent / triagem).
        # Respostas numéricas curtas ao item costumam classificar como GENERAL/outro intent e seguem aqui.
        if (
            had_active_questionnaire
            and not clinical_rules_result.is_immediate
            and not appointment_query_branch
            and intent != INTENT_SYMPTOM_REPORT
        ):
            q_out = await self._process_questionnaire_answer(
                {
                    "message": message,
                    "clinical_context": clinical_context,
                    "protocol": protocol,
                    "conversation_history": conversation_history,
                    "agent_state": new_state,
                    "agent_config": agent_config,
                },
                has_llm_keys=has_llm_keys,
            )
            merged_actions = self._merge_actions(actions, q_out["actions"])
            trace.actions_generated = [a.get("type", "UNKNOWN") for a in merged_actions]
            return {
                "response": q_out["response"],
                "actions": merged_actions,
                "symptom_analysis": symptom_analysis,
                "clinical_disposition": clinical_rules_result.disposition,
                "clinical_disposition_reason": clinical_rules_result.reasoning,
                "clinical_rules_findings": [
                    {"rule_id": f.rule_id, "disposition": f.disposition, "reason": f.reason}
                    for f in clinical_rules_result.findings
                ],
                "new_state": q_out["new_state"],
                "decisions": decisions + q_out["decisions"],
                "intent": intent_result,
            }

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

    async def _run_safety_triage(
        self,
        *,
        trace,
        message: str,
        clinical_context: Dict[str, Any],
        agent_config: Dict[str, Any],
        has_llm_keys: bool,
    ) -> tuple:
        """Run symptom analysis and Layer 1 rules before any patient-facing LLM step."""
        cancer_type = clinical_context.get("patient", {}).get("cancerType")
        use_llm_analysis = agent_config.get("use_llm_symptom_analysis", True) and has_llm_keys

        span_symptoms = tracer.start_span(trace, "symptom_analysis")
        symptom_analysis = await symptom_analyzer.analyze(
            message=message,
            clinical_context=clinical_context,
            cancer_type=cancer_type,
            use_llm=use_llm_analysis,
            llm_config=agent_config,
        )
        if isinstance(symptom_analysis, dict):
            sym_tok = symptom_analysis.pop("_symptomTokenUsageEvents", None)
            if sym_tok:
                trace.token_usage_events.extend(sym_tok)
            detected = symptom_analysis.get("detectedSymptoms", [])
            severity = symptom_analysis.get("overallSeverity")
        else:
            detected = getattr(symptom_analysis, "detectedSymptoms", [])
            severity = getattr(symptom_analysis, "overallSeverity", None)
        span_symptoms.finish(symptoms_count=len(detected), overall_severity=severity)
        trace.symptoms_detected = len(detected)
        trace.overall_severity = severity

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

        return symptom_analysis, clinical_rules_result

    def _attach_layer1_audit_fields(
        self,
        result: Dict[str, Any],
        symptom_analysis: Any,
        clinical_rules_result,
        intent_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Anexa sintomas + Layer 1 a respostas rápidas (saudação) após triagem mínima."""
        out = {**result}
        out["symptom_analysis"] = symptom_analysis
        out["clinical_disposition"] = clinical_rules_result.disposition
        out["clinical_disposition_reason"] = clinical_rules_result.reasoning
        out["clinical_rules_findings"] = [
            {"rule_id": f.rule_id, "disposition": f.disposition, "reason": f.reason}
            for f in clinical_rules_result.findings
        ]
        out["intent"] = intent_result
        return out

    def _build_layer1_override_response(
        self,
        *,
        message: str,
        clinical_context: Dict[str, Any],
        agent_state: Dict[str, Any],
        symptom_analysis: Dict[str, Any],
        clinical_rules_result,
        intent_result: Dict[str, Any],
        interrupt_kind: str,
    ) -> Dict[str, Any]:
        """
        Resposta quando Layer 1 exige interromper um fluxo rápido (questionário ou saudação).

        interrupt_kind: 'questionnaire' (só ER_IMMEDIATE no caller) | 'fast_path' (saudação: is_er ER_DAYS/ER_IMMEDIATE).
        """
        patient_name = clinical_context.get("patient", {}).get("name", "")
        first_name = patient_name.split()[0] if patient_name else ""
        greeting = f"{first_name}, " if first_name else ""
        if interrupt_kind == "questionnaire":
            response = (
                f"{greeting}identifiquei um sinal que precisa de atenção imediata. "
                "Vou interromper o questionário por segurança e encaminhar sua mensagem "
                "com prioridade para a equipe. Se houver piora importante ou risco imediato, "
                "procure o pronto-socorro ou ligue para o SAMU (192)."
            )
        else:
            response = (
                f"{greeting}identifiquei um sinal clínico que precisa de atenção prioritária. "
                "Vou priorizar sua segurança em relação à resposta automática e encaminhar "
                "sua mensagem à equipe. Se houver risco imediato, procure o pronto-socorro ou o SAMU (192)."
            )

        actions, decisions = self._compile_actions(
            symptom_analysis=symptom_analysis,
            agent_state=agent_state,
            clinical_context=clinical_context,
            protocol_actions=[],
            questionnaire_to_start=None,
            clinical_rules_result=clinical_rules_result,
        )
        new_state = self._update_state(agent_state, symptom_analysis, message)

        return {
            "response": response,
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

    async def _run_multi_agent_pipeline(
        self,
        message: str,
        rag_context: str,
        conversation_history: List[Dict[str, str]],
        agent_config: Dict[str, Any],
        trace=None,
        *,
        appointment_query: bool = False,
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
        merged = merge_agent_llm_config(
            agent_config,
            has_anthropic_key=llm_provider.has_anthropic_key(agent_config or {}),
        )
        orch_config = {
            **merged,
            "llm_model": merged.get("orchestrator_model"),
            "use_adaptive_thinking": True,
            "max_tokens": 4096,
        }
        subagent_config = {
            **merged,
            "llm_model": merged.get("subagent_model"),
            "max_tokens": 1024,
        }

        agents = {
            "consultar_agente_sintomas": SymptomAgent(),
            "consultar_agente_navegacao": NavigationAgent(),
            "consultar_agente_questionario": QuestionnaireAgent(),
            "consultar_agente_suporte_emocional": EmotionalSupportAgent(),
            "consultar_agente_secretaria": SchedulingSecretaryAgent(),
        }

        all_tool_calls: List[Dict[str, Any]] = []
        conv_messages = conversation_history + [{"role": "user", "content": message}]

        orchestrator_system = build_orchestrator_prompt(
            rag_context,
            appointment_query=appointment_query,
        )

        if trace is not None:
            trace.subagent_outputs = []
            trace.orchestrator_input = {
                "system_prompt": pack_trace_text(
                    orchestrator_system, TRACE_ORCH_SYSTEM_MAX_CHARS
                ),
                "messages": [
                    {
                        "role": m.get("role"),
                        "content": pack_trace_text(
                            (m.get("content") or ""), TRACE_ORCH_MESSAGE_MAX_CHARS
                        ),
                    }
                    for m in conv_messages
                ],
                "orchestrator_model": orch_config.get("llm_model"),
                "subagent_model": subagent_config.get("llm_model"),
            }

        async def routing_tool_executor(tool_name: str, tool_input: Dict[str, Any]) -> str:
            agent = agents.get(tool_name)
            if not agent:
                logger.warning(f"Unknown routing tool: {tool_name}")
                return json.dumps({"error": f"Subagente desconhecido: {tool_name}"})

            sub_ev: List[Dict[str, Any]] = []
            result = await agent.run(
                context=rag_context,
                conversation_history=conv_messages,
                config=subagent_config,
                usage_events=sub_ev if trace is not None else None,
                usage_step=f"subagent:{tool_name}",
            )

            all_tool_calls.extend(result.tool_calls)

            if result.error:
                logger.error(f"Subagent {tool_name} error: {result.error}")

            if trace is not None:
                trace.token_usage_events.extend(sub_ev)
                tool_names: List[str] = []
                for tc in result.tool_calls[:12]:
                    n = tc.get("name")
                    if not n and isinstance(tc.get("function"), dict):
                        n = tc["function"].get("name")
                    tool_names.append(n or "?")
                trace.subagent_outputs.append(
                    {
                        "routing_tool": tool_name,
                        "agent_name": result.agent_name,
                        "response": pack_trace_text(
                            result.response or "", TRACE_SUBAGENT_RESPONSE_MAX_CHARS
                        ),
                        "iterations": result.iterations,
                        "tool_calls_count": len(result.tool_calls),
                        "tool_names": tool_names,
                        "error": result.error,
                        "routing_tool_input": pack_trace_text(
                            json.dumps(tool_input, ensure_ascii=False),
                            4000,
                        ),
                        "token_usage": sum_usage_events(sub_ev),
                    }
                )
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

        try:
            orch_result = await llm_provider.run_agentic_loop(
                system_prompt=orchestrator_system,
                initial_messages=conv_messages,
                tools=ORCHESTRATOR_ROUTING_TOOLS,
                config=orch_config,
                tool_executor=routing_tool_executor,
                max_iterations=8,
                usage_events=(trace.token_usage_events if trace is not None else None),
                usage_step="orchestrator_multi_agent",
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
            "orchestrator_model": merged.get("orchestrator_model", ""),
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

    def _parse_tool_calls_to_actions(
        self,
        tool_calls: List[Dict[str, Any]],
        *,
        clinical_context: Optional[Dict[str, Any]] = None,
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

            elif name == "informar_agenda_navegacao":
                pending = _pending_navigation_steps(clinical_context) if clinical_context else []
                input_data: Dict[str, Any] = {"tool_call": tc}
                if clinical_context is not None:
                    input_data["pending_navigation_steps_count"] = len(pending)
                if inp.get("notas"):
                    input_data["notas"] = inp.get("notas")
                if inp.get("motivo"):
                    input_data["motivo"] = inp.get("motivo")
                audit_detail = inp.get("motivo") or inp.get("notas") or "sem notas"
                reasoning = (
                    "Subagente de navegação registrou resposta sobre agenda/prazos "
                    f"({audit_detail})."
                )[:500]
                decisions.append({
                    "decisionType": "APPOINTMENT_QUERY_HANDLED",
                    "reasoning": reasoning,
                    "confidence": 0.85,
                    "inputData": input_data,
                    "outputAction": {"type": "APPOINTMENT_RESPONSE"},
                    "requiresApproval": False,
                })

            elif name in (
                "criar_consulta",
                "reagendar_consulta",
                "cancelar_consulta",
                "confirmar_consulta",
            ):
                scheduling_action, scheduling_decision = self._parse_scheduling_tool_call(
                    tool_name=name,
                    tool_call=tc,
                    tool_input=inp,
                )
                if scheduling_action is not None:
                    actions.append(scheduling_action)
                decisions.append(scheduling_decision)

            elif name == "consultar_vagas_consulta":
                availability_action, availability_decision = self._parse_availability_tool_call(
                    tool_call=tc,
                    tool_input=inp,
                )
                if availability_action is not None:
                    actions.append(availability_action)
                decisions.append(availability_decision)

            else:
                logger.warning(f"Unknown tool call from LLM: {name}")

        return actions, decisions

    _SCHEDULING_TOOL_TO_ACTION = {
        "criar_consulta": "CREATE_CONSULTATION_APPOINTMENT",
        "reagendar_consulta": "RESCHEDULE_CONSULTATION_APPOINTMENT",
        "cancelar_consulta": "CANCEL_CONSULTATION_APPOINTMENT",
        "confirmar_consulta": "CONFIRM_CONSULTATION_APPOINTMENT",
    }

    _SCHEDULING_TOOL_TO_DECISION = {
        "criar_consulta": "APPOINTMENT_CREATED",
        "reagendar_consulta": "APPOINTMENT_RESCHEDULED",
        "cancelar_consulta": "APPOINTMENT_CANCELED",
        "confirmar_consulta": "APPOINTMENT_CONFIRMED",
    }

    _PATIENT_INTAKE_REQUIRED_FIELDS = (
        "name",
        "cpf",
        "birthDate",
        "gender",
        "phone",
    )

    def _parse_scheduling_tool_call(
        self,
        *,
        tool_name: str,
        tool_call: Dict[str, Any],
        tool_input: Dict[str, Any],
    ) -> tuple:
        """
        Defensive parser for the four scheduling-secretary tools.

        Returns:
            Tuple of (action_dict_or_None, decision_dict). Action is None
            when the tool call fails defensive validation; a
            SCHEDULING_INTAKE_PENDING decision is emitted so the backend has
            an auditable trace but never executes a mutation with
            incomplete data.
        """
        action_type = self._SCHEDULING_TOOL_TO_ACTION[tool_name]
        decision_type = self._SCHEDULING_TOOL_TO_DECISION[tool_name]

        confirmacao = bool(tool_input.get("confirmacao_paciente"))
        missing: List[str] = []

        if not confirmacao:
            missing.append("confirmacao_paciente")

        payload: Dict[str, Any] = {}
        scheduled_professional_id = tool_input.get("scheduledProfessionalId")
        expected_date = tool_input.get("expectedDate")
        patient_id = tool_input.get("patientId")
        patient_intake = tool_input.get("patientIntake") or None
        navigation_step_id = tool_input.get("navigationStepId")
        new_expected_date = tool_input.get("newExpectedDate")
        new_scheduled_professional_id = tool_input.get("newScheduledProfessionalId")
        motivo = tool_input.get("motivo") or tool_input.get("notas")

        if tool_name == "criar_consulta":
            if not scheduled_professional_id:
                missing.append("scheduledProfessionalId")
            if not expected_date:
                missing.append("expectedDate")

            has_existing_patient = bool(patient_id)
            intake_ok = False
            if isinstance(patient_intake, dict):
                intake_missing = [
                    f for f in self._PATIENT_INTAKE_REQUIRED_FIELDS
                    if not patient_intake.get(f)
                ]
                intake_ok = not intake_missing
                if not has_existing_patient and intake_missing:
                    missing.extend(f"patientIntake.{f}" for f in intake_missing)
            elif not has_existing_patient:
                missing.append("patientId|patientIntake")

            if scheduled_professional_id:
                payload["scheduledProfessionalId"] = scheduled_professional_id
            if expected_date:
                payload["expectedDate"] = expected_date
            if has_existing_patient:
                payload["patientId"] = patient_id
            if isinstance(patient_intake, dict) and intake_ok:
                payload["patientIntake"] = {
                    k: patient_intake.get(k)
                    for k in (
                        "name",
                        "cpf",
                        "birthDate",
                        "gender",
                        "phone",
                        "email",
                        "healthCoverageType",
                    )
                    if patient_intake.get(k) is not None
                }
            if tool_input.get("stepKey"):
                payload["stepKey"] = tool_input.get("stepKey")
            if tool_input.get("stepName"):
                payload["stepName"] = tool_input.get("stepName")
            if tool_input.get("notes"):
                payload["notes"] = tool_input.get("notes")

        else:
            if not navigation_step_id:
                missing.append("navigationStepId")
            if navigation_step_id:
                payload["navigationStepId"] = navigation_step_id

            if tool_name == "reagendar_consulta":
                if not new_expected_date:
                    missing.append("newExpectedDate")
                if new_expected_date:
                    payload["newExpectedDate"] = new_expected_date
                if new_scheduled_professional_id:
                    payload["newScheduledProfessionalId"] = new_scheduled_professional_id
                if motivo:
                    payload["motivo"] = motivo

            elif tool_name == "cancelar_consulta":
                if motivo:
                    payload["motivo"] = motivo

            elif tool_name == "confirmar_consulta":
                if tool_input.get("notas"):
                    payload["notas"] = tool_input.get("notas")

        if missing:
            sanitized_input = self._sanitize_scheduling_input(tool_input)
            reasoning = (
                f"Secretária solicitou {tool_name} mas faltam dados ou confirmação "
                f"explícita do paciente ({', '.join(missing[:6])}). "
                "Nenhuma mutação foi emitida; o agente deve continuar coletando."
            )[:500]
            decision = {
                "decisionType": "SCHEDULING_INTAKE_PENDING",
                "reasoning": reasoning,
                "confidence": 0.6,
                "inputData": {
                    "tool_name": tool_name,
                    "missing_fields": missing,
                    "tool_call": {
                        "name": tool_call.get("name"),
                        "input": sanitized_input,
                    },
                },
                "outputAction": {
                    "type": "SCHEDULING_INTAKE_PENDING",
                    "payload": {
                        "tool_name": tool_name,
                        "missing_fields": missing,
                    },
                },
                "requiresApproval": False,
            }
            return None, decision

        payload["confirmedByPatient"] = True
        sanitized_payload = self._sanitize_scheduling_payload(payload)
        action = {
            "type": action_type,
            "payload": payload,
            "requiresApproval": False,
            "source": "llm_tool_call",
        }
        decision = {
            "decisionType": decision_type,
            "reasoning": (
                f"Secretária validou tool {tool_name} com todos os campos obrigatórios "
                "e confirmação explícita do paciente."
            )[:500],
            "confidence": 0.9,
            "inputData": {
                "tool_name": tool_name,
                "payload_redacted": sanitized_payload,
            },
            "outputAction": {"type": action_type, "payload": payload},
            "requiresApproval": False,
        }
        return action, decision

    def _parse_availability_tool_call(
        self,
        *,
        tool_call: Dict[str, Any],
        tool_input: Dict[str, Any],
    ) -> tuple:
        """
        Defensive parser for `consultar_vagas_consulta` (read-only).

        Differs from `_parse_scheduling_tool_call`:
        - never requires `confirmacao_paciente` (no mutation)
        - emits action with `requiresApproval=False`
        - on incomplete payload, returns (None, SCHEDULING_INTAKE_PENDING decision)
          so the backend has an auditable trace but does NOT execute a backend
          read with a malformed range.
        """
        action_type = "CHECK_CONSULTATION_AVAILABILITY"
        decision_type = "APPOINTMENT_AVAILABILITY_QUERIED"

        scheduled_professional_id = tool_input.get("scheduledProfessionalId")
        step_key = tool_input.get("stepKey")
        range_from = tool_input.get("from")
        range_to = tool_input.get("to")
        preferred_date = tool_input.get("preferredDate")
        motivo = tool_input.get("motivo")

        missing: List[str] = []
        if not range_from:
            missing.append("from")
        if not range_to:
            missing.append("to")
        if not scheduled_professional_id and not step_key:
            missing.append("scheduledProfessionalId|stepKey")

        if missing:
            sanitized_input = self._sanitize_scheduling_input(tool_input)
            reasoning = (
                "Secretária pediu consulta de disponibilidade mas faltam dados "
                f"({', '.join(missing[:6])}). Nenhuma consulta foi emitida ao "
                "backend; o agente deve coletar o que falta."
            )[:500]
            decision = {
                "decisionType": "SCHEDULING_INTAKE_PENDING",
                "reasoning": reasoning,
                "confidence": 0.6,
                "inputData": {
                    "tool_name": "consultar_vagas_consulta",
                    "missing_fields": missing,
                    "tool_call": {
                        "name": tool_call.get("name"),
                        "input": sanitized_input,
                    },
                },
                "outputAction": {
                    "type": "SCHEDULING_INTAKE_PENDING",
                    "payload": {
                        "tool_name": "consultar_vagas_consulta",
                        "missing_fields": missing,
                    },
                },
                "requiresApproval": False,
            }
            return None, decision

        payload: Dict[str, Any] = {
            "from": range_from,
            "to": range_to,
        }
        if scheduled_professional_id:
            payload["scheduledProfessionalId"] = scheduled_professional_id
        if step_key:
            payload["stepKey"] = step_key
        if preferred_date:
            payload["preferredDate"] = preferred_date
        if motivo:
            payload["motivo"] = motivo

        # Texto livre do LLM — não persistir em decisão/auditoria (AgentDecisionLog).
        audit_payload = dict(payload)
        if audit_payload.get("motivo"):
            audit_payload["motivo"] = "[redacted]"

        action = {
            "type": action_type,
            "payload": payload,
            "requiresApproval": False,
            "source": "llm_tool_call",
        }
        decision = {
            "decisionType": decision_type,
            "reasoning": (
                "Secretária consultou disponibilidade real da agenda (read-only) "
                f"de {range_from} a {range_to}."
            )[:500],
            "confidence": 0.9,
            "inputData": {
                "tool_name": "consultar_vagas_consulta",
                "payload": audit_payload,
            },
            "outputAction": {"type": action_type, "payload": audit_payload},
            "requiresApproval": False,
        }
        return action, decision

    @staticmethod
    def _sanitize_scheduling_input(tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Remove PII bruta (cpf, telefone, email) antes de gravar no trace/decision."""
        if not isinstance(tool_input, dict):
            return {}
        sanitized = dict(tool_input)
        intake = sanitized.get("patientIntake")
        if isinstance(intake, dict):
            sanitized["patientIntake"] = {
                k: ("***" if k in ("cpf", "phone", "email") and v else v)
                for k, v in intake.items()
            }
        return sanitized

    @staticmethod
    def _sanitize_scheduling_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Mesma sanitização aplicada ao payload da decisão (auditoria sem PII)."""
        if not isinstance(payload, dict):
            return {}
        sanitized = dict(payload)
        intake = sanitized.get("patientIntake")
        if isinstance(intake, dict):
            sanitized["patientIntake"] = {
                k: ("***" if k in ("cpf", "phone", "email") and v else v)
                for k, v in intake.items()
            }
        return sanitized

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
        elif action_type == "CREATE_CONSULTATION_APPOINTMENT":
            identifier = (
                payload.get("scheduledProfessionalId", ""),
                payload.get("expectedDate", ""),
                payload.get("patientId", "") or "intake",
            )
        elif action_type in (
            "RESCHEDULE_CONSULTATION_APPOINTMENT",
            "CANCEL_CONSULTATION_APPOINTMENT",
            "CONFIRM_CONSULTATION_APPOINTMENT",
        ):
            identifier = (
                payload.get("navigationStepId", ""),
                payload.get("newExpectedDate", ""),
            )
        elif action_type == "CHECK_CONSULTATION_AVAILABILITY":
            identifier = (
                payload.get("scheduledProfessionalId", ""),
                payload.get("stepKey", ""),
                payload.get("from", ""),
                payload.get("to", ""),
                payload.get("preferredDate", ""),
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

    def _compile_clinical_rules_actions(
        self,
        clinical_rules_result,
        *,
        requires_escalation: bool,
    ) -> tuple:
        actions = []
        decisions = []

        if not clinical_rules_result or clinical_rules_result.disposition == "REMOTE_NURSING":
            return actions, decisions

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

        return actions, decisions

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

        clinical_actions, clinical_decisions = self._compile_clinical_rules_actions(
            clinical_rules_result,
            requires_escalation=requires_escalation,
        )
        actions.extend(clinical_actions)
        decisions.extend(clinical_decisions)

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
