from src.agent.tracer import AgentTrace, pack_trace_text
from src.agent.llm_pricing import usage_event


def test_agent_trace_to_dict_includes_main_multi_agent_llm_used():
    t = AgentTrace("p", "ten")
    assert t.main_multi_agent_llm_used is False
    d = t.to_dict()
    assert d["main_multi_agent_llm_used"] is False
    assert d.get("intent_llm") is None
    assert d.get("symptom_llm") is None
    assert d.get("rag_context_output") is None
    assert d.get("orchestrator_input") is None
    assert d.get("subagent_outputs") == []
    assert d.get("token_usage_events") == []
    assert d["token_usage_totals"]["total_tokens"] == 0
    assert d["token_usage_totals"]["call_count"] == 0
    t.main_multi_agent_llm_used = True
    assert t.to_dict()["main_multi_agent_llm_used"] is True


def test_agent_trace_to_dict_sums_token_usage_events():
    t = AgentTrace("p", "ten")
    t.token_usage_events.append(
        usage_event(
            step="intent",
            provider="anthropic",
            model="claude-sonnet-4-6",
            input_tokens=100,
            output_tokens=50,
        )
    )
    d = t.to_dict()
    assert len(d["token_usage_events"]) == 1
    tot = d["token_usage_totals"]
    assert tot["input_tokens"] == 100
    assert tot["output_tokens"] == 50
    assert tot["total_tokens"] == 150
    assert tot["call_count"] == 1
    assert tot["estimated_cost_usd"] > 0


def test_pack_trace_text_truncates():
    long = "a" * 100
    p = pack_trace_text(long, 50)
    assert p["truncated"] is True
    assert p["total_chars"] == 100
    assert len(p["text"]) == 50


def test_pack_trace_text_short_untruncated():
    p = pack_trace_text("hello", 50)
    assert p["truncated"] is False
    assert p["text"] == "hello"
