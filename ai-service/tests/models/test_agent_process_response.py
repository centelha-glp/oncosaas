"""Contrato AgentProcessResponse com pipeline_trace."""

from src.models.schemas import AgentProcessResponse


def test_agent_process_response_pipeline_trace_optional():
    r = AgentProcessResponse(response="x", actions=[])
    assert r.pipeline_trace is None


def test_agent_process_response_accepts_pipeline_trace():
    trace = {
        "trace_id": "abc12345",
        "pipeline_path": "main",
        "spans": [{"name": "intent_classification", "duration_ms": 1.0, "data": {}}],
    }
    r = AgentProcessResponse(response="ok", actions=[], pipeline_trace=trace)
    assert r.pipeline_trace == trace
    assert r.model_dump(by_alias=False)["pipeline_trace"] == trace


def test_agent_process_response_symptom_analysis_requires_string_severity():
    """Ramo APPOINTMENT_QUERY no orchestrator não pode usar overallSeverity=None (quebra response_model)."""
    AgentProcessResponse(
        response="ok",
        actions=[],
        symptom_analysis={
            "detectedSymptoms": [],
            "overallSeverity": "LOW",
            "requiresEscalation": False,
            "structuredData": {},
        },
    )
