"""
Truncamento inteligente de snapshot + markdown para estruturação de evolução.

Limites (caracteres UTF-8, alinhados ao contrato histórico):
- SNAPSHOT_JSON_MAX = 14_000
- MARKDOWN_MAX = 28_000

Heurística: preservar meds, solicitações de exame, ECOG/performance e blocos finais
da evolução antes de cortar observações/histórico volumoso no snapshot.
"""

from __future__ import annotations

import json
import re
from typing import Any

# Limites documentados — alterar apenas com revisão de contrato Nest/ai-service.
SNAPSHOT_JSON_MAX = 14_000
MARKDOWN_MAX = 28_000

_SNAPSHOT_PRIORITY_KEYS = (
    "medications",
    "medication",
    "currentMedications",
    "clinical_exam_requests",
    "examRequests",
    "treatments",
    "performanceStatus",
    "ecog",
    "performance_status",
    "diagnoses",
    "cancerType",
    "stage",
    "patient",
)


def _truncate_text(text: str, limit: int, suffix: str = "…") -> str:
    if len(text) <= limit:
        return text
    keep = max(0, limit - len(suffix))
    return text[:keep] + suffix


def _prioritize_snapshot_dict(snap: dict[str, Any]) -> dict[str, Any]:
    if not snap:
        return {}
    priority: dict[str, Any] = {}
    rest: dict[str, Any] = {}
    for k, v in snap.items():
        kl = str(k).lower()
        if any(p.lower() in kl or kl == p.lower() for p in _SNAPSHOT_PRIORITY_KEYS):
            priority[k] = v
        else:
            rest[k] = v
    ordered: dict[str, Any] = {**priority, **rest}
    return ordered


def truncate_snapshot_json(snap: dict[str, Any], limit: int = SNAPSHOT_JSON_MAX) -> str:
    """Serializa snapshot priorizando campos clínicos críticos; trunca se necessário."""
    if not snap:
        return "{}"
    ordered = _prioritize_snapshot_dict(snap)
    full = json.dumps(ordered, ensure_ascii=False)
    if len(full) <= limit:
        return full

    # Reduz listas volumosas não prioritárias antes do corte bruto.
    trimmed = dict(ordered)
    for key in list(trimmed.keys()):
        val = trimmed[key]
        if isinstance(val, list) and len(val) > 12:
            kl = str(key).lower()
            if not any(p.lower() in kl for p in _SNAPSHOT_PRIORITY_KEYS):
                trimmed[key] = val[:12]
    partial = json.dumps(trimmed, ensure_ascii=False)
    if len(partial) <= limit:
        return partial

    return _truncate_text(partial, limit, suffix="…")


_EXAM_LINE_RE = re.compile(
    r"(?i)\b(solicito|solicita|pedido|requisito|hemograma|exame|tomografia|ressonância|"
    r"ressonancia|pet|mamografia|ultrassom|ecog|performance|medicamento|mg\b|ml\b)"
)


def _score_markdown_line(line: str) -> int:
    s = 0
    if _EXAM_LINE_RE.search(line):
        s += 3
    if re.search(r"(?i)\b(ecog|karnofsky|performance)\b", line):
        s += 2
    if re.search(r"(?i)^(#{1,4}\s|[-*]\s)", line.strip()):
        s += 1
    return s


def truncate_evolution_markdown(md: str, limit: int = MARKDOWN_MAX) -> str:
    """
    Mantém cabeçalho + linhas de maior relevância clínica; se ainda longo,
    preserva início e final (conduta/solicitações costumam estar no fim).
    """
    text = md or ""
    if len(text) <= limit:
        return text

    lines = text.splitlines()
    if len(lines) <= 4:
        return _truncate_text(text, limit, suffix="\n…")

    scored: list[tuple[int, int, str]] = []
    for i, line in enumerate(lines):
        scored.append((_score_markdown_line(line), i, line))

    # Sempre manter primeiras linhas (contexto) e últimas 40% das linhas (conduta).
    head_count = min(40, max(8, len(lines) // 8))
    tail_count = min(80, max(12, len(lines) // 3))
    keep_idx = set(range(head_count)) | set(range(max(0, len(lines) - tail_count), len(lines)))

    # Acrescentar linhas de alta pontuação até aproximar o limite.
    for score, idx, _line in sorted(scored, key=lambda x: (-x[0], x[1])):
        if score <= 0:
            continue
        keep_idx.add(idx)
        candidate = "\n".join(lines[i] for i in sorted(keep_idx))
        if len(candidate) >= limit * 0.92:
            break

    selected = [lines[i] for i in sorted(keep_idx)]
    merged = "\n".join(selected)
    if len(merged) <= limit:
        return merged

    # Fallback: início + fim com marcador.
    half = (limit - 30) // 2
    head = text[:half]
    tail = text[-half:]
    return f"{head}\n\n…\n\n{tail}"


def prepare_structure_inputs(
    *,
    patient_snapshot: dict[str, Any],
    content_markdown: str,
) -> tuple[str, str]:
    """Retorna (snap_json, markdown) truncados conforme limites documentados."""
    snap_json = truncate_snapshot_json(patient_snapshot or {})
    md = truncate_evolution_markdown(content_markdown or "")
    return snap_json, md
