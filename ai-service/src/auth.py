"""
Autenticação do ai-service via BACKEND_SERVICE_TOKEN.

Todos os endpoints (exceto /health e /) requerem o header:
    Authorization: Bearer <BACKEND_SERVICE_TOKEN>

O token é comparado via secrets.compare_digest (tempo constante)
para evitar timing attacks.
"""

import hashlib
import hmac
import logging
import os
import secrets

from fastapi import Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


def _get_service_token() -> str:
    """Lê o token a cada chamada para suportar rotação sem restart."""
    return os.getenv("BACKEND_SERVICE_TOKEN", "").strip()


def _require_service_token_env() -> bool:
    """
    Se true, nunca aceita endpoints sem BACKEND_SERVICE_TOKEN configurado
    (útil em dev/staging alinhado a produção). [C-01]
    """
    v = os.getenv("AI_SERVICE_REQUIRE_SERVICE_TOKEN", "").strip().lower()
    return v in ("1", "true", "yes", "on")


def _deployment_requires_service_token() -> bool:
    """Staging/produção exigem token mesmo sem flag explícita."""
    env = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")).strip().lower()
    return env in ("production", "staging")


def require_service_token(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> None:
    """
    Dependency FastAPI: valida o BACKEND_SERVICE_TOKEN.

    Uso:
        @router.post("/rota", dependencies=[Depends(require_service_token)])
    """
    expected = _get_service_token()

    if not expected:
        # Token não configurado → bloquear em produção/staging ou com AI_SERVICE_REQUIRE_SERVICE_TOKEN
        if _deployment_requires_service_token() or _require_service_token_env():
            logger.error(
                "BACKEND_SERVICE_TOKEN não configurado. Bloqueando requisição "
                "(produção/staging ou AI_SERVICE_REQUIRE_SERVICE_TOKEN)."
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service token not configured",
            )
        logger.warning(
            "BACKEND_SERVICE_TOKEN não configurado. "
            "Endpoint acessível sem autenticação (apenas em desenvolvimento). "
            "Defina AI_SERVICE_REQUIRE_SERVICE_TOKEN=true para exigir token."
        )
        return

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header obrigatório",
            headers={"WWW-Authenticate": "Bearer"},
        )

    provided = credentials.credentials.strip()
    if not secrets.compare_digest(provided.encode(), expected.encode()):
        logger.warning("Tentativa de acesso com token inválido ao ai-service")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )


def observability_bound_tenant_id(
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
    x_tenant_auth: str | None = Header(None, alias="X-Tenant-Auth"),
) -> str:
    """
    SEC-002: com BACKEND_SERVICE_TOKEN configurado, exige X-Tenant-Auth =
    HMAC-SHA256(key=token, message=tenant_id) em hex — mesmo algoritmo do NestJS
    (`buildTenantServiceProof`). Em dev sem token, não aplica (paridade com require_service_token).
    """
    expected = _get_service_token()
    if not expected:
        return x_tenant_id
    if not x_tenant_auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Tenant-Auth obrigatório para observabilidade",
        )
    digest = hmac.new(
        expected.encode("utf-8"),
        x_tenant_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(digest, x_tenant_auth.strip()):
        logger.warning("X-Tenant-Auth não confere com o tenant informado")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Verificação de tenant inválida",
        )
    return x_tenant_id
