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


def test_structure_evolution_empty_when_no_llm_keys(client: TestClient, monkeypatch):
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
    assert res.status_code == 200
    data = res.json()
    assert data["extraction_schema_version"].startswith("2026-05-15-v")
    assert data["clinical_exam_requests"] == []
    assert data["medications"] == []
    assert data["comorbidities"] == []
    assert data["diagnoses"] == []
    assert data["treatments"] == []
    assert data["journey_patch"] == {}
    assert data["navigation_step_updates"] == []
    assert data["complementary_exams"] == []
    assert data["observations"] == []
    assert data["performance_status_history"] == []
    assert data["clinical_prescription_lines"] == []
    assert data["questionnaire_responses"] == []
    pp = data.get("patient_patch") or {}
    assert all(v is None for v in pp.values())
    assert data["rejection_report"] == []


def test_structure_evolution_parses_llm_json(client: TestClient, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")

    async def fake_generate(*args, **kwargs):
        return (
            '{"clinical_exam_requests":[{"display_name":"Hemograma"}],'
            '"medications":[{"name":"Metformina","dosage":"850 mg","category":"ANTIDIABETIC"}],'
            '"comorbidities":[{"name":"DM2","type":"DIABETES_TYPE_2","severity":"MODERATE","controlled":true}],'
            '"patient_patch":{"occupation":"Aposentado"},'
            '"rejection_report":[]}'
        )

    monkeypatch.setattr(ces.llm_provider, "has_any_llm_key", lambda cfg: True)
    monkeypatch.setattr(ces.llm_provider, "has_anthropic_key", lambda cfg: True)
    monkeypatch.setattr(ces.llm_provider, "generate", fake_generate)

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
    assert data["clinical_exam_requests"][0]["display_name"] == "Hemograma"
    assert len(data["medications"]) == 1
    assert data["medications"][0]["name"] == "Metformina"
    assert len(data["comorbidities"]) == 1
    assert data["comorbidities"][0]["name"] == "DM2"
    assert data["patient_patch"]["occupation"] == "Aposentado"
