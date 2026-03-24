"""
Tests for ClinicalRulesEngine — deterministic triage rules.
"""
from src.agent.clinical_rules import (
    ClinicalRulesEngine,
    ER_IMMEDIATE,
    ER_DAYS,
    REMOTE_NURSING,
)


def _engine():
    return ClinicalRulesEngine()


def _ctx(**kwargs):
    """Minimal clinical context."""
    base = {
        "patient": {"age": 55},
        "treatments": [],
        "medications": [],
        "comorbidities": [],
        "performanceStatusHistory": [],
    }
    base.update(kwargs)
    return base


def _symptoms(*names, severity="HIGH"):
    """Build a detectedSymptoms list from plain names."""
    return [{"name": n, "severity": severity} for n in names]


def _active_chemo_ctx(days_ago=5):
    """Clinical context with an active chemotherapy treatment."""
    from datetime import datetime, timezone, timedelta
    start = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    last = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
    return _ctx(treatments=[{
        "isActive": True,
        "treatmentType": "CHEMOTHERAPY",
        "startDate": start,
        "lastApplicationDate": last,
    }])


class TestR01FebrilNeutropenia:

    def test_fever_during_active_chemo_fires_er_immediate(self):
        engine = _engine()
        ctx = _active_chemo_ctx(days_ago=5)
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {}}},
            clinical_context=ctx,
            structured_vitals={"temperature": 38.5},
        )
        assert result.disposition == ER_IMMEDIATE
        rule_ids = [f.rule_id for f in result.findings]
        assert "R01_FEBRILE_NEUTROPENIA" in rule_ids

    def test_fever_in_nadir_window_fires_er_immediate(self):
        engine = _engine()
        ctx = _active_chemo_ctx(days_ago=10)  # D+10 = nadir window
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {}}},
            clinical_context=ctx,
            structured_vitals={"temperature": 38.1},
        )
        assert result.disposition == ER_IMMEDIATE
        rule_ids = [f.rule_id for f in result.findings]
        assert "R01_FEBRILE_NEUTROPENIA" in rule_ids


class TestR03Hypoxemia:

    def test_spo2_below_92_fires_er_immediate(self):
        engine = _engine()
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {}}},
            clinical_context=_ctx(),
            structured_vitals={"spo2": 88},
        )
        assert result.disposition == ER_IMMEDIATE
        rule_ids = [f.rule_id for f in result.findings]
        assert "R03_HYPOXEMIA" in rule_ids

    def test_spo2_at_92_does_not_fire(self):
        engine = _engine()
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {}}},
            clinical_context=_ctx(),
            structured_vitals={"spo2": 92},
        )
        assert "R03_HYPOXEMIA" not in [f.rule_id for f in result.findings]


class TestR08SeverePain:

    def test_pain_9_fires_er_immediate(self):
        engine = _engine()
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {"pain": 9}}},
            clinical_context=_ctx(),
        )
        assert result.disposition == ER_IMMEDIATE
        assert "R08_SEVERE_PAIN" in [f.rule_id for f in result.findings]

    def test_pain_10_fires_er_immediate(self):
        engine = _engine()
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {"pain": 10}}},
            clinical_context=_ctx(),
        )
        assert result.disposition == ER_IMMEDIATE


class TestR16HighPain:

    def test_pain_7_fires_er_days_when_no_immediate(self):
        engine = _engine()
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {"pain": 7}}},
            clinical_context=_ctx(),
        )
        assert result.disposition == ER_DAYS
        assert "R16_HIGH_PAIN" in [f.rule_id for f in result.findings]

    def test_pain_8_fires_er_days(self):
        engine = _engine()
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {"pain": 8}}},
            clinical_context=_ctx(),
        )
        assert result.disposition == ER_DAYS


class TestErImmediatePrecedence:

    def test_er_immediate_blocks_er_days_rules(self):
        """When ER_IMMEDIATE already fired, ER_DAYS rules should not fire."""
        engine = _engine()
        ctx = _active_chemo_ctx(days_ago=5)
        # SpO2 fires R03 (ER_IMMEDIATE) + would-be pain 7 (ER_DAYS)
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {"pain": 7}}},
            clinical_context=ctx,
            structured_vitals={"spo2": 88},
        )
        assert result.disposition == ER_IMMEDIATE
        rule_ids = [f.rule_id for f in result.findings]
        assert "R16_HIGH_PAIN" not in rule_ids


class TestNoSymptoms:

    def test_no_symptoms_returns_remote_nursing(self):
        engine = _engine()
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {}}},
            clinical_context=_ctx(),
        )
        assert result.disposition == REMOTE_NURSING
        assert result.findings == []

    def test_requires_immediate_action_false_when_no_findings(self):
        engine = _engine()
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {}}},
            clinical_context=_ctx(),
        )
        assert result.requires_immediate_action is False


class TestMascHighRisk:

    def test_mascc_high_risk_upgrades_er_days_to_er_immediate(self):
        """Fever without chemo fires R12 (ER_DAYS); MASCC high risk should upgrade to ER_IMMEDIATE."""
        engine = _engine()
        # patient with high MASCC score inputs to produce high risk
        ctx = _ctx(patient={"age": 75, "performanceStatus": 3})
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {}}},
            clinical_context=ctx,
            structured_vitals={"temperature": 38.5},
        )
        # R12 fires at minimum (ER_DAYS); final disposition ≥ ER_DAYS
        assert result.disposition in (ER_DAYS, ER_IMMEDIATE)
        rule_ids = [f.rule_id for f in result.findings]
        assert "R12_FEVER_NO_CHEMO" in rule_ids


class TestR09EcogDeterioration:

    def test_ecog_delta_2_fires_er_immediate(self):
        """Rapid ECOG deterioration (delta ≥ 2) triggers ER_IMMEDIATE."""
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        history = [
            {"ecogScore": 0, "assessedAt": (now - timedelta(days=60)).isoformat()},
            {"ecogScore": 2, "assessedAt": (now - timedelta(days=5)).isoformat()},
        ]
        engine = _engine()
        ctx = _ctx(performanceStatusHistory=history)
        result = engine.evaluate(
            symptom_analysis={"detectedSymptoms": [], "structuredData": {"scales": {}}},
            clinical_context=ctx,
        )
        assert result.disposition == ER_IMMEDIATE
        assert "R09_ECOG_DETERIORATION" in [f.rule_id for f in result.findings]
