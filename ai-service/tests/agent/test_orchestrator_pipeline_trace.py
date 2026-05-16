import pytest

from src.agent.orchestrator import AgentOrchestrator, orchestrator


@pytest.mark.asyncio
async def test_orchestrator_process_includes_pipeline_trace(monkeypatch):
    async def fake_process_with_trace(
        self,
        trace,
        message,
        clinical_context,
        protocol,
        conversation_history,
        agent_state,
        agent_config,
        *,
        patient_id: str,
        tenant_id: str,
        has_llm_keys: bool,
        has_anthropic: bool,
    ):
        return {
            "response": "Resposta sintética",
            "actions": [],
            "symptom_analysis": None,
            "clinical_disposition": "REMOTE_NURSING",
            "clinical_disposition_reason": None,
            "clinical_rules_findings": [],
            "new_state": {},
            "decisions": [],
        }

    monkeypatch.setattr(
        AgentOrchestrator,
        "_process_with_trace",
        fake_process_with_trace,
    )

    out = await orchestrator.process(
        {
            "message": "oi",
            "patient_id": "p1",
            "tenant_id": "t1",
            "clinical_context": {},
            "protocol": None,
            "conversation_history": [],
            "agent_state": {},
            "agent_config": {},
        }
    )

    assert "pipeline_trace" in out
    pt = out["pipeline_trace"]
    assert isinstance(pt, dict)
    assert pt.get("main_multi_agent_llm_used") is False
    assert pt.get("patient_id") == "p1"
    assert pt.get("tenant_id") == "t1"
    assert pt.get("total_duration_ms") is not None
