"""Testes do adapter POST /agent/message → orquestrador."""

from src.routes.legacy_agent_adapter import (
    AgentMessageRequest,
    agent_process_dict_to_message_response,
    legacy_patient_context_to_clinical_context,
    message_request_to_process_payload,
)


def test_legacy_flat_patient_maps_to_clinical_patient():
    ctx = legacy_patient_context_to_clinical_context(
        {"name": "João", "cancer_type": "bladder", "treatment": "QT"}
    )
    assert ctx["patient"]["name"] == "João"
    assert ctx["patient"]["cancerType"] == "bladder"
    assert ctx["patient"]["treatmentSummary"] == "QT"


def test_message_request_to_process_payload_uses_explicit_clinical():
    req = AgentMessageRequest(
        message="oi",
        patient_id="p1",
        tenant_id="t1",
        patient_context={},
        clinical_context={"patient": {"name": "X"}},
    )
    payload = message_request_to_process_payload(req)
    assert payload["tenant_id"] == "t1"
    assert payload["clinical_context"]["patient"]["name"] == "X"


def test_agent_process_dict_to_message_response_should_alert_on_er():
    out = agent_process_dict_to_message_response(
        {
            "response": "ok",
            "symptom_analysis": {"detectedSymptoms": [], "requiresEscalation": False},
            "clinical_disposition": "ER_IMMEDIATE",
            "actions": [],
        }
    )
    assert out["should_alert"] is True
    assert out["response"] == "ok"


def test_agent_process_dict_critical_symptoms_from_detected():
    out = agent_process_dict_to_message_response(
        {
            "response": "x",
            "symptom_analysis": {
                "detectedSymptoms": [
                    {"name": "Dor", "severity": "HIGH"},
                    {"name": "Febre", "severity": "LOW"},
                ],
                "structuredData": {},
            },
            "actions": [],
        }
    )
    assert "Dor" in out["critical_symptoms"]
    assert "Febre" not in out["critical_symptoms"]
