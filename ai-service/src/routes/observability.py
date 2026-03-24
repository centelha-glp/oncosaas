from fastapi import APIRouter, Header

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
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
):
    limit = max(1, min(limit, 500))
    return {"traces": tracer.get_traces(limit=limit, tenant_id=x_tenant_id)}


@router.get("/observability/stats")
async def get_stats(x_tenant_id: str = Header(..., alias="X-Tenant-Id")):
    return tracer.get_stats(tenant_id=x_tenant_id)


@router.delete("/observability/traces")
async def clear_traces(x_tenant_id: str = Header(..., alias="X-Tenant-Id")):
    removed = tracer.clear_by_tenant(x_tenant_id)
    return {"cleared": True, "removed": removed}
