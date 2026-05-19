import json
import pytest
import httpx

from src.agent.context_builder import context_builder
from src.agent.intent_classifier import (
    intent_classifier,
    INTENT_EMERGENCY,
    INTENT_APPOINTMENT_QUERY,
    INTENT_GENERAL,
)
from src.agent.protocol_engine import protocol_engine
from src.agent.questionnaire_engine import questionnaire_engine
from src.agent.symptom_analyzer import symptom_analyzer
from src.agent.clinical_rules import (
    ClinicalRulesEngine,
    ClinicalRulesResult,
    ER_IMMEDIATE,
    REMOTE_NURSING,
    RuleFinding,
)
from src.agent.prompts.orchestrator_prompt import (
    build_orchestrator_prompt,
    ORCHESTRATOR_ONCOLOGY_KNOWLEDGE_TOOL,
)
from src.agent.prompts.system_prompt import (
    LAYER1_PRECALCULATED_ORCHESTRATOR_NOTE,
    build_system_prompt,
)
from src.agent.tracer import AgentTracer
from src.agent.subagents import (
    SymptomAgent,
    NavigationAgent,
    QuestionnaireAgent,
    EmotionalSupportAgent,
)
from src.agent.orchestrator import orchestrator
from src.agent import orchestrator as orchestrator_module
from src.agent.llm_provider import llm_provider
from src.config.llm_defaults import merge_agent_llm_config
from src.services.backend_client import backend_client
# Importar sub-rotas diretamente — evita carregar `routes/__init__.py` (priority/LightGBM).
from src.routes.agent import generate_checkin_message
from src.routes.nurse import nurse_assist
from src.models.schemas import CheckInMessageRequest, NurseAssistRequest


def _turn_context_cache(structured_context: str = "ctx", clinical_context=None):
    return context_builder.cache_for_turn(
        structured_context,
        clinical_context=clinical_context if clinical_context is not None else {},
        conversation_history=[],
        agent_state={},
    )


def _minimal_clinical_context():
    return {
        "patient": {
            "name": "Paciente Teste",
            "cancerType": "breast",
            "stage": "II",
            "currentStage": "TREATMENT",
            "priorityCategory": "LOW",
            "priorityScore": 10,
            "performanceStatus": 1,
        },
        "treatments": [],
        "medications": [],
        "comorbidities": [],
        "navigationSteps": [],
    }


def test_context_builder_returns_text():
    out = context_builder.build(clinical_context=_minimal_clinical_context())
    assert isinstance(out, str)
    assert "Dados do Paciente" in out


def test_build_orchestrator_prompt_includes_layer1_note():
    orch = build_orchestrator_prompt("CTX_STUB")
    assert LAYER1_PRECALCULATED_ORCHESTRATOR_NOTE.splitlines()[0] in orch
    assert "CTX_STUB" in orch


def test_build_orchestrator_prompt_includes_priority_order():
    orch = build_orchestrator_prompt("CTX_STUB")
    assert "PRIORIDADE DE TÓPICOS" in orch
    assert "1. **Sintomas físicos" in orch
    assert "2. **Suporte emocional" in orch
    assert "3. **Agenda operacional" in orch
    assert "4. **Navegação" in orch
    assert "5. **Material educativo" in orch
    assert "6. **Questionário" in orch
    assert "Intenção explícita do paciente" in orch
    assert LAYER1_PRECALCULATED_ORCHESTRATOR_NOTE.splitlines()[0] in orch
    assert "CTX_STUB" in orch


def test_build_system_prompt_optional_layer1_note():
    base = build_system_prompt("apenas contexto", include_layer1_precalc_note=False)
    assert "TRIAGEM LAYER 1" not in base
    with_note = build_system_prompt("apenas contexto", include_layer1_precalc_note=True)
    assert "TRIAGEM LAYER 1 (MOTOR DETERMINÍSTICO" in with_note


@pytest.mark.asyncio
async def test_intent_classifier_no_llm_keys_returns_general(monkeypatch):
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: False)

    result = await intent_classifier.classify_async(
        message="oi",
        agent_state={},
        agent_config={},
    )

    assert result["intent"] == INTENT_GENERAL
    assert result["confidence"] == pytest.approx(0.5)
    assert result["skip_full_pipeline"] is False
    assert result["metadata"].get("source") == "no_llm"


@pytest.mark.asyncio
async def test_intent_classifier_respects_use_llm_intent_classifier_false(monkeypatch):
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    called = {"n": 0}

    async def _no_generate(*args, **kwargs):
        called["n"] += 1
        return "GREETING"

    monkeypatch.setattr(llm_provider, "generate", _no_generate)

    result = await intent_classifier.classify_async(
        message="oi",
        agent_state={},
        agent_config={"use_llm_intent_classifier": False},
    )

    assert called["n"] == 0
    assert result["intent"] == INTENT_GENERAL
    assert result["metadata"].get("source") == "no_llm"


