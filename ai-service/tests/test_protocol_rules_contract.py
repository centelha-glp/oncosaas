"""
Contrato backend (templates TS) ↔ PROTOCOL_RULES (protocol_engine).

Regenerar o snapshot após alterar templates: `npm run export-protocol-snapshot` na pasta backend.
"""

from __future__ import annotations

import json
from pathlib import Path

from src.agent.protocol_engine import PROTOCOL_RULES


def _snapshot_path() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    return repo_root / "shared" / "clinical-protocol-snapshot.v1.json"


def test_protocol_rules_match_backend_snapshot() -> None:
    path = _snapshot_path()
    assert path.is_file(), f"Fixture ausente: {path}"
    snapshot = json.loads(path.read_text(encoding="utf-8"))
    assert snapshot.get("version") == 1

    for cancer_type, payload in snapshot.get("cancerTypes", {}).items():
        assert cancer_type in PROTOCOL_RULES, f"Tipo {cancer_type!r} só no snapshot"
        stages_snap = payload.get("checkInRules") or {}
        stages_py = PROTOCOL_RULES[cancer_type]["stages"]
        for stage, rules in stages_snap.items():
            py_stage = stages_py.get(stage)
            assert py_stage is not None, f"{cancer_type}/{stage} ausente no Python"
            freq = rules.get("frequency")
            q = rules.get("questionnaire")
            assert py_stage["check_in_frequency"] == freq
            q_py = py_stage["questionnaire"]
            assert (q_py is None and q is None) or (q_py == q)
