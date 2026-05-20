"""Garante que só o prompt v3 é usado na rota de estruturação."""

from src.agent.prompts import clinical_evolution_structure_prompt as prompt_mod
from src.routes import clinical_evolution_structure as ces


def test_structure_route_imports_v3_only():
    assert ces.SYSTEM_STRUCTURE_EVOLUTION_V3 is prompt_mod.SYSTEM_STRUCTURE_EVOLUTION_V3
    assert "DEPRECATED" in prompt_mod.SYSTEM_STRUCTURE_EVOLUTION_V2


def test_structure_route_does_not_reference_v2_symbol():
    import inspect

    src = inspect.getsource(ces.structure_signed_evolution)
    assert "SYSTEM_STRUCTURE_EVOLUTION_V2" not in src
