"""SEC-002: observabilidade exige Bearer + X-Tenant-Auth alinhado ao Nest quando há BACKEND_SERVICE_TOKEN."""
import hashlib
import hmac
import os

import pytest
from fastapi.testclient import TestClient

# main aplica load_dotenv(override=True) — token efetivo vem do .env local ou do ambiente CI
from main import app

client = TestClient(app)

TID = "550e8400-e29b-41d4-a716-446655440000"

SERVICE_TOKEN = os.environ.get("BACKEND_SERVICE_TOKEN", "").strip()

pytestmark = pytest.mark.skipif(
    not SERVICE_TOKEN,
    reason="BACKEND_SERVICE_TOKEN ausente — copie ai-service/.env.example para .env ou exporte o token.",
)


def _tenant_auth_hex(service_token: str, tenant_id: str) -> str:
    return hmac.new(
        service_token.encode("utf-8"),
        tenant_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def test_observability_traces_401_sem_x_tenant_auth():
    r = client.get(
        "/api/v1/observability/traces",
        headers={
            "Authorization": f"Bearer {SERVICE_TOKEN}",
            "X-Tenant-Id": TID,
        },
    )
    assert r.status_code == 401
    detail = r.json().get("detail", "")
    assert isinstance(detail, str)
    assert detail  # mensagem genérica, sem stack


def test_observability_traces_401_hmac_invalido():
    r = client.get(
        "/api/v1/observability/traces",
        headers={
            "Authorization": f"Bearer {SERVICE_TOKEN}",
            "X-Tenant-Id": TID,
            "X-Tenant-Auth": "0" * 64,
        },
    )
    assert r.status_code == 401


def test_observability_traces_200_com_binding_correto():
    proof = _tenant_auth_hex(SERVICE_TOKEN, TID)
    r = client.get(
        "/api/v1/observability/traces?limit=5",
        headers={
            "Authorization": f"Bearer {SERVICE_TOKEN}",
            "X-Tenant-Id": TID,
            "X-Tenant-Auth": proof,
        },
    )
    assert r.status_code == 200
    assert "traces" in r.json()


def test_service_token_invalido_401():
    proof = _tenant_auth_hex(SERVICE_TOKEN, TID)
    r = client.get(
        "/api/v1/observability/traces",
        headers={
            "Authorization": "Bearer definitivamente-nao-o-token-real",
            "X-Tenant-Id": TID,
            "X-Tenant-Auth": proof,
        },
    )
    assert r.status_code == 401
