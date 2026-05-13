import pytest

from src.agent.context_builder import context_builder
from src.agent.intent_classifier import (
    intent_classifier,
    INTENT_EMERGENCY,
    INTENT_GREETING,
    INTENT_APPOINTMENT_QUERY,
    INTENT_GENERAL,
    INTENT_SYMPTOM_REPORT,
)
from src.agent.protocol_engine import protocol_engine
from src.agent.questionnaire_engine import questionnaire_engine
from src.agent.symptom_analyzer import symptom_analyzer
from src.agent.clinical_rules import (
    ClinicalRulesEngine,
    ClinicalRulesResult,
    ER_IMMEDIATE,
    REMOTE_NURSING,
)
from src.agent.prompts.orchestrator_prompt import build_orchestrator_prompt
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
from src.agent.llm_provider import llm_provider
# Importar sub-rotas diretamente — evita carregar `routes/__init__.py` (priority/LightGBM).
from src.routes.agent import generate_checkin_message
from src.routes.nurse import nurse_assist
from src.models.schemas import CheckInMessageRequest, NurseAssistRequest


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


def test_build_orchestrator_prompt_appointment_query_note():
    orch = build_orchestrator_prompt("CTX_STUB", appointment_query=True)
    assert "CONSULTA DE AGENDA" in orch
    assert "informar_agenda_navegacao" in orch
    assert "CTX_STUB" in orch
    assert LAYER1_PRECALCULATED_ORCHESTRATOR_NOTE.splitlines()[0] not in orch


def test_build_system_prompt_optional_layer1_note():
    base = build_system_prompt("apenas contexto", include_layer1_precalc_note=False)
    assert "TRIAGEM LAYER 1 (JÁ APLICADA" not in base
    with_note = build_system_prompt("apenas contexto", include_layer1_precalc_note=True)
    assert "TRIAGEM LAYER 1 (JÁ APLICADA" in with_note


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

    result = await intent_classifier.classify_async(
        message="não entendi",
        agent_state={},
        agent_config={},
    )

    assert result["intent"] == INTENT_APPOINTMENT_QUERY
    assert result["confidence"] == pytest.approx(0.85)
    assert result["skip_full_pipeline"] is False
    assert result["metadata"].get("source") == "llm"
    assert result["metadata"].get("llm_provider") == "anthropic"
    assert result["metadata"].get("llm_model") == "claude-sonnet-4-6"


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

    result = await intent_classifier.classify_async(
        message="qualquer coisa",
        agent_state={},
        agent_config={},
    )

    assert result["intent"] == INTENT_GENERAL
    assert result["metadata"].get("source") == "llm_error"
    assert result["metadata"].get("llm_provider") == "anthropic"
    assert result["metadata"].get("llm_model") == "claude-sonnet-4-6"


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
async def test_orchestrator_passes_conversation_history_to_intent_classifier(monkeypatch):
    captured: dict = {}

    async def _spy_classify(message, agent_state=None, agent_config=None, conversation_history=None):
        captured["conversation_history"] = conversation_history
        return {
            "intent": INTENT_GREETING,
            "confidence": 0.85,
            "skip_full_pipeline": True,
            "metadata": {"source": "llm"},
        }

    monkeypatch.setattr(
        "src.agent.orchestrator.intent_classifier.classify_async",
        _spy_classify,
    )

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

    assert captured.get("conversation_history") == hist


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

    result = await symptom_analyzer.analyze(
        message="estou muito mal hoje",
        clinical_context=_minimal_clinical_context(),
        cancer_type="breast",
        use_llm=True,
        llm_config={"llm_provider": "openai", "openai_api_key": "sk-test"},
    )
    assert any(s.get("name") == "nausea" for s in result["detectedSymptoms"])
    meta = result.get("_symptomLlmMeta")
    assert meta is not None
    assert meta.get("called") is True
    assert meta.get("provider") == "openai"
    assert meta.get("model") == "claude-sonnet-4-6"


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
    async def _fake_intent(*args, **kwargs):
        return {
            "intent": INTENT_GREETING,
            "confidence": 0.85,
            "skip_full_pipeline": True,
            "metadata": {"source": "llm"},
        }

    monkeypatch.setattr(
        "src.agent.orchestrator.intent_classifier.classify_async",
        _fake_intent,
    )

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
    async def _fake_intent(*args, **kwargs):
        return {
            "intent": INTENT_GREETING,
            "confidence": 0.99,
            "skip_full_pipeline": True,
            "metadata": {},
        }

    monkeypatch.setattr(
        "src.agent.orchestrator.intent_classifier.classify_async",
        _fake_intent,
    )

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
    assert "priorizar sua segurança" in result["response"].lower()