@pytest.mark.asyncio
async def test_intent_classifier_uses_llm_when_keys_available(monkeypatch):
    async def _fake_generate(*args, **kwargs):
        return "APPOINTMENT_QUERY"

    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "generate", _fake_generate)

    agent_config: dict = {}
    expected = merge_agent_llm_config(
        agent_config,
        has_anthropic_key=llm_provider.has_anthropic_key(agent_config),
    )

    result = await intent_classifier.classify_async(
        message="não entendi",
        agent_state={},
        agent_config=agent_config,
    )

    assert result["intent"] == INTENT_APPOINTMENT_QUERY
    assert result["confidence"] == pytest.approx(0.85)
    assert result["skip_full_pipeline"] is False
    assert result["metadata"].get("source") == "llm"
    assert result["metadata"].get("llm_provider") == expected["llm_provider"]
    assert result["metadata"].get("llm_model") == expected["llm_model"]


@pytest.mark.asyncio
async def test_intent_classifier_llm_emergency_sets_escalate_immediately(monkeypatch):
    async def _fake_generate(*args, **kwargs):
        return "EMERGENCY"

    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "generate", _fake_generate)

    result = await intent_classifier.classify_async(
        message="estou sangrando muito",
        agent_state={},
        agent_config={},
    )

    assert result["intent"] == INTENT_EMERGENCY
    assert result["metadata"].get("escalate_immediately") is True
    assert result["metadata"].get("source") == "llm"


@pytest.mark.asyncio
async def test_intent_classifier_llm_unparseable_returns_llm_error(monkeypatch):
    async def _fake_generate(*args, **kwargs):
        return "%%%"

    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "generate", _fake_generate)

    agent_config: dict = {}
    expected = merge_agent_llm_config(
        agent_config,
        has_anthropic_key=llm_provider.has_anthropic_key(agent_config),
    )

    result = await intent_classifier.classify_async(
        message="qualquer coisa",
        agent_state={},
        agent_config=agent_config,
    )

    assert result["intent"] == INTENT_GENERAL
    assert result["metadata"].get("source") == "llm_error"
    assert result["metadata"].get("llm_provider") == expected["llm_provider"]
    assert result["metadata"].get("llm_model") == expected["llm_model"]


@pytest.mark.asyncio
async def test_intent_classifier_llm_dedupes_last_user_same_as_message(monkeypatch):
    captured: dict = {}

    async def _fake_generate(*args, **kwargs):
        captured["messages"] = kwargs.get("messages")
        return "QUESTION"

    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "generate", _fake_generate)

    history = [
        {"role": "assistant", "content": "Você tem alguma dúvida sobre o exame?"},
        {"role": "user", "content": "sim"},
    ]
    await intent_classifier.classify_async(
        message="sim",
        agent_state={},
        agent_config={},
        conversation_history=history,
    )

    msgs = captured.get("messages", [])
    assert len(msgs) == 2
    assert msgs[-1]["role"] == "user"
    assert msgs[-1]["content"] == "sim"
    assert sum(1 for m in msgs if m.get("role") == "user" and m.get("content") == "sim") == 1


@pytest.mark.asyncio
async def test_intent_classifier_llm_appends_current_when_last_user_differs(monkeypatch):
    captured: dict = {}

    async def _fake_generate(*args, **kwargs):
        captured["messages"] = kwargs.get("messages")
        return "QUESTION"

    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "generate", _fake_generate)

    history = [{"role": "user", "content": "como está o meu tratamento?"}]
    await intent_classifier.classify_async(
        message="e quanto ao exame de sangue?",
        agent_state={},
        agent_config={},
        conversation_history=history,
    )

    msgs = captured.get("messages", [])
    assert len(msgs) == 2
    assert msgs[-1]["role"] == "user"
    assert "sangue" in msgs[-1]["content"]


@pytest.mark.asyncio
async def test_intent_classifier_truncates_intent_messages_to_config(monkeypatch):
    captured: dict = {}

    async def _fake_generate(*args, **kwargs):
        captured["messages"] = kwargs.get("messages")
        return "GENERAL"

    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "generate", _fake_generate)

    history = [{"role": "user", "content": f"msg{i}"} for i in range(15)]
    await intent_classifier.classify_async(
        message="última",
        agent_state={},
        agent_config={"intent_classifier_history_messages": 5},
        conversation_history=history,
    )

    msgs = captured.get("messages", [])
    assert len(msgs) == 5
    assert msgs[-1]["content"] == "última"
    assert msgs[0]["content"] == "msg11"


@pytest.mark.asyncio
async def test_orchestrator_passes_conversation_history_to_multi_agent_loop(monkeypatch):
    captured: dict = {}

    async def _spy_run_agentic_loop(*args, **kwargs):
        captured["initial_messages"] = kwargs.get("initial_messages")
        return {
            "response": "ok",
            "tool_calls": [],
            "iterations": 1,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(llm_provider, "run_agentic_loop", _spy_run_agentic_loop)
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "has_anthropic_key", lambda cfg=None: True)

    hist = [{"role": "user", "content": "oi"}]
    await orchestrator.process(
        {
            "message": "tudo bem",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": _minimal_clinical_context(),
            "protocol": None,
            "conversation_history": hist,
            "agent_state": {},
            "agent_config": {},
        }
    )

    msgs = captured.get("initial_messages") or []
    assert msgs and msgs[-1].get("role") == "user"
    assert msgs[-1].get("content") == "tudo bem"


