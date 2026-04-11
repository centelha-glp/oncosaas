"""Tests for protocol_engine (DB protocol conversion, merge rules)."""

from src.agent.protocol_engine import ProtocolEngine


def test_convert_db_protocol_merges_root_critical_symptoms() -> None:
    engine = ProtocolEngine()
    protocol = {
        "checkInRules": {
            "TREATMENT": {
                "frequency": "daily",
                "questionnaire": "ESAS",
                "criticalSymptoms": ["sintoma do estágio"],
            }
        },
        "criticalSymptoms": [{"keyword": "sintoma raiz"}],
    }
    converted = engine._convert_db_protocol(protocol)
    crit = converted["stages"]["TREATMENT"]["critical_symptoms"]
    assert "sintoma do estágio" in crit
    assert "sintoma raiz" in crit
    assert crit.index("sintoma do estágio") < crit.index("sintoma raiz")


def test_convert_db_protocol_dedupes_root_and_stage() -> None:
    engine = ProtocolEngine()
    protocol = {
        "checkInRules": {
            "TREATMENT": {
                "frequency": "daily",
                "questionnaire": "ESAS",
                "criticalSymptoms": ["febre neutropênica"],
            }
        },
        "criticalSymptoms": [
            {"keyword": "febre neutropênica"},
            {"keyword": "outro"},
        ],
    }
    converted = engine._convert_db_protocol(protocol)
    crit = converted["stages"]["TREATMENT"]["critical_symptoms"]
    assert crit.count("febre neutropênica") == 1
    assert "outro" in crit