@pytest.mark.asyncio
async def test_orchestrator_appointment_query_skips_safety_triage(monkeypatch):
    """Ramo appointment_query não executa symptom_analyzer nem Layer1; disposição é placeholder."""
    async def _fake_intent(*args, **kwargs):
        return {
            "intent": INTENT_APPOINTMENT_QUERY,
            "confidence": 0.99,
            "skip_full_pipeline": False,
            "metadata": {},
        }

    monkeypatch.setattr(
        "src.agent.orchestrator.intent_classifier.classify_async",
        _fake_intent,
    )

    async def _fake_run_agentic_loop(*args, **kwargs):
        return {
            "response": "Segue o que encontrei nas suas etapas de navegação.",
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
    assert result.get("clinical_rules_findings") == []
    assert "etapas de navegação" in result["response"].lower()
    assert not any(f.get("rule_id") == "R08_SEVERE_PAIN" for f in (result.get("clinical_rules_findings") or []))
    appt_decisions = [
        d for d in result.get("decisions", []) if d.get("decisionType") == "APPOINTMENT_QUERY_HANDLED"
    ]
    assert appt_decisions, "deve haver decisão de auditoria mesmo sem tool do navigation"
    assert appt_decisions[0].get("inputData", {}).get("source") == "appointment_query_no_navigation_tool"


@pytest.mark.asyncio
async def test_orchestrator_appointment_query_suppresses_questionnaire_start_same_turn(monkeypatch):
    """Com intent de agenda, protocolo/LLM não devem iniciar ESAS nem substituir a resposta do multi-agent."""
    async def _fake_intent(*args, **kwargs):
        return {
            "intent": INTENT_APPOINTMENT_QUERY,
            "confidence": 0.99,
            "skip_full_pipeline": False,
            "metadata": {},
        }

    monkeypatch.setattr(
        "src.agent.orchestrator.intent_classifier.classify_async",
        _fake_intent,
    )

    llm_reply = "Resposta fixa do multi-agent sobre prazos de navegação, sem questionário."

    async def _fake_run_agentic_loop(*args, **kwargs):
        return {
            "response": llm_reply,
            "tool_calls": [
                {
                    "name": "iniciar_questionario",
                    "input": {"tipo": "ESAS", "motivo": "teste"},
                }
            ],
            "iterations": 1,
            "provider": "anthropic",
            "model": "claude-test",
        }

    monkeypatch.setattr(llm_provider, "run_agentic_loop", _fake_run_agentic_loop)
    monkeypatch.setattr(llm_provider, "has_any_llm_key", lambda cfg=None: True)
    monkeypatch.setattr(llm_provider, "has_anthropic_key", lambda cfg=None: True)

    def _fake_protocol_evaluate(**kwargs):
        return [
            {
                "type": "START_QUESTIONNAIRE",
                "questionnaire_type": "ESAS",
                "priority": "MEDIUM",
                "reason": "Questionário ESAS programado para etapa atual",
            }
        ]

    monkeypatch.setattr(
        "src.agent.orchestrator.protocol_engine.evaluate",
        _fake_protocol_evaluate,
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

    assert result["response"] == llm_reply
    assert "cansaço" not in result["response"].lower()
    assert result["new_state"].get("active_questionnaire") is None
    assert not any(a.get("type") == "START_QUESTIONNAIRE" for a in result.get("actions", []))


@pytest.mark.asyncio
async def test_orchestrator_appointment_query_with_active_questionnaire_preserves_multi_agent_response(
    monkeypatch,
):
    """Com ESAS ativo, intent de agenda não deve substituir a resposta pela próxima pergunta ESAS."""
    async def _fake_intent(*args, **kwargs):
        return {
            "intent": INTENT_APPOINTMENT_QUERY,
            "confidence": 0.99,
            "skip_full_pipeline": False,
            "metadata": {},
        }

    monkeypatch.setattr(
        "src.agent.orchestrator.intent_classifier.classify_async",
        _fake_intent,
    )

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
    async def _fake_intent(*args, **kwargs):
        return {
            "intent": INTENT_SYMPTOM_REPORT,
            "confidence": 0.95,
            "skip_full_pipeline": False,
            "metadata": {"source": "test"},
        }

    monkeypatch.setattr(
        "src.agent.orchestrator.intent_classifier.classify_async",
        _fake_intent,
    )

    async def _fake_safety_triage(*args, **kwargs):
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

    monkeypatch.setattr(orchestrator, "_run_safety_triage", _fake_safety_triage)

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

    async def _fake_intent(*args, **kwargs):
        # Evitar ramo INTENT_EMERGENCY antes do main — o teste cobre o merge após pipeline completo.
        return {
            "intent": INTENT_GENERAL,
            "confidence": 0.9,
            "skip_full_pipeline": False,
            "metadata": {"source": "test"},
        }

    monkeypatch.setattr(
        "src.agent.orchestrator.intent_classifier.classify_async",
        _fake_intent,
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
    assert not any(
        decision.get("outputAction", {}).get("type") == "CONTINUE_QUESTIONNAIRE"
        for decision in result["decisions"]
    )


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

    response, tool_calls, llm_meta = await orchestrator._run_multi_agent_pipeline(
        message="oi",
        rag_context="ctx",
        conversation_history=[],
        agent_config={},
        trace=None,
    )

    assert response == "ok"
    assert tool_calls == []
    assert llm_meta["provider"] == "openai"
    assert llm_meta["model"] == "gpt-4o-mini"


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