def test_protocol_engine_evaluate_returns_actions_list():
    actions = protocol_engine.evaluate(
        cancer_type="colorectal",
        journey_stage="TREATMENT",
        symptom_analysis={"detectedSymptoms": []},
        agent_state={},
        protocol=None,
    )
    assert isinstance(actions, list)


def test_questionnaire_engine_esas_state_and_question():
    state = questionnaire_engine.build_initial_state("ESAS")
    question = questionnaire_engine.get_current_question(state)
    assert state["type"] == "ESAS"
    assert isinstance(question, str)
    assert "0 a 10" in question


@pytest.mark.asyncio
async def test_symptom_analyzer_keyword_only():
    result = await symptom_analyzer.analyze(
        message="Estou com febre e dor muito forte",
        clinical_context=_minimal_clinical_context(),
        cancer_type="breast",
        use_llm=False,
        llm_config=None,
    )
    assert isinstance(result, dict)
    assert "detectedSymptoms" in result
    assert len(result["detectedSymptoms"]) >= 1
    assert "_symptomLlmMeta" not in result


@pytest.mark.asyncio
async def test_symptom_analyzer_parses_function_arguments_from_llm_tools(monkeypatch):
    async def _fake_generate_with_tools(*args, **kwargs):
        return {
            "tool_calls": [
                {
                    "name": "analyze_symptoms",
                    "function": {
                        "name": "analyze_symptoms",
                        "arguments": '{"symptoms":[{"name":"nausea","severity":"HIGH","confidence":0.92,"action":"ALERT_NURSING"}],"escalation_reason":"nausea importante"}',
                    },
                }
            ]
        }

    monkeypatch.setattr(llm_provider, "generate_with_tools", _fake_generate_with_tools)

    llm_cfg = {"llm_provider": "openai", "openai_api_key": "sk-test"}
    expected = merge_agent_llm_config(
        llm_cfg,
        has_anthropic_key=llm_provider.has_anthropic_key(llm_cfg),
    )

    result = await symptom_analyzer.analyze(
        message="estou muito mal hoje",
        clinical_context=_minimal_clinical_context(),
        cancer_type="breast",
        use_llm=True,
        llm_config=llm_cfg,
    )
    assert any(s.get("name") == "nausea" for s in result["detectedSymptoms"])
    meta = result.get("_symptomLlmMeta")
    assert meta is not None
    assert meta.get("called") is True
    assert meta.get("provider") == expected["llm_provider"]
    assert meta.get("model") == expected["llm_model"]


def test_clinical_rules_no_symptoms_remote_nursing():
    engine = ClinicalRulesEngine()
    result = engine.evaluate(
        symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {}}},
        clinical_context={
            "patient": {"age": 55},
            "treatments": [],
            "medications": [],
            "comorbidities": [],
            "performanceStatusHistory": [],
        },
    )
    assert result.disposition == REMOTE_NURSING


def test_tracer_basic_lifecycle():
    tr = AgentTracer(maxlen=5)
    trace = tr.start_trace("p1", "t1")
    sp = tr.start_span(trace, "phase1")
    sp.finish(ok=True)
    tr.finish_trace(trace)
    traces = tr.get_traces(limit=1, tenant_id="t1")
    assert len(traces) == 1
    assert traces[0]["pipeline_path"] == "main"


def test_subagents_have_tools():
    assert len(SymptomAgent().tools) > 0
    assert len(NavigationAgent().tools) > 0
    assert len(QuestionnaireAgent().tools) > 0
    assert len(EmotionalSupportAgent().tools) > 0


@pytest.mark.asyncio
async def test_orchestrator_greeting_fast_path(monkeypatch):
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: False)

    result = await orchestrator.process(
        {
            "message": "oi",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": _minimal_clinical_context(),
            "protocol": None,
            "conversation_history": [],
            "agent_state": {},
            "agent_config": {},
        }
    )
    assert isinstance(result, dict)
    assert "response" in result
    assert isinstance(result.get("actions", []), list)
    assert result.get("clinical_disposition") == REMOTE_NURSING


@pytest.mark.asyncio
async def test_orchestrator_greeting_fast_path_respects_layer1_er(monkeypatch):
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: False)

    result = await orchestrator.process(
        {
            "message": "dor 9/10",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": _minimal_clinical_context(),
            "protocol": None,
            "conversation_history": [],
            "agent_state": {},
            "agent_config": {"use_llm_symptom_analysis": False},
        }
    )

    assert result["clinical_disposition"] == ER_IMMEDIATE
    assert "registrada" in result["response"].lower() or "enfermagem" in result["response"].lower()


