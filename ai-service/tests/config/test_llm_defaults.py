"""Tests for env-backed LLM default merge."""

from src.config.llm_defaults import merge_agent_llm_config


def test_merge_tenant_overrides_env(monkeypatch):
    import main

    monkeypatch.setattr(main.settings, "llm_default_provider", "openai", raising=False)
    monkeypatch.setattr(main.settings, "llm_default_model", "gpt-4o-mini", raising=False)
    monkeypatch.setattr(main.settings, "llm_orchestrator_model", "claude-opus-4-6", raising=False)
    monkeypatch.setattr(main.settings, "llm_subagent_model", "claude-sonnet-4-6", raising=False)
    monkeypatch.setattr(main.settings, "llm_fallback_provider", "", raising=False)
    monkeypatch.setattr(main.settings, "llm_fallback_model", "", raising=False)
    monkeypatch.setattr(main.settings, "llm_openai_agentic_model", "gpt-4o", raising=False)

    merged = merge_agent_llm_config(
        {"llm_provider": "anthropic", "llm_model": "claude-3-5-haiku-20241022"},
        has_anthropic_key=True,
    )
    assert merged["llm_provider"] == "anthropic"
    assert merged["llm_model"] == "claude-3-5-haiku-20241022"
    assert merged["orchestrator_model"] == "claude-opus-4-6"


def test_merge_respects_has_anthropic_when_provider_unset(monkeypatch):
    import main

    monkeypatch.setattr(main.settings, "llm_default_provider", "", raising=False)
    monkeypatch.setattr(main.settings, "llm_default_model", "", raising=False)
    monkeypatch.setattr(main.settings, "llm_orchestrator_model", "claude-opus-4-6", raising=False)
    monkeypatch.setattr(main.settings, "llm_subagent_model", "claude-sonnet-4-6", raising=False)
    monkeypatch.setattr(main.settings, "llm_fallback_provider", "", raising=False)
    monkeypatch.setattr(main.settings, "llm_fallback_model", "", raising=False)
    monkeypatch.setattr(main.settings, "llm_openai_agentic_model", "gpt-4o", raising=False)

    anthropic = merge_agent_llm_config({}, has_anthropic_key=True)
    assert anthropic["llm_provider"] == "anthropic"
    assert anthropic["llm_model"] == "claude-sonnet-4-6"

    openai = merge_agent_llm_config({}, has_anthropic_key=False)
    assert openai["llm_provider"] == "openai"
    assert openai["llm_model"] == "gpt-4o-mini"
