import pytest

from src.agent.context_builder import context_builder
from src.agent.intent_classifier import (
    intent_classifier,
    INTENT_EMERGENCY,
    INTENT_GREETING,
    INTENT_APPOINTMENT_QUERY,
)
from src.agent.protocol_engine import protocol_engine
from src.agent.questionnaire_engine import questionnaire_engine
from src.agent.symptom_analyzer import symptom_analyzer
from src.agent.clinical_rules import ClinicalRulesEngine, REMOTE_NURSING
from src.agent.tracer import AgentTracer
from src.agent.subagents import (
    SymptomAgent,
    NavigationAgent,
    QuestionnaireAgent,
    EmotionalSupportAgent,
)
from src.agent.orchestrator import orchestrator
from src.agent.llm_provider import llm_provider
from src.routes import generate_checkin_message, nurse_assist
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


def test_intent_classifier_basic_paths():
    assert intent_classifier.classify("oi")["intent"] == INTENT_GREETING
    assert intent_classifier.classify("não consigo respirar")["intent"] == INTENT_EMERGENCY


@pytest.mark.asyncio
async def test_intent_classifier_uses_resolved_keys_for_llm_fallback(monkeypatch):
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
    assert result["metadata"].get("source") == "llm"


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
async def test_orchestrator_greeting_fast_path():
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


def test_orchestrator_appointment_response_supports_stepname_duedate():
    out = orchestrator._build_appointment_response(
        {
            "patient": {"name": "Ana"},
            "navigationSteps": [
                {"status": "PENDING", "stepName": "Colonoscopia", "dueDate": "2026-04-10"},
            ],
        },
        {},
    )
    assert "Colonoscopia" in out["response"]
    assert "2026-04-10" in out["response"]


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