@pytest.mark.asyncio
async def test_orchestrator_llm_no_snapshots_skips_deterministic_fallback(monkeypatch):
    """Sem snapshots da tool de triagem: contrato explícito, sem span triage_fallback_last_resort."""

    async def _fake_run_agentic_loop(*args, **kwargs):
        return {
            "response": "Resposta do multi-agent sem tool de triagem.",
            "tool_calls": [],
            "iterations": 1,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "has_anthropic_key", lambda cfg=None: True)
    monkeypatch.setattr(
        "src.agent.orchestrator.protocol_engine.evaluate",
        lambda **kwargs: [],
    )

    result = await orchestrator.process(
        {
            "message": "quando é minha próxima consulta?",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": _minimal_clinical_context(),
            "protocol": None,
            "conversation_history": [],
            "agent_state": {},
            "agent_config": {"use_llm_symptom_analysis": False},
        }
    )

    assert result["clinical_disposition"] == REMOTE_NURSING
    assert "não foi invocado" in (result.get("clinical_disposition_reason") or "").lower()
    assert result.get("clinical_rules_findings") == []
    trace = result.get("pipeline_trace") or {}
    assert trace.get("triage_skipped") is True
    assert trace.get("triage_source") == "skipped_no_snapshots"
    span_names = [s.get("name") for s in trace.get("spans", [])]
    assert "triage_fallback_last_resort" not in span_names


@pytest.mark.asyncio
async def test_orchestrator_symptom_subagent_invoked_layer1_without_triage_tool(
    monkeypatch,
):
    """Orquestrador chama subagente de sintomas; subagente não chama executar_triagem_seguranca."""
    from src.agent.subagents.base_subagent import SubAgentResult

    async def _fake_symptom_run(self, **kwargs):
        return SubAgentResult(
            agent_name="symptom_agent",
            response="Relato de febre analisado sem invocar tool de triagem.",
            tool_calls=[],
            iterations=1,
        )

    monkeypatch.setattr(SymptomAgent, "run", _fake_symptom_run)

    async def _fake_run_agentic_loop(*args, **kwargs):
        tool_executor = kwargs.get("tool_executor")
        if tool_executor:
            await tool_executor("consultar_agente_sintomas", {"foco": "febre"})
        return {
            "response": "Orientação sobre febre.",
            "tool_calls": [{"name": "consultar_agente_sintomas", "input": {}}],
            "iterations": 1,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "has_anthropic_key", lambda cfg=None: True)
    monkeypatch.setattr(
        "src.agent.orchestrator.protocol_engine.evaluate",
        lambda **kwargs: [],
    )

    result = await orchestrator.process(
        {
            "message": "estou com febre 38 graus desde ontem",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": _minimal_clinical_context(),
            "protocol": None,
            "conversation_history": [],
            "agent_state": {},
            "agent_config": {"use_llm_symptom_analysis": False},
        }
    )

    trace = result.get("pipeline_trace") or {}
    assert trace.get("triage_skipped") is False
    assert trace.get("triage_source") == "symptom_subagent_invoked"
    assert "consultar_agente_sintomas" in (trace.get("subagents_called") or [])


@pytest.mark.asyncio
async def test_orchestrator_agenda_question_during_esas_keeps_llm_response(
    monkeypatch,
):
    """Com ESAS ativo, pergunta longa sobre agenda não consome o turno como próxima pergunta ESAS."""
    llm_reply = "Segue o que encontrei nas suas etapas de navegação."

    async def _fake_run_agentic_loop(*args, **kwargs):
        return {
            "response": llm_reply,
            "tool_calls": [],
            "iterations": 1,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "has_anthropic_key", lambda cfg=None: True)
    monkeypatch.setattr(
        "src.agent.orchestrator.protocol_engine.evaluate",
        lambda **kwargs: [],
    )

    q_state = questionnaire_engine.build_initial_state("ESAS")

    result = await orchestrator.process(
        {
            "message": "quando é minha próxima consulta?",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": _minimal_clinical_context(),
            "protocol": None,
            "conversation_history": [],
            "agent_state": {"active_questionnaire": q_state},
            "agent_config": {"use_llm_symptom_analysis": False},
        }
    )

    assert result["response"] == llm_reply
    assert "cansaço" not in result["response"].lower()
    assert result["new_state"].get("active_questionnaire")


@pytest.mark.asyncio
async def test_orchestrator_symptom_report_with_active_questionnaire_preserves_multi_agent_response(
    monkeypatch,
):
    """Com ESAS ativo, relato explícito de sintoma não consome o turno como próxima pergunta ESAS."""
    async def _fake_apply_triage(*args, **kwargs):
        sa = {
            "detectedSymptoms": [{"name": "náusea", "severity": 2}],
            "overallSeverity": "LOW",
            "requiresEscalation": False,
            "structuredData": {},
        }
        cr = ClinicalRulesResult(
            disposition=REMOTE_NURSING,
            reasoning="triage test",
            findings=[],
            requires_immediate_action=False,
        )
        return sa, cr

    monkeypatch.setattr(orchestrator, "_apply_deterministic_triage", _fake_apply_triage)

    llm_reply = "Orientação sobre náusea sem interromper o questionário por próximo item ESAS."

    async def _fake_run_agentic_loop(*args, **kwargs):
        return {
            "response": llm_reply,
            "tool_calls": [],
            "iterations": 1,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "has_anthropic_key", lambda cfg=None: True)
    monkeypatch.setattr(
        "src.agent.orchestrator.protocol_engine.evaluate",
        lambda **kwargs: [],
    )

    q_state = questionnaire_engine.build_initial_state("ESAS")

    result = await orchestrator.process(
        {
            "message": "estou com bastante náusea desde ontem",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": _minimal_clinical_context(),
            "protocol": None,
            "conversation_history": [],
            "agent_state": {"active_questionnaire": q_state},
            "agent_config": {"use_llm_symptom_analysis": False},
        }
    )

    assert result["response"] == llm_reply
    assert "cansaço" not in result["response"].lower()
    assert result["new_state"].get("active_questionnaire")


