"""
Preços unitários estimados (USD por 1M tokens) para custo aproximado por request.
Valores padrão são referência de mercado — ajuste via LLM_PRICING_JSON no .env se necessário.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# (input_usd_per_mtok, output_usd_per_mtok) — ordem: match mais específico primeiro
_DEFAULT_ANTHROPIC_RATES: Tuple[Tuple[str, Tuple[float, float]], ...] = (
    ("claude-opus-4", (15.0, 75.0)),
    ("claude-sonnet-4", (3.0, 15.0)),
    ("claude-haiku-4", (1.0, 5.0)),
    ("claude-3-5-sonnet", (3.0, 15.0)),
    ("claude-3-opus", (15.0, 75.0)),
    ("claude-3-sonnet", (3.0, 15.0)),
    ("claude-3-haiku", (0.25, 1.25)),
    ("claude", (3.0, 15.0)),
)
_DEFAULT_OPENAI_RATES: Tuple[Tuple[str, Tuple[float, float]], ...] = (
    ("gpt-4o", (2.5, 10.0)),
    ("gpt-4-turbo", (10.0, 30.0)),
    ("gpt-4", (30.0, 60.0)),
    ("gpt-3.5", (0.5, 1.5)),
    ("o1", (15.0, 60.0)),
    ("gpt", (2.5, 10.0)),
)


def _rates_from_env() -> Optional[Dict[str, Any]]:
    raw = os.getenv("LLM_PRICING_JSON", "").strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("LLM_PRICING_JSON inválido, ignorando: %s", e)
        return None


def _lookup_rates(
    table: Tuple[Tuple[str, Tuple[float, float]], ...],
    model: str,
) -> Tuple[float, float]:
    m = (model or "").lower()
    for prefix, rates in table:
        if prefix in m:
            return rates
    return (3.0, 15.0)


def get_usd_per_million_tokens(provider: str, model: str) -> Tuple[float, float]:
    """
    Retorna (preço_input_usd_por_1M_tokens, preço_output_usd_por_1M_tokens).
    """
    env_rates = _rates_from_env()
    if env_rates and isinstance(env_rates, dict):
        key = f"{(provider or '').lower()}:{(model or '').lower()}"
        entry = env_rates.get(key) or env_rates.get(model or "")
        if isinstance(entry, (list, tuple)) and len(entry) >= 2:
            try:
                return float(entry[0]), float(entry[1])
            except (TypeError, ValueError):
                pass
    p = (provider or "").lower()
    if p == "openai":
        return _lookup_rates(_DEFAULT_OPENAI_RATES, model)
    return _lookup_rates(_DEFAULT_ANTHROPIC_RATES, model)


def estimate_cost_usd(
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """Custo estimado em USD (6 casas decimais)."""
    inp_r, out_r = get_usd_per_million_tokens(provider, model)
    cost = (max(0, input_tokens) / 1_000_000.0) * inp_r + (
        max(0, output_tokens) / 1_000_000.0
    ) * out_r
    return round(cost, 6)


def usage_event(
    *,
    step: str,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Um evento normalizado para o trace (tokens + custo estimado)."""
    ev: Dict[str, Any] = {
        "step": step,
        "provider": provider,
        "model": model or "",
        "input_tokens": int(max(0, input_tokens)),
        "output_tokens": int(max(0, output_tokens)),
    }
    ev["total_tokens"] = ev["input_tokens"] + ev["output_tokens"]
    ev["cost_usd"] = estimate_cost_usd(
        provider, model, ev["input_tokens"], ev["output_tokens"]
    )
    if extra:
        ev.update(extra)
    return ev


def sum_usage_events(events: list) -> Dict[str, Any]:
    """Agrega lista de eventos (mesmo schema que usage_event)."""
    inp = sum(int(e.get("input_tokens", 0) or 0) for e in events)
    out = sum(int(e.get("output_tokens", 0) or 0) for e in events)
    cost = sum(float(e.get("cost_usd", 0) or 0) for e in events)
    return {
        "input_tokens": inp,
        "output_tokens": out,
        "total_tokens": inp + out,
        "estimated_cost_usd": round(cost, 6),
        "call_count": len(events),
    }
