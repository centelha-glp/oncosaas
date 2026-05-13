"""
Defaults de provedor/modelo LLM a partir do ambiente (Settings em main),
com merge de overrides vindos do tenant (`agent_config`).

Precedência: campos presentes e não vazios em `agent_config` sobrescrevem env/defaults.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

# Literais canónicos (alinhados ao seed Prisma / comportamento anterior)
DEFAULT_ANTHROPIC_CHAT_MODEL = "claude-sonnet-4-6"
DEFAULT_OPENAI_CHAT_MODEL = "gpt-4o-mini"
DEFAULT_ORCHESTRATOR_MODEL = "claude-opus-4-6"
DEFAULT_SUBAGENT_MODEL = "claude-sonnet-4-6"
DEFAULT_OPENAI_AGENTIC_MODEL = "gpt-4o"

_OVERLAY_KEYS = (
    "llm_provider",
    "llm_model",
    "llm_fallback_provider",
    "llm_fallback_model",
    "orchestrator_model",
    "subagent_model",
    "anthropic_api_key",
    "openai_api_key",
)


def _app_settings():
    import main as main_mod

    return main_mod.settings


def build_llm_defaults_from_env(*, has_anthropic_key: bool) -> Dict[str, Any]:
    """Monta dict base (sem tenant): inferência de provedor se env não fixar."""
    s = _app_settings()
    prov = (s.llm_default_provider or "").strip().lower()
    if prov not in ("anthropic", "openai"):
        prov = "anthropic" if has_anthropic_key else "openai"

    model = (s.llm_default_model or "").strip()
    if not model:
        model = DEFAULT_ANTHROPIC_CHAT_MODEL if prov == "anthropic" else DEFAULT_OPENAI_CHAT_MODEL

    orch = (s.llm_orchestrator_model or "").strip() or DEFAULT_ORCHESTRATOR_MODEL
    sub = (s.llm_subagent_model or "").strip() or DEFAULT_SUBAGENT_MODEL
    openai_agentic = (s.llm_openai_agentic_model or "").strip() or DEFAULT_OPENAI_AGENTIC_MODEL

    out: Dict[str, Any] = {
        "llm_provider": prov,
        "llm_model": model,
        "orchestrator_model": orch,
        "subagent_model": sub,
        "llm_openai_agentic_model": openai_agentic,
    }

    fb_p = (s.llm_fallback_provider or "").strip().lower()
    fb_m = (s.llm_fallback_model or "").strip()
    if fb_p in ("anthropic", "openai") and fb_m:
        out["llm_fallback_provider"] = fb_p
        out["llm_fallback_model"] = fb_m

    return out


def merge_agent_llm_config(
    agent_config: Optional[Dict[str, Any]],
    *,
    has_anthropic_key: bool,
) -> Dict[str, Any]:
    """
    Retorna cópia mesclada para uso em `llm_provider` / orchestrator / rotas.

    `has_anthropic_key`: resultado de `llm_provider.has_anthropic_key(...)` com o
    mesmo `agent_config` (ou pré-merge) para inferência de provedor padrão.
    """
    base = build_llm_defaults_from_env(has_anthropic_key=has_anthropic_key)
    merged = dict(base)
    cfg = agent_config or {}
    for key in _OVERLAY_KEYS:
        if key not in cfg:
            continue
        val = cfg[key]
        if val is None:
            continue
        if isinstance(val, str) and not val.strip():
            continue
        merged[key] = val.strip() if isinstance(val, str) else val
    return merged