def test_pending_navigation_steps_filter():
    from src.agent.orchestrator import _pending_navigation_steps

    ctx = {
        "navigationSteps": [
            {"status": "PENDING", "stepName": "Colonoscopia", "dueDate": "2026-04-10"},
            {"status": "COMPLETED", "stepName": "Outra"},
        ],
    }
    pending = _pending_navigation_steps(ctx)
    assert len(pending) == 1
    assert pending[0]["stepName"] == "Colonoscopia"


def test_parse_informar_agenda_navegacao_decision():
    ctx = {
        "navigationSteps": [
            {"status": "PENDING", "stepName": "A"},
            {"status": "SCHEDULED", "stepName": "B"},
            {"status": "COMPLETED", "stepName": "C"},
        ],
    }
    tool_calls = [{"name": "informar_agenda_navegacao", "input": {"notas": "Expliquei prazos."}}]
    actions, decisions = orchestrator._parse_tool_calls_to_actions(
        tool_calls,
        clinical_context=ctx,
    )
    assert actions == []
    assert len(decisions) == 1
    d = decisions[0]
    assert d["decisionType"] == "APPOINTMENT_QUERY_HANDLED"
    assert d["outputAction"]["type"] == "APPOINTMENT_RESPONSE"
    assert d["inputData"].get("pending_navigation_steps_count") == 2


@pytest.mark.asyncio
async def test_orchestrator_active_questionnaire_allows_normal_answer():
    q_state = questionnaire_engine.build_initial_state("ESAS")

    result = await orchestrator.process(
        {
            "message": "2",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": _minimal_clinical_context(),
            "protocol": None,
            "conversation_history": [],
            "agent_state": {"active_questionnaire": q_state},
            "agent_config": {
                "use_llm_symptom_analysis": False,
                "use_llm_intent_classifier": False,
            },
        }
    )

    assert result["new_state"].get("active_questionnaire")
    assert isinstance(result.get("symptom_analysis"), (dict, type(None)))
    assert any(
        decision.get("outputAction", {}).get("type") == "CONTINUE_QUESTIONNAIRE"
        for decision in result["decisions"]
    )


@pytest.mark.asyncio
async def test_orchestrator_active_questionnaire_triage_overrides_er_immediate(monkeypatch):
    """Garante merge pós-main: Layer 1 imediato prevalece e não continua ESAS na mesma resposta."""

    llm_reply = "Resposta do multi-agente que não pode ser descartada."

    async def _fake_run_agentic_loop(*args, **kwargs):
        return {
            "response": llm_reply,
            "tool_calls": [],
            "iterations": 1,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "has_anthropic_key", lambda cfg=None: True)

    def _merge_snapshots_stub(_snaps):
        sa = {
            "detectedSymptoms": [{"name": "dor", "severity": 9}],
            "overallSeverity": "CRITICAL",
            "requiresEscalation": True,
            "structuredData": {"scales": {"pain": 9}},
        }
        cr = ClinicalRulesResult(
            disposition=ER_IMMEDIATE,
            reasoning="dor severa",
            findings=[
                RuleFinding(
                    rule_id="R08_SEVERE_PAIN",
                    disposition=ER_IMMEDIATE,
                    reason="Dor >= 9",
                    confidence=1.0,
                    evidence={},
                )
            ],
            requires_immediate_action=True,
        )
        return sa, cr

    monkeypatch.setattr("src.agent.orchestrator._merge_triage_snapshots", _merge_snapshots_stub)

    monkeypatch.setattr(
        "src.agent.orchestrator.protocol_engine.evaluate",
        lambda **kwargs: [],
    )

    q_state = questionnaire_engine.build_initial_state("ESAS")

    result = await orchestrator.process(
        {
            "message": "dor 9/10",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": _minimal_clinical_context(),
            "protocol": None,
            "conversation_history": [],
            "agent_state": {"active_questionnaire": q_state},
            "agent_config": {
                "use_llm_symptom_analysis": False,
                "use_llm_intent_classifier": False,
            },
        }
    )

    assert result["clinical_disposition"] == ER_IMMEDIATE
    assert any(
        finding["rule_id"] == "R08_SEVERE_PAIN"
        for finding in result["clinical_rules_findings"]
    )
    assert any(
        action["type"] == "UPDATE_CLINICAL_DISPOSITION"
        for action in result["actions"]
    )
    assert "interromper o questionário" in result["response"]
    assert llm_reply in result["response"]
    assert "\n\n---\n\n" in result["response"]
    assert not any(
        decision.get("outputAction", {}).get("type") == "CONTINUE_QUESTIONNAIRE"
        for decision in result["decisions"]
    )


