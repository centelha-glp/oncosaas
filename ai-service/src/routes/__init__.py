from fastapi import APIRouter

from .agent import generate_checkin_message, router as agent_router
from .nurse import nurse_assist, router as nurse_router
from .observability import router as observability_router
from .priority import router as priority_router
from .risk import router as risk_router
from .summary import router as summary_router

router = APIRouter()
router.include_router(priority_router)
router.include_router(agent_router)
router.include_router(risk_router)
router.include_router(nurse_router)
router.include_router(summary_router)
router.include_router(observability_router)

__all__ = ["router", "generate_checkin_message", "nurse_assist"]
