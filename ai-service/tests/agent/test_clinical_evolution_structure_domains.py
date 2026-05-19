from src.agent.clinical_evolution_structure_domains import (
    RejectionItemOut,
    validate_extended_domains,
)


def test_validate_extended_domains_accepts_treatment_and_rejects_invalid():
    parsed = {
        "treatments": [
            {"treatment_type": "CHEMOTHERAPY", "treatment_name": "FOLFOX"},
            {"treatment_type": "INVALID_TYPE"},
        ],
        "complementary_exams": [
            {
                "type": "LABORATORY",
                "name": "Hemoglobina",
                "result": {"value_numeric": 12.1, "unit": "g/dL"},
            }
        ],
        "clinical_prescription_lines": [
            {
                "medication_name": "Omeprazol 20mg",
                "dosage": "20 mg",
                "frequency": "1x/dia",
            }
        ],
        "diagnoses": [],
        "navigation_step_updates": [],
        "observations": [],
        "performance_status_history": [{"ecog_score": 1}],
        "questionnaire_responses": [],
        "rejection_report": [],
    }
    out, rej = validate_extended_domains(parsed, [])
    assert len(out["treatments"]) == 1
    assert out["treatments"][0]["treatment_type"] == "CHEMOTHERAPY"
    assert len(out["complementary_exams"]) == 1
    assert len(out["clinical_prescription_lines"]) == 1
    assert len(rej) == 1
    assert rej[0].domain == "treatments"


def test_validate_extended_domains_rejects_bad_complementary_type():
    parsed = {
        "complementary_exams": [{"type": "CT_SCAN", "name": "TC tórax"}],
        "treatments": [],
        "diagnoses": [],
        "navigation_step_updates": [],
        "clinical_prescription_lines": [],
        "observations": [],
        "performance_status_history": [],
        "questionnaire_responses": [],
        "rejection_report": [],
    }
    out, rej = validate_extended_domains(parsed, [])
    assert out["complementary_exams"] == []
    assert any(r.domain == "complementary_exams" for r in rej)


def test_rejection_merge_preserves_existing():
    existing = [RejectionItemOut(domain="llm", reason="aviso")]
    parsed = {
        "treatments": [{"treatment_type": "NOT_A_REAL"}],
        "complementary_exams": [],
        "diagnoses": [],
        "navigation_step_updates": [],
        "clinical_prescription_lines": [],
        "observations": [],
        "performance_status_history": [],
        "questionnaire_responses": [],
        "rejection_report": [],
    }
    _, rej = validate_extended_domains(parsed, existing)
    assert len(rej) >= 2
    assert rej[0].domain == "llm"