@pytest.mark.asyncio
async def test_orchestrator_start_questionnaire_from_llm_merges_pipeline_response(monkeypatch):
    """START via tool do LLM: bloco ESAS primeiro, depois separador, depois texto do multi-agente."""
    pipeline = "Resposta conversacional do multi-agente."

    async def _fake_pipeline(_self, **kwargs):
        return (
            pipeline,
            [{"name": "iniciar_questionario", "input": {"tipo": "ESAS", "motivo": "check-in"}}],
            {"provider": "anthropic", "model": "claude-test"},
            {"orchestrator_iterations": 1, "orchestrator_tool_names": ["iniciar_questionario"]},
        )

    monkeypatch.setattr(
        orchestrator_module.AgentOrchestrator,
        "_run_multi_agent_pipeline",
        _fake_pipeline,
    )
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "has_anthropic_key", lambda cfg=None: True)
    monkeypatch.setattr(
        "src.agent.orchestrator.protocol_engine.evaluate",
        lambda **kwargs: [],
    )
    monkeypatch.setattr("src.agent.orchestrator._merge_triage_snapshots", lambda snaps: None)

    result = await orchestrator.process(
        {
            "message": "Quero preencher o questionário de hoje",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": _minimal_clinical_context(),
            "protocol": None,
            "conversation_history": [],
            "agent_state": {},
            "agent_config": {"use_llm_symptom_analysis": False},
        }
    )

    assert pipeline in result["response"]
    assert "\n\n---\n\n" in result["response"]
    parts = result["response"].split("\n\n---\n\n")
    assert len(parts) == 2
    assert parts[1].strip() == pipeline


def test_orchestrator_merge_actions_keeps_distinct_questionnaires():
    llm_actions = [{"type": "START_QUESTIONNAIRE", "payload": {"questionnaireType": "ESAS"}}]
    rule_actions = [{"type": "START_QUESTIONNAIRE", "payload": {"questionnaireType": "PRO_CTCAE"}}]
    merged = orchestrator._merge_actions(llm_actions, rule_actions)
    q_types = [a.get("payload", {}).get("questionnaireType") for a in merged]
    assert "ESAS" in q_types
    assert "PRO_CTCAE" in q_types


@pytest.mark.asyncio
async def test_orchestrator_multi_agent_pipeline_returns_provider_meta(monkeypatch):
    async def _fake_run_agentic_loop(*args, **kwargs):
        return {
            "response": "ok",
            "tool_calls": [],
            "iterations": 1,
            "provider": "openai",
            "model": "gpt-4o-mini",
        }

    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)

    response, tool_calls, llm_meta, span_detail = await orchestrator._run_multi_agent_pipeline(
        message="oi",
        turn_context_cache=_turn_context_cache("ctx"),
        conversation_history=[],
        agent_config={},
        trace=None,
        clinical_context={},
    )

    assert response == "ok"
    assert tool_calls == []
    assert llm_meta["provider"] == "openai"
    assert llm_meta["model"] == "gpt-4o-mini"
    assert span_detail["orchestrator_iterations"] == 1
    assert span_detail["orchestrator_tool_names"] == []


@pytest.mark.asyncio
async def test_oncology_knowledge_tool_calls_retrieve_with_mock(monkeypatch):
    """Tool buscar_conhecimento_oncologico usa knowledge_rag.retrieve (mock, sem FAISS)."""
    retrieve_calls: list[dict] = []

    def fake_retrieve(query, cancer_type=None, top_k=None):
        retrieve_calls.append({"query": query, "cancer_type": cancer_type})
        return [
            {
                "id": "doc-test",
                "title": "Neutropenia",
                "content": "Conteúdo educativo de teste.",
                "category": "emergencia",
                "score": 0.91,
            }
        ]

    monkeypatch.setattr(
        orchestrator_module.knowledge_rag,
        "retrieve",
        fake_retrieve,
    )
    monkeypatch.setattr(
        orchestrator_module.knowledge_rag,
        "format_context",
        lambda passages: f"## MOCK\n{passages[0]['title']}" if passages else "",
    )

    async def _fake_run_agentic_loop(*args, **kwargs):
        tool_executor = kwargs.get("tool_executor")
        raw = await tool_executor(
            ORCHESTRATOR_ONCOLOGY_KNOWLEDGE_TOOL,
            {"consulta": "febre depois da quimioterapia"},
        )
        data = json.loads(raw)
        assert data["status"] == "ok"
        assert data["passagens"] == 1
        assert "Neutropenia" in data["markdown"]
        return {
            "response": "ok com base no corpus",
            "tool_calls": [],
            "iterations": 1,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)

    ctx = _minimal_clinical_context()
    _, _, _, _ = await orchestrator._run_multi_agent_pipeline(
        message="oi",
        turn_context_cache=_turn_context_cache("estruturado", ctx),
        conversation_history=[],
        agent_config={},
        trace=None,
        clinical_context=ctx,
    )

    assert len(retrieve_calls) == 1
    assert "febre" in retrieve_calls[0]["query"].lower()


