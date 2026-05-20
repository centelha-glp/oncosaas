"""Testes do TurnContextCache (build_slice lazy)."""

from src.agent.context_builder import context_builder


def _minimal_clinical_context():
    return {
        "patient": {
            "name": "Paciente Teste",
            "cancerType": "breast",
            "stage": "II",
            "currentStage": "TREATMENT",
        },
        "navigationSteps": [
            {"status": "PENDING", "stepName": "Consulta", "dueDate": "2026-06-01"},
        ],
    }


def test_turn_context_cache_reuses_slice():
    structured = context_builder.build(clinical_context=_minimal_clinical_context())
    cache = context_builder.cache_for_turn(
        structured,
        clinical_context=_minimal_clinical_context(),
        conversation_history=[],
        agent_state={},
    )
    first = cache.slice("navigation")
    second = cache.slice("navigation")
    assert first is second
    assert "Etapas de Navegação" in first or "Consulta" in first
