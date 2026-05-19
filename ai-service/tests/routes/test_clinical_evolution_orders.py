import json

import pytest
from fastapi.testclient import TestClient

from main import app
from src.agent.clinical_evolution_orders_tools import (
    EXAM_CONTEXT_TOOL_NAME,
    EXAM_GENERATE_TOOL_NAME,
    RX_CONTEXT_TOOL_NAME,
    RX_GENERATE_TOOL_NAME,
)
from src.routes import clinical_evolution_orders as ceo


@pytest.fixture
def client():
    return TestClient(app)


def _tool_result(payload_json: str, tool_name: str) -> dict:
    return {
        "tool_calls": [
            {
                "function": {
                    "name": tool_name,
                    "arguments": payload_json,
                }
            }
        ]
    }


def test_suggest_orders_requires_auth_when_token_enforced(
    client: TestClient, monkeypatch
):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "svc-secret")
    res = client.post(
        "/api/v1/clinical-evolution/suggest-orders",
        json={
            "tenant_id": "t1",
            "patient_id": "p1",
            "clinical_note_id": "n1",
            "note_type": "MEDICAL",
            "content_markdown": "# Evolução",
            "patient_snapshot": {},
        },
    )
    assert res.status_code == 401


def test_suggest_orders_empty_when_no_llm_keys(client: TestClient, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
    monkeypatch.setattr(ceo.llm_provider, "has_any_llm_key", lambda cfg: False)
    res = client.post(
        "/api/v1/clinical-evolution/suggest-orders",
        headers={"Authorization": "Bearer test-token"},
        json={
            "tenant_id": "t1",
            "patient_id": "p1",
            "clinical_note_id": "n1",
            "note_type": "MEDICAL",
            "content_markdown": "Solicito hemograma.",
            "patient_snapshot": {"id": "p1"},
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["pipeline_schema_version"] == "orders_pipeline_v2"
    assert data["clinical_exam_requests"] == []
    assert data["clinical_prescription_lines"] == []
    assert data["rejection_report"] == []


def test_suggest_orders_four_step_pipeline_medical(client: TestClient, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")

    calls: list[str] = []

    async def fake_generate_with_tools(
        system_prompt, messages, tools, config, **kwargs
    ):
        step = kwargs.get("usage_step", "")
        calls.append(step)
        if step == "clinical_evolution_exam_context":
            return _tool_result(json_exam_context(), EXAM_CONTEXT_TOOL_NAME)
        if step == "clinical_evolution_rx_context":
            return _tool_result(json_rx_context(), RX_CONTEXT_TOOL_NAME)
        if step == "clinical_evolution_exam_generate":
            return _tool_result(json_exam_generate(), EXAM_GENERATE_TOOL_NAME)
        if step == "clinical_evolution_rx_generate":
            return _tool_result(json_rx_generate(), RX_GENERATE_TOOL_NAME)
        return {"tool_calls": []}

    monkeypatch.setattr(ceo.llm_provider, "has_any_llm_key", lambda cfg: True)
    monkeypatch.setattr(ceo.llm_provider, "has_anthropic_key", lambda cfg: True)
    monkeypatch.setattr(
        ceo.llm_provider, "generate_with_tools", fake_generate_with_tools
    )

    res = client.post(
        "/api/v1/clinical-evolution/suggest-orders",
        headers={"Authorization": "Bearer test-token"},
        json={
            "tenant_id": "t1",
            "patient_id": "p1",
            "clinical_note_id": "n1",
            "note_type": "MEDICAL",
            "content_markdown": (
                "## Exames complementares\nHb 8,5 g/dL.\n\n"
                "## Conduta\nSolicitar hemograma. Suspender AAS."
            ),
            "patient_snapshot": {
                "medications": [{"id": "m1", "name": "AAS"}],
                "recentLaboratoryResults": [],
            },
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["pipeline_schema_version"] == "orders_pipeline_v2"
    assert len(data["clinical_exam_requests"]) == 1
    assert data["clinical_exam_requests"][0]["display_name"] == "Hemograma"
    assert data["clinical_exam_requests"][0]["request_source"] == "explicit"
    assert len(data["clinical_prescription_lines"]) == 1
    assert data["clinical_prescription_lines"][0]["prescription_intent"] == "SUSPEND"
    assert data["exam_context"].get("exam_results_documented")
    assert data["prescription_context"].get("conduct_prescription_intents")
    assert set(calls) == {
        "clinical_evolution_exam_context",
        "clinical_evolution_rx_context",
        "clinical_evolution_exam_generate",
        "clinical_evolution_rx_generate",
    }


def test_suggest_orders_skips_rx_track_for_nursing(client: TestClient, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")

    calls: list[str] = []

    async def fake_generate_with_tools(
        system_prompt, messages, tools, config, **kwargs
    ):
        step = kwargs.get("usage_step", "")
        calls.append(step)
        if step == "clinical_evolution_exam_context":
            return _tool_result(json_exam_context(), EXAM_CONTEXT_TOOL_NAME)
        if step == "clinical_evolution_exam_generate":
            return _tool_result(json_exam_generate(), EXAM_GENERATE_TOOL_NAME)
        return {"tool_calls": []}

    monkeypatch.setattr(ceo.llm_provider, "has_any_llm_key", lambda cfg: True)
    monkeypatch.setattr(ceo.llm_provider, "has_anthropic_key", lambda cfg: True)
    monkeypatch.setattr(
        ceo.llm_provider, "generate_with_tools", fake_generate_with_tools
    )

    res = client.post(
        "/api/v1/clinical-evolution/suggest-orders",
        headers={"Authorization": "Bearer test-token"},
        json={
            "tenant_id": "t1",
            "patient_id": "p1",
            "clinical_note_id": "n1",
            "note_type": "NURSING",
            "content_markdown": "Solicitar hemograma.",
            "patient_snapshot": {},
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["clinical_prescription_lines"] == []
    assert data["prescription_context"] == {}
    assert "clinical_evolution_rx_context" not in calls
    assert "clinical_evolution_rx_generate" not in calls
    assert "clinical_evolution_exam_context" in calls
    assert "clinical_evolution_exam_generate" in calls


def test_parse_tool_json_result_fallback_to_content():
    parsed = ceo._parse_tool_json_result(
        {"content": json_exam_generate()},
        EXAM_GENERATE_TOOL_NAME,
    )
    assert parsed is not None
    assert parsed.get("clinical_exam_requests")


def test_summary_snapshot_for_exams_includes_medications():
    snap = {
        "recentLaboratoryResults": [{"name": "Creatinina", "value": "1.2"}],
        "medications": [{"name": "Metformina"}, {"name": "Losartana"}],
        "comorbidities": [{"name": "DM2"}],
    }
    parsed = json.loads(ceo._summary_snapshot_for_exams(snap))
    assert "medications" in parsed
    assert len(parsed["medications"]) == 2
    assert parsed["recentLaboratoryResults"]


def test_summary_snapshot_for_rx_includes_diagnoses_and_allergies():
    snap = {
        "medications": [{"name": "Metformina"}],
        "cancerDiagnoses": [{"cancerType": "bladder"}],
        "comorbidities": [{"name": "IRC"}],
        "allergies": "Dipirona",
    }
    parsed = json.loads(ceo._summary_snapshot_for_rx(snap))
    assert parsed["medications"]
    assert parsed["cancerDiagnoses"]
    assert parsed["comorbidities"]
    assert parsed["allergies"] == "Dipirona"


def test_build_exam_requests_skips_contextual_without_rationale():
    parsed = {
        "clinical_exam_requests": [
            {
                "display_name": "Creatinina",
                "request_source": "contextual",
                "rationale": "",
            },
            {
                "display_name": "Hemograma",
                "request_source": "contextual",
                "rationale": "Monitorar anemia.",
            },
        ]
    }
    out = ceo._build_exam_requests(parsed)
    assert len(out) == 1
    assert out[0].display_name == "Hemograma"


def test_suggest_orders_therapy_review_line(client: TestClient, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")

    async def fake_generate_with_tools(
        system_prompt, messages, tools, config, **kwargs
    ):
        step = kwargs.get("usage_step", "")
        if step == "clinical_evolution_exam_context":
            return _tool_result(json_exam_context(), EXAM_CONTEXT_TOOL_NAME)
        if step == "clinical_evolution_rx_context":
            return _tool_result(json_rx_context_with_therapy_review(), RX_CONTEXT_TOOL_NAME)
        if step == "clinical_evolution_exam_generate":
            return _tool_result(json_exam_generate(), EXAM_GENERATE_TOOL_NAME)
        if step == "clinical_evolution_rx_generate":
            return _tool_result(json_rx_generate_therapy_review(), RX_GENERATE_TOOL_NAME)
        return {"tool_calls": []}

    monkeypatch.setattr(ceo.llm_provider, "has_any_llm_key", lambda cfg: True)
    monkeypatch.setattr(ceo.llm_provider, "has_anthropic_key", lambda cfg: True)
    monkeypatch.setattr(
        ceo.llm_provider, "generate_with_tools", fake_generate_with_tools
    )

    res = client.post(
        "/api/v1/clinical-evolution/suggest-orders",
        headers={"Authorization": "Bearer test-token"},
        json={
            "tenant_id": "t1",
            "patient_id": "p1",
            "clinical_note_id": "n1",
            "note_type": "MEDICAL",
            "content_markdown": "Manter medicações.",
            "patient_snapshot": {
                "medications": [{"id": "m1", "name": "Metformina"}],
                "comorbidities": [{"name": "IRC"}],
            },
        },
    )
    assert res.status_code == 200
    lines = res.json()["clinical_prescription_lines"]
    assert len(lines) == 1
    assert lines[0]["prescription_intent"] == "DOSE_CHANGE"
    assert lines[0]["indication"].startswith("[Revisão de terapia]")


def json_exam_context() -> str:
    return (
        '{"exam_context_schema_version":"2026-05-18-exam-context-v1.1",'
        '"exam_results_documented":[{"display_name":"Hb","value_summary":"8,5",'
        '"evidence_quote":"Hb 8,5","is_prior_result":true}],'
        '"explicit_orders_documented":[{"display_name":"Hemograma",'
        '"evidence_quote":"Solicitar hemograma","order_kind":"single"}],'
        '"monitoring_gaps":[],"clinical_signals_for_exams":[],"sections_excerpt":{},'
        '"flags":{"has_only_results_no_orders":false,"ambiguous_wording":false},'
        '"rejection_report":[]}'
    )


def json_rx_context() -> str:
    return (
        '{"rx_context_schema_version":"2026-05-18-rx-context-v1.1",'
        '"medications_in_use":[{"name":"AAS"}],'
        '"conduct_prescription_intents":[{"intent":"SUSPEND","medication_name":"AAS",'
        '"evidence_quote":"Suspender AAS"}],'
        '"therapy_review_suggestions":[],'
        '"sections_excerpt":{},"flags":{"missing_posology":false,'
        '"conflict_with_allergies_mentioned":false},"rejection_report":[]}'
    )


def json_rx_context_with_therapy_review() -> str:
    return (
        '{"rx_context_schema_version":"2026-05-18-rx-context-v1.1",'
        '"medications_in_use":[{"name":"Metformina","matches_snapshot_id":"m1"}],'
        '"conduct_prescription_intents":[],'
        '"therapy_review_suggestions":[{"medication_name":"Metformina",'
        '"issue_type":"comorbidity_risk","recommended_intent":"ADJUST_DOSE",'
        '"proposed_dosage":null,"proposed_frequency":null,"proposed_route":null,'
        '"rationale":"Creatinina elevada com IRC","linked_context":"snapshot"}],'
        '"sections_excerpt":{},"flags":{"missing_posology":false,'
        '"conflict_with_allergies_mentioned":false},"rejection_report":[]}'
    )


def json_exam_generate() -> str:
    return (
        '{"clinical_exam_requests":[{"display_name":"Hemograma",'
        '"request_source":"explicit","rationale":null}],'
        '"rejection_report":[]}'
    )


def json_rx_generate() -> str:
    return (
        '{"clinical_prescription_lines":[{"medication_name":"AAS",'
        '"prescription_intent":"SUSPEND","indication":"Suspender conforme conduta"}],'
        '"rejection_report":[]}'
    )


def json_rx_generate_therapy_review() -> str:
    return (
        '{"clinical_prescription_lines":[{"medication_name":"Metformina",'
        '"prescription_intent":"DOSE_CHANGE",'
        '"indication":"[Revisão de terapia] comorbidity_risk: Creatinina elevada com IRC"}],'
        '"rejection_report":[]}'
    )
