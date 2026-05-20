from src.agent.clinical_evolution_truncation import (
    MARKDOWN_MAX,
    SNAPSHOT_JSON_MAX,
    prepare_structure_inputs,
    truncate_evolution_markdown,
    truncate_snapshot_json,
)


def test_truncate_snapshot_prioritizes_medications_key():
    snap = {
        "observations": ["x" * 5000],
        "history": ["y" * 5000],
        "medications": [{"name": "Metformina"}],
        "performanceStatus": 1,
    }
    out = truncate_snapshot_json(snap, limit=800)
    assert "Metformina" in out
    assert len(out) <= 800


def test_truncate_markdown_preserves_exam_keywords():
    md = "\n".join(
        [
            "# Evolução longa",
            *[f"Texto filler linha {i}." for i in range(120)],
            "Solicito hemograma completo e função renal.",
            "ECOG 1.",
            "Conduta: manter quimioterapia.",
        ]
    )
    out = truncate_evolution_markdown(md, limit=1200)
    assert "hemograma" in out.lower()
    assert len(out) <= 1200


def test_prepare_structure_inputs_respects_limits():
    snap = {"medications": [{"name": "A"}]}
    md = "x" * (MARKDOWN_MAX + 500)
    snap_json, trimmed_md = prepare_structure_inputs(
        patient_snapshot=snap,
        content_markdown=md,
    )
    assert len(snap_json) <= SNAPSHOT_JSON_MAX + 4
    assert len(trimmed_md) <= MARKDOWN_MAX + 50