def test_context_builder_rag_query_and_cancer_type_helpers():
    hist = [{"role": "assistant", "content": "Como está sua náusea hoje?"}]
    q = context_builder.rag_query_for_message("sim", hist)
    assert "náusea" in q.lower()

    cc = _minimal_clinical_context()
    assert context_builder.extract_cancer_type_for_rag(cc) == "BREAST"


@pytest.mark.asyncio
async def test_secretary_availability_tool_executes_same_turn_and_mutation_stays_queued(
    monkeypatch,
):
    availability_calls = []
    professional_calls = []

    async def _fake_availability(**kwargs):
        availability_calls.append(kwargs)
        return {
            "slots": ["2026-06-01T12:00:00.000Z"],
            "query": kwargs["payload"],
        }

    async def _fake_professionals(**kwargs):
        professional_calls.append(kwargs)
        return {
            "professionals": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "Dra Onco",
                    "consultationStepKeys": ["specialist_consultation"],
                }
            ]
        }

    async def _fake_run_agentic_loop(*args, **kwargs):
        step = kwargs.get("usage_step")
        tool_executor = kwargs.get("tool_executor")
        if step == "orchestrator_multi_agent":
            routing_result = await tool_executor("consultar_agente_secretaria", {})
            assert "Horário real recebido" in routing_result
            return {
                "response": "A secretária trouxe vagas reais.",
                "tool_calls": [],
                "iterations": 1,
                "provider": "anthropic",
                "model": "claude-test",
            }

        assert step == "subagent:consultar_agente_secretaria"
        assert tool_executor is not None
        professionals_result = await tool_executor(
            "listar_profissionais_consulta",
            {"stepKey": "specialist_consultation"},
        )
        availability_result = await tool_executor(
            "consultar_vagas_consulta",
            {
                "scheduledProfessionalId": "550e8400-e29b-41d4-a716-446655440000",
                "stepKey": "navigation_consultation",
                "from": "2026-06-01T00:00:00.000Z",
                "to": "2026-06-02T00:00:00.000Z",
            },
        )
        queued_result = await tool_executor(
            "criar_consulta",
            {"confirmacao_paciente": True},
        )

        assert "Dra Onco" in professionals_result
        assert "2026-06-01T12:00:00.000Z" in availability_result
        assert '"status": "queued"' in queued_result
        return {
            "response": "Horário real recebido: 01/06 às 09h.",
            "tool_calls": [
                {
                    "name": "listar_profissionais_consulta",
                    "input": {"stepKey": "specialist_consultation"},
                },
                {
                    "name": "consultar_vagas_consulta",
                    "input": {
                        "scheduledProfessionalId": "550e8400-e29b-41d4-a716-446655440000",
                        "stepKey": "navigation_consultation",
                        "from": "2026-06-01T00:00:00.000Z",
                        "to": "2026-06-02T00:00:00.000Z",
                    },
                },
                {
                    "name": "criar_consulta",
                    "input": {"confirmacao_paciente": True},
                },
            ],
            "iterations": 2,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(
        backend_client,
        "get_consultation_availability",
        _fake_availability,
    )
    monkeypatch.setattr(
        backend_client,
        "list_consultation_professionals",
        _fake_professionals,
    )
    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)

    response, tool_calls, _, _ = await orchestrator._run_multi_agent_pipeline(
        message="Quais horários tem para consulta?",
        turn_context_cache=_turn_context_cache("ctx"),
        conversation_history=[],
        agent_config={},
        tenant_id="tenant-1",
        trace=None,
        clinical_context={},
    )

    assert response == "A secretária trouxe vagas reais."
    assert len(professional_calls) == 1
    assert professional_calls[0]["tenant_id"] == "tenant-1"
    assert len(availability_calls) == 1
    assert availability_calls[0]["tenant_id"] == "tenant-1"
    assert [tc["name"] for tc in tool_calls] == [
        "consultar_vagas_consulta",
        "criar_consulta",
    ]


