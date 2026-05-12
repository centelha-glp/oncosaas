"""POST /api/v1/agent/message usa o orquestrador (sem importar `main` — evita load do modelo de prioridade)."""

from fastapi import FastAPI

from src.auth import require_service_token
from src.routes.agent import router as agent_router


def _client():
    app = FastAPI()
    app.include_router(agent_router, prefix="/api/v1")

    async def _override_token():
        return None

    app.dependency_overrides[require_service_token] = _override_token
    from fastapi.testclient import TestClient

    return TestClient(app)


def test_agent_message_returns_legacy_shape():
    client = _client()
    r = client.post(
        "/api/v1/agent/message",
        json={
            "message": "oi",
            "patient_id": "p1",
            "tenant_id": "t1",
            "patient_context": {},
            "conversation_history": [],
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "response" in data
    assert isinstance(data.get("critical_symptoms"), list)
    assert isinstance(data.get("structured_data"), dict)
    assert "should_alert" in data
