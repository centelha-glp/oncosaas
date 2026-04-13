"""
Autenticação do ai-service via BACKEND_SERVICE_TOKEN.

Todos os endpoints (exceto /health e /) requerem o header:
    Authorization: Bearer <BACKEND_SERVICE_TOKEN>

O token é comparado via secrets.compare_digest (tempo constante)
para evitar timing attacks.
"""

import logging
import os
import secrets

from fastapi import HTTPException, Security, status
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
        # Token não configurado → bloquear em produção ou com AI_SERVICE_REQUIRE_SERVICE_TOKEN
        env = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development"))
        if env == "production" or _require_service_token_env():
            logger.error(
                "BACKEND_SERVICE_TOKEN não configurado. Bloqueando requisição "
                "(produção ou AI_SERVICE_REQUIRE_SERVICE_TOKEN)."
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token inválido",
        )
