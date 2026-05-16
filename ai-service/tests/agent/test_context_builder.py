"""Tests for ClinicalContextBuilder — diálogo recente, Layer 1, disposição no paciente."""

from src.agent.context_builder import context_builder, ClinicalContextBuilder
from src.agent.questionnaire_engine import questionnaire_engine
from src.agent.clinical_rules import (
    ClinicalRulesResult,
    RuleFinding,
    ER_DAYS,
    REMOTE_NURSING,
)


def _minimal_patient(**kwargs):
    base = {
        "id": "p1",
        "name": "Test",
        "cancerType": "bladder",
        "priorityCategory": "LOW",
        "priorityScore": 10,
    }
    base.update(kwargs)
    return base


def test_build_includes_patient_clinical_disposition_when_present():
    clinical = {"patient": _minimal_patient(clinicalDisposition="ER_DAYS", clinicalDispositionReason="Febre")}
    out = context_builder.build(clinical_context=clinical)
    assert "Disposição clínica (registro no prontuário)" in out
    assert "ER_DAYS" in out
    assert "Febre" in out


def test_build_recent_dialogue_snippets_bounded():
    clinical = {"patient": _minimal_patient()}
    history = [
        {"role": "user", "content": "msg1"},
        {"role": "assistant", "content": "msg2"},
        {"role": "user", "content": "msg3"},
        {"role": "assistant", "content": "msg4"},
        {"role": "user", "content": "msg5"},
        {"role": "assistant", "content": "msg6"},
    ]
    out = context_builder.build(clinical_context=clinical, conversation_history=history)
    assert "### Diálogo recente (resumo)" in out
    assert "msg2" in out
    assert "msg6" in out
    assert "msg1" not in out


def test_build_layer1_section_with_findings():
    clinical = {"patient": _minimal_patient()}
    layer1 = ClinicalRulesResult(
        disposition=ER_DAYS,
        reasoning="Febre em contexto de risco.",
        findings=[
            RuleFinding(
                rule_id="R12_FEVER_NO_CHEMO",
                disposition=ER_DAYS,
                reason="Febre",
            )
        ],
        requires_immediate_action=False,
        confidence=1.0,
    )
    symptom = {
        "detectedSymptoms": [{"name": "Febre", "severity": "HIGH", "confidence": 0.9}],
        "overallSeverity": "HIGH",
        "requiresEscalation": True,
    }
    out = context_builder.build(
        clinical_context=clinical,
        layer1_clinical_rules=layer1,
        symptom_analysis=symptom,
    )
    assert "### Triagem deste turno (Layer 1 — regras determinísticas)" in out
    assert "R12_FEVER_NO_CHEMO" in out
    assert "ER_DAYS" in out
    assert "Febre" in out


def test_build_context_includes_active_questionnaire_section():
    """Questionário ativo aparece no contexto estruturado para o Opus."""
    clinical = {"patient": _minimal_patient()}
    q_state = questionnaire_engine.build_initial_state("ESAS")
    out = context_builder.build(
        clinical_context=clinical,
        agent_state={"active_questionnaire": q_state},
    )
    assert "### Questionário ativo" in out
    assert "ESAS" in out
    assert "Passo atual" in out


def test_build_includes_age_when_present():
    clinical = {"patient": _minimal_patient(age=62)}
    out = context_builder.build(clinical_context=clinical)
    assert "**Idade**: 62 anos" in out


def test_build_slice_navigation_has_steps_not_observations():
    clinical = {
        "patient": _minimal_patient(),
        "navigationSteps": [
            {"stepName": "Cistoscopia", "status": "PENDING", "stepKey": "cys"}
        ],
        "observations": [{"display": "SpO2", "valueQuantity": 98}],
    }
    nav = context_builder.build_slice("navigation", clinical_context=clinical)
    assert "Navegação" in nav
    assert "Cistoscopia" in nav
    assert "Observações" not in nav


def test_build_full_still_includes_observations():
    clinical = {
        "patient": _minimal_patient(),
        "observations": [{"display": "SpO2", "valueQuantity": 98, "unit": "%"}],
    }
    full = context_builder.build(clinical_context=clinical)
    assert "Observações Clínicas" in full


def test_build_slice_symptom_has_diagnoses_not_navigation():
    clinical = {
        "patient": _minimal_patient(),
        "diagnoses": [{"cancerType": "bladder", "stage": "II"}],
        "navigationSteps": [{"stepName": "Etapa X", "status": "PENDING"}],
    }
    s = context_builder.build_slice("symptom", clinical_context=clinical)
    assert "Diagnósticos" in s
    assert "Navegação" not in s


def test_build_slice_questionnaire_responses_section():
    clinical = {
        "patient": _minimal_patient(),
        "questionnaireResponses": [{"completedAt": "2024-01-01", "scores": {"dor": 3}}],
    }
    q = context_builder.build_slice("questionnaire", clinical_context=clinical, agent_state={})
    assert "Últimos Questionários" in q


def test_build_slice_emotional_support_has_dialogue_not_diagnoses():
    clinical = {
        "patient": _minimal_patient(),
        "diagnoses": [{"cancerType": "bladder", "stage": "II"}],
    }
    hist = [{"role": "user", "content": "Estou com medo"}]
    emo = context_builder.build_slice(
        "emotional_support",
        clinical_context=clinical,
        conversation_history=hist,
    )
    assert "Diagnósticos" not in emo
    assert "medo" in emo


def test_nursing_role_label_in_dialogue():
    b = ClinicalContextBuilder()
    clinical = {"patient": _minimal_patient()}
    out = b.build(
        clinical_context=clinical,
        conversation_history=[{"role": "nursing", "content": "Olá, equipe de enfermagem aqui."}],
    )
    assert "Enfermagem" in out
