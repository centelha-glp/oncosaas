"""Regressão determinística do harness clínico (sem LLM live)."""

import json
import os

import pytest
from fastapi.testclient import TestClient

from eval.harness import FIXTURES_ROOT, run_clinical_eval
from main import app
from src.routes import clinical_evolution_structure as ces
from src.routes import exam_extract as exam_routes


def test_clinical_eval_harness_all_fixtures_pass():
    report = run_clinical_eval(FIXTURES_ROOT)
    assert report.total >= 4, "esperado ao menos 4 casos de fixture"
    assert report.failed == 0, [
        (c.suite, c.case_id, c.errors) for c in report.cases if not c.passed
    ]
    assert report.parse_ok_rate >= 0.75


def test_harness_report_serializes_to_json(tmp_path):
    report = run_clinical_eval(FIXTURES_ROOT)
    out = tmp_path / "metrics.json"
    out.write_text(json.dumps(report.to_dict(), ensure_ascii=False), encoding="utf-8")
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["total"] == report.total
    assert "parse_ok_rate" in data
    assert len(data["cases"]) == report.total


@pytest.fixture
def client():
    return TestClient(app)


def test_structure_route_503_contract_no_llm_keys(client: TestClient, monkeypatch):
    """CI sem chaves: contrato 503 na estruturação."""
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
    monkeypatch.setattr(ces.llm_provider, "has_any_llm_key", lambda cfg: False)
    res = client.post(
        "/api/v1/clinical-evolution/structure",
        headers={"Authorization": "Bearer test-token"},
        json={
            "tenant_id": "t-eval",
            "patient_id": "p-eval",
            "clinical_note_id": "n-eval",
            "note_type": "MEDICAL",
            "content_markdown": "Texto sintético de evolução.",
            "patient_snapshot": {},
        },
    )
    assert res.status_code == 503


def test_exam_extract_mock_policy_contract(client: TestClient, monkeypatch):
    """Sem chaves + mock permitido em dev: extractionSource=mock."""
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
    monkeypatch.setattr(exam_routes.llm_provider, "has_any_llm_key", lambda cfg: False)
    monkeypatch.setattr(
        "src.agent.llm_provider.allow_ai_mock_responses",
        lambda: True,
    )
    res = client.post(
        "/api/v1/exam-extract",
        headers={
            "Authorization": "Bearer test-token",
            "X-Tenant-Id": "00000000-0000-4000-8000-000000000001",
        },
        json={"plainText": "Creatinina 1,0 mg/dL (sintético)", "files": []},
    )
    assert res.status_code == 200
    assert res.json().get("extractionSource") == "mock"


def test_exam_extract_503_when_mock_disabled(client: TestClient, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
    monkeypatch.setattr(exam_routes.llm_provider, "has_any_llm_key", lambda cfg: False)
    monkeypatch.setattr(
        "src.agent.llm_provider.allow_ai_mock_responses",
        lambda: False,
    )
    res = client.post(
        "/api/v1/exam-extract",
        headers={
            "Authorization": "Bearer test-token",
            "X-Tenant-Id": "00000000-0000-4000-8000-000000000001",
        },
        json={"plainText": "Laudo sintético", "files": []},
    )
    assert res.status_code == 503


@pytest.mark.skipif(
    os.getenv("RUN_LLM_EVAL", "").strip() not in ("1", "true", "yes"),
    reason="Eval LLM live opcional: defina RUN_LLM_EVAL=1 e chaves no .env",
)
def test_structure_live_llm_smoke(client: TestClient, monkeypatch):
    """Smoke opcional com modelo real — não roda no CI default."""
    from src.agent import llm_provider as lp

    if not lp.llm_provider.has_any_llm_key({}):
        pytest.skip("Sem OPENAI_API_KEY nem ANTHROPIC_API_KEY")

    monkeypatch.setenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "true")
    monkeypatch.setenv("BACKEND_SERVICE_TOKEN", "test-token")
    res = client.post(
        "/api/v1/clinical-evolution/structure",
        headers={"Authorization": "Bearer test-token"},
        json={
            "tenant_id": "t-live",
            "patient_id": "p-live",
            "clinical_note_id": "n-live",
            "note_type": "MEDICAL",
            "content_markdown": (
                "Paciente sintético em consulta. Solicito hemograma. "
                "Em uso de paracetamol 500 mg se dor."
            ),
            "patient_snapshot": {"id": "p-live"},
        },
    )
    assert res.status_code in (200, 503)
    if res.status_code == 200:
        data = res.json()
        assert "parse_ok" in data
        assert "degraded" in data
