from fastapi import APIRouter, Depends

from ..auth import require_service_token
from .agent import generate_checkin_message, router as agent_router
from .nurse import nurse_assist, router as nurse_router
from .observability import router as observability_router
from .priority import router as priority_router
from .risk import router as risk_router
from .summary import router as summary_router

# Dependency aplicada a TODOS os sub-routers protegidos.
# Os endpoints /health e / são adicionados diretamente ao app em main.py
# e não herdam esta dependency.
_auth = [Depends(require_service_token)]

router = APIRouter()
router.include_router(priority_router, dependencies=_auth)
router.include_router(agent_router, dependencies=_auth)
router.include_router(risk_router, dependencies=_auth)
router.include_router(nurse_router, dependencies=_auth)
router.include_router(summary_router, dependencies=_auth)
router.include_router(observability_router, dependencies=_auth)

__all__ = ["router", "generate_checkin_message", "nurse_assist"]
