from fastapi import APIRouter, Depends

from ..auth import observability_bound_tenant_id
from ..agent.tracer import tracer
from ..models.priority_model import priority_model

router = APIRouter()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ai-service",
        "version": "0.3.0",
        "model_trained": priority_model.is_trained,
        "capabilities": [
            "prioritization",
            "agent_orchestrator",
            "symptom_analysis",
            "context_building",
            "questionnaire_engine",
            "protocol_engine",
        ],
    }


@router.get("/observability/traces")
async def get_traces(
    limit: int = 50,
    tenant_id: str = Depends(observability_bound_tenant_id),
):
    limit = max(1, min(limit, 500))
    return {"traces": tracer.get_traces(limit=limit, tenant_id=tenant_id)}


@router.get("/observability/stats")
async def get_stats(
    tenant_id: str = Depends(observability_bound_tenant_id),
):
    return tracer.get_stats(tenant_id=tenant_id)


@router.delete("/observability/traces")
async def clear_traces(
    tenant_id: str = Depends(observability_bound_tenant_id),
):
    removed = tracer.clear_by_tenant(tenant_id)
    return {"cleared": True, "removed": removed}