@pytest.mark.asyncio
async def test_secretary_availability_tool_backend_error_returns_controlled_json(
    monkeypatch,
):
    """Mesmo turno: falha do backend interno vira JSON com availability_unavailable (sem raise)."""

    async def _fail(**kwargs):
        raise httpx.ConnectError("simulado")

    monkeypatch.setattr(
        backend_client,
        "get_consultation_availability",
        _fail,
    )

    async def _fake_run_agentic_loop(*args, **kwargs):
        step = kwargs.get("usage_step")
        tool_executor = kwargs.get("tool_executor")
        if step == "orchestrator_multi_agent":
            await tool_executor("consultar_agente_secretaria", {})
            return {
                "response": "Não consegui obter vagas agora.",
                "tool_calls": [],
                "iterations": 1,
                "provider": "anthropic",
                "model": "claude-test",
            }

        assert step == "subagent:consultar_agente_secretaria"
        assert tool_executor is not None
        availability_result = await tool_executor(
            "consultar_vagas_consulta",
            {
                "scheduledProfessionalId": "550e8400-e29b-41d4-a716-446655440000",
                "stepKey": "navigation_consultation",
                "from": "2026-06-01T00:00:00.000Z",
                "to": "2026-06-02T00:00:00.000Z",
            },
        )
        data = json.loads(availability_result)
        assert data["status"] == "error"
        assert data["error"] == "availability_unavailable"
        return {
            "response": "Não consegui obter vagas agora.",
            "tool_calls": [
                {
                    "name": "consultar_vagas_consulta",
                    "input": {
                        "scheduledProfessionalId": "550e8400-e29b-41d4-a716-446655440000",
                        "stepKey": "navigation_consultation",
                        "from": "2026-06-01T00:00:00.000Z",
                        "to": "2026-06-02T00:00:00.000Z",
                    },
                }
            ],
            "iterations": 1,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)

    response, tool_calls, _, _ = await orchestrator._run_multi_agent_pipeline(
        message="Tem vaga amanhã?",
        turn_context_cache=_turn_context_cache("ctx"),
        conversation_history=[],
        agent_config={},
        tenant_id="tenant-1",
        trace=None,
        clinical_context={},
    )

    assert "vagas" in response.lower()
    # Falha da tool síncrona não deve virar CHECK_CONSULTATION_AVAILABILITY tardio.
    assert tool_calls == []


@pytest.mark.asyncio
async def test_secretary_multiple_availability_calls_keep_closest_slot(monkeypatch):
    async def _fake_availability(**kwargs):
        professional_id = kwargs["payload"]["scheduledProfessionalId"]
        if professional_id.endswith("0001"):
            return {"slots": ["2026-07-14T11:00:00.000Z"], "query": kwargs["payload"]}
        return {"slots": ["2026-06-02T11:00:00.000Z"], "query": kwargs["payload"]}

    async def _fake_run_agentic_loop(*args, **kwargs):
        step = kwargs.get("usage_step")
        tool_executor = kwargs.get("tool_executor")
        if step == "orchestrator_multi_agent":
            await tool_executor("consultar_agente_secretaria", {})
            return {
                "response": "A secretária encontrou a vaga mais próxima.",
                "tool_calls": [],
                "iterations": 1,
                "provider": "anthropic",
                "model": "claude-test",
            }

        assert tool_executor is not None
        later = {
            "scheduledProfessionalId": "550e8400-e29b-41d4-a716-446655440001",
            "stepKey": "specialist_consultation",
            "from": "2026-05-14T00:00:00.000Z",
            "to": "2026-07-20T23:59:59.000Z",
        }
        earlier = {
            "scheduledProfessionalId": "550e8400-e29b-41d4-a716-446655440002",
            "stepKey": "specialist_consultation",
            "from": "2026-05-14T00:00:00.000Z",
            "to": "2026-07-20T23:59:59.000Z",
        }
        await tool_executor("consultar_vagas_consulta", later)
        await tool_executor("consultar_vagas_consulta", earlier)
        return {
            "response": "Comparei os profissionais.",
            "tool_calls": [
                {"name": "consultar_vagas_consulta", "input": later},
                {"name": "consultar_vagas_consulta", "input": earlier},
            ],
            "iterations": 2,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(
        backend_client,
        "get_consultation_availability",
        _fake_availability,
    )
    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)

    _, tool_calls, _, _ = await orchestrator._run_multi_agent_pipeline(
        message="Qual profissional tem a vaga mais próxima?",
        turn_context_cache=_turn_context_cache("ctx"),
        conversation_history=[],
        agent_config={},
        tenant_id="tenant-1",
        trace=None,
        clinical_context={},
    )

    assert len(tool_calls) == 1
    assert tool_calls[0]["input"]["scheduledProfessionalId"].endswith("0002")


@pytest.mark.asyncio
async def test_checkin_message_accepts_string_llm_response(monkeypatch):
    async def _fake_generate(*args, **kwargs):
        return "Olá Ana! Como você está hoje?"

    monkeypatch.setattr(llm_provider, "generate", _fake_generate)

    req = CheckInMessageRequest(
        patient_id="p1",
        tenant_id="t1",
        action_type="CHECK_IN",
        clinical_context={"patient": {"name": "Ana"}},
        agent_config={"api_key": "dummy", "llm_provider": "openai", "llm_model": "gpt-4o-mini"},
    )
    resp = await generate_checkin_message(req)
    assert resp.used_llm is True
    assert "Ana" in resp.message


@pytest.mark.asyncio
async def test_nurse_assist_uses_messages_signature(monkeypatch):
    async def _fake_generate_with_tools(*args, **kwargs):
        assert "messages" in kwargs
        assert "user_message" not in kwargs
        return {
            "tool_calls": [],
            "content": "Resumo rápido de enfermagem.",
        }

    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "has_anthropic_key", lambda cfg=None: False)
    monkeypatch.setattr(llm_provider, "generate_with_tools", _fake_generate_with_tools)

    req = NurseAssistRequest(
        patient_id="p1",
        patient_name="Maria Silva",
        conversation_history=[],
        navigation_steps=[],
        recent_symptoms=[],
        alerts=[],
    )
    resp = await nurse_assist(req)
    assert isinstance(resp.summary, str)
    assert resp.used_llm is True
