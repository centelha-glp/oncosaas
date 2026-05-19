import pytest
from fastapi.testclient import TestClient

from main import app
from src.routes import clinical_evolution_structure as ces


@pytest.fixture
def client():
    return TestClient(app)


def test_structure_evolution_requires_auth_when_token_enforced(
    client: TestClient, monkeypatch
):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "svc-secret")
    res = client.post(
        "/api/v1/clinical-evolution/structure",
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


def test_structure_evolution_503_when_no_llm_keys(client: TestClient, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
    monkeypatch.setattr(ces.llm_provider, "has_any_llm_key", lambda cfg: False)
    res = client.post(
        "/api/v1/clinical-evolution/structure",
        headers={"Authorization": "Bearer test-token"},
        json={
            "tenant_id": "t1",
            "patient_id": "p1",
            "clinical_note_id": "n1",
            "note_type": "MEDICAL",
            "content_markdown": "Solicito hemograma completo.",
            "patient_snapshot": {"id": "p1"},
        },
    )
    assert res.status_code == 503
    assert "indisponível" in res.json().get("detail", "").lower()


def test_structure_evolution_degraded_on_invalid_json(client: TestClient, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")

    async def fake_generate_with_tools(*args, **kwargs):
        return {"tool_calls": [], "content": "isto não é json"}

    monkeypatch.setattr(ces.llm_provider, "has_any_llm_key", lambda cfg: True)
    monkeypatch.setattr(ces.llm_provider, "has_anthropic_key", lambda cfg: True)
    monkeypatch.setattr(ces.llm_provider, "generate_with_tools", fake_generate_with_tools)

    res = client.post(
        "/api/v1/clinical-evolution/structure",
        headers={"Authorization": "Bearer test-token"},
        json={
            "tenant_id": "t1",
            "patient_id": "p1",
            "clinical_note_id": "n1",
            "note_type": "MEDICAL",
            "content_markdown": "texto",
            "patient_snapshot": {},
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["degraded"] is True
    assert data["parse_ok"] is False
    assert data["llm_available"] is True
    assert data["clinical_exam_requests"] == []
    assert len(data["rejection_report"]) >= 1


def test_structure_evolution_parses_llm_json(client: TestClient, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")

    payload = {
        "clinical_exam_requests": [{"display_name": "Hemograma"}],
        "medications": [
            {
                "name": "Metformina",
                "dosage": "850 mg",
                "category": "ANTIDIABETIC",
            }
        ],
        "comorbidities": [
            {
                "name": "DM2",
                "type": "DIABETES_TYPE_2",
                "severity": "MODERATE",
                "controlled": True,
            }
        ],
        "patient_patch": {"occupation": "Aposentado"},
        "journey_patch": {},
        "diagnoses": [],
        "treatments": [],
        "navigation_step_updates": [],
        "complementary_exams": [],
        "observations": [],
        "performance_status_history": [],
        "clinical_prescription_lines": [],
        "questionnaire_responses": [],
        "rejection_report": [],
    }

    async def fake_generate_with_tools(*args, **kwargs):
        import json

        return {
            "tool_calls": [
                {
                    "function": {
                        "name": "structure_signed_evolution_output",
                        "arguments": json.dumps(payload),
                    }
                }
            ]
        }

    monkeypatch.setattr(ces.llm_provider, "has_any_llm_key", lambda cfg: True)
    monkeypatch.setattr(ces.llm_provider, "has_anthropic_key", lambda cfg: True)
    monkeypatch.setattr(ces.llm_provider, "generate_with_tools", fake_generate_with_tools)

    res = client.post(
        "/api/v1/clinical-evolution/structure",
        headers={"Authorization": "Bearer test-token"},
        json={
            "tenant_id": "t1",
            "patient_id": "p1",
            "clinical_note_id": "n1",
            "note_type": "MEDICAL",
            "content_markdown": "Paciente em uso de metformina. Solicito hemograma.",
            "patient_snapshot": {"id": "p1"},
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["clinical_exam_requests"]) == 1
    assert data["degraded"] is False
    assert data["parse_ok"] is True
    assert data["clinical_exam_requests"][0]["display_name"] == "Hemograma"
    assert len(data["medications"]) == 1
    assert data["medications"][0]["name"] == "Metformina"
    assert len(data["comorbidities"]) == 1
    assert data["comorbidities"][0]["name"] == "DM2"
    assert data["patient_patch"]["occupation"] == "Aposentado"
