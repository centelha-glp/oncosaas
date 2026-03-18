"""
Clinical Rules Engine — Layer 1 (Deterministic Hard Rules).

Implements evidence-based triage rules for oncology patients based on protocols
from AC Camargo, Sírio-Libanês, ICESP, Mayo Clinic, and MASCC/CISNE guidelines.

Rules fire BEFORE the ML model and cannot be overridden by it.
Disposition levels (ascending severity):
  REMOTE_NURSING → SCHEDULED_CONSULT → ADVANCE_CONSULT → ER_DAYS → ER_IMMEDIATE
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import logging

from .clinical_scores import clinical_scores

logger = logging.getLogger(__name__)

# ─── Disposition constants ────────────────────────────────────────────────────

REMOTE_NURSING = "REMOTE_NURSING"
SCHEDULED_CONSULT = "SCHEDULED_CONSULT"
ADVANCE_CONSULT = "ADVANCE_CONSULT"
ER_DAYS = "ER_DAYS"
ER_IMMEDIATE = "ER_IMMEDIATE"

_SEVERITY_ORDER = {
    REMOTE_NURSING: 0,
    SCHEDULED_CONSULT: 1,
    ADVANCE_CONSULT: 2,
    ER_DAYS: 3,
    ER_IMMEDIATE: 4,
}


@dataclass
class RuleFinding:
    """A single rule that fired during evaluation."""
    rule_id: str
    disposition: str          # One of the 5 disposition constants
    reason: str               # Human-readable clinical reasoning
    confidence: float = 1.0   # 0–1; hard rules default to 1.0
    evidence: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ClinicalRulesResult:
    """Output of the clinical rules evaluation."""
    disposition: str                        # Recommended disposition
    reasoning: str                          # Composite clinical reasoning
    findings: List[RuleFinding]             # All rules that fired
    requires_immediate_action: bool         # True when disposition >= ER_DAYS
    confidence: float = 1.0

    @property
    def is_er(self) -> bool:
        return self.disposition in (ER_DAYS, ER_IMMEDIATE)

    @property
    def is_immediate(self) -> bool:
        return self.disposition == ER_IMMEDIATE


class ClinicalRulesEngine:
    """
    Deterministic clinical rules engine for oncology triage.

    Evaluation order (highest priority first):
      1. ER_IMMEDIATE rules — any match halts further escalation checks
      2. ER_DAYS rules
      3. ADVANCE_CONSULT rules
      4. SCHEDULED_CONSULT rules
      5. Default → REMOTE_NURSING
    """

    def evaluate(
        self,
        symptom_analysis: Dict[str, Any],
        clinical_context: Dict[str, Any],
        structured_vitals: Optional[Dict[str, Any]] = None,
    ) -> ClinicalRulesResult:
        """
        Run all clinical rules against current patient data.

        Args:
            symptom_analysis:  Output of SymptomAnalyzer.analyze()
            clinical_context:  Full patient context from ContextBuilder
            structured_vitals: Optional vital signs {temperature, spo2, hr, bp_sys}

        Returns:
            ClinicalRulesResult with the recommended disposition and all findings
        """
        findings: List[RuleFinding] = []

        treatments = clinical_context.get("treatments", [])
        medications = clinical_context.get("medications", [])
        performance_history = clinical_context.get("performanceStatusHistory", [])
        detected_symptoms = symptom_analysis.get("detectedSymptoms", [])
        structured_data = symptom_analysis.get("structuredData", {})
        scales = structured_data.get("scales", {})

        vitals = structured_vitals or {}
        temperature = vitals.get("temperature") or scales.get("temperature")
        spo2 = vitals.get("spo2")
        pain_score = vitals.get("pain") or scales.get("pain")

        # Pre-compute clinical context flags
        in_chemo = self._is_in_chemo(treatments)
        days_since_chemo = self._days_since_last_chemo(treatments)
        in_nadir_window = (
            days_since_chemo is not None and 7 <= days_since_chemo <= 14
        )
        in_risk_window = (
            days_since_chemo is not None and days_since_chemo <= 21
        )
        ecog_delta = self._calculate_ecog_delta(performance_history)
        has_anticoagulant = self._has_medication_flag(medications, "isAnticoagulant")
        has_immunosuppressant = self._has_medication_flag(medications, "isImmunosuppressant")
        has_corticosteroid = self._has_medication_flag(medications, "isCorticosteroid")

        symptom_names = {s.get("name", "").lower() for s in detected_symptoms}
        symptom_actions = {s.get("action", "") for s in detected_symptoms}

        # ─────────────────────────────────────────────────────────────────────
        # LAYER 1-A: ER_IMMEDIATE rules
        # ─────────────────────────────────────────────────────────────────────

        # R01: Febrile neutropenia risk — fever during active chemotherapy
        if temperature is not None and temperature >= 38.0 and (in_chemo or in_risk_window):
            window_note = f"janela de nadir D+{days_since_chemo}" if in_nadir_window else f"D+{days_since_chemo} pós-quimio"
            findings.append(RuleFinding(
                rule_id="R01_FEBRILE_NEUTROPENIA",
                disposition=ER_IMMEDIATE,
                reason=f"Febre {temperature}°C em paciente em quimioterapia ({window_note}). "
                       f"Risco de neutropenia febril — emergência oncológica.",
                evidence={"temperature": temperature, "days_since_chemo": days_since_chemo, "in_nadir_window": in_nadir_window},
            ))

        # R02: Fever in nadir window even without explicit temperature reading
        elif in_nadir_window and self._has_symptom(symptom_names, {"febre", "febre_neutropenica", "febril"}):
            findings.append(RuleFinding(
                rule_id="R02_NADIR_FEVER",
                disposition=ER_IMMEDIATE,
                reason=f"Relato de febre durante janela de nadir (D+{days_since_chemo}). "
                       f"Alta probabilidade de neutropenia febril — emergência oncológica.",
                evidence={"days_since_chemo": days_since_chemo},
            ))

        # R03: Respiratory distress
        if spo2 is not None and spo2 < 92:
            findings.append(RuleFinding(
                rule_id="R03_HYPOXEMIA",
                disposition=ER_IMMEDIATE,
                reason=f"SpO2 {spo2}% — hipoxemia grave. Ir ao Pronto-Socorro imediatamente.",
                evidence={"spo2": spo2},
            ))

        if self._has_symptom(symptom_names, {"dispneia", "dispnéia", "falta de ar"}) and (
            any(s.get("severity") == "CRITICAL" for s in detected_symptoms
                if s.get("name", "").lower() in {"dispneia", "dispnéia", "falta de ar"})
        ):
            findings.append(RuleFinding(
                rule_id="R04_SEVERE_DYSPNEA",
                disposition=ER_IMMEDIATE,
                reason="Dispneia grave relatada. Avaliação de emergência imediata necessária.",
            ))

        # R05: Active severe bleeding
        if self._has_symptom(symptom_names, {"sangramento", "sangue", "hemorragia"}):
            bleeding_symptoms = [
                s for s in detected_symptoms
                if s.get("name", "").lower() in {"sangramento", "sangue", "hemorragia"}
                and s.get("severity") in ("HIGH", "CRITICAL")
            ]
            if bleeding_symptoms or has_anticoagulant:
                reason = "Sangramento ativo em paciente oncológico."
                if has_anticoagulant:
                    reason += " Paciente em uso de anticoagulante — risco aumentado de hemorragia grave."
                findings.append(RuleFinding(
                    rule_id="R05_ACTIVE_BLEEDING",
                    disposition=ER_IMMEDIATE,
                    reason=reason,
                    evidence={"has_anticoagulant": has_anticoagulant},
                ))

        # R06: Altered consciousness / encephalopathy
        if self._has_symptom(symptom_names, {"confusao_mental", "confusão", "desorientado", "alteração de consciência"}):
            findings.append(RuleFinding(
                rule_id="R06_ALTERED_CONSCIOUSNESS",
                disposition=ER_IMMEDIATE,
                reason="Alteração do nível de consciência / confusão mental. Avaliação emergencial imediata.",
            ))

        # R07: Incoercible vomiting during chemotherapy
        if self._has_symptom(symptom_names, {"vomito_incoercivel", "vômito"}) and (in_chemo or in_risk_window):
            findings.append(RuleFinding(
                rule_id="R07_INCOERCIBLE_VOMITING",
                disposition=ER_IMMEDIATE,
                reason="Vômitos incoercíveis durante quimioterapia — risco de desidratação grave e distúrbio eletrolítico.",
                evidence={"in_chemo": in_chemo},
            ))

        # R08: Severe uncontrolled pain (≥9/10)
        if pain_score is not None and int(pain_score) >= 9:
            findings.append(RuleFinding(
                rule_id="R08_SEVERE_PAIN",
                disposition=ER_IMMEDIATE,
                reason=f"Dor {pain_score}/10 — dor oncológica severa não controlada. Avaliação emergencial para ajuste analgésico.",
                evidence={"pain_score": pain_score},
            ))

        # R09: Rapid ECOG deterioration (delta ≥ 2)
        if ecog_delta is not None and ecog_delta >= 2:
            findings.append(RuleFinding(
                rule_id="R09_ECOG_DETERIORATION",
                disposition=ER_IMMEDIATE,
                reason=f"Deterioração rápida do status funcional (ECOG piorou {ecog_delta} pontos). "
                       f"Possível progressão de doença ou complicação grave.",
                evidence={"ecog_delta": ecog_delta},
            ))

        # R10: Suspected spinal cord compression
        if self._has_symptom(symptom_names, {"compressão medular", "fraqueza nas pernas", "perda do controle urinário"}):
            findings.append(RuleFinding(
                rule_id="R10_SPINAL_CORD_COMPRESSION",
                disposition=ER_IMMEDIATE,
                reason="Suspeita de compressão medular — emergência neurológica oncológica.",
            ))

        # R11: Fever + immunosuppressant/corticosteroid — masked sepsis risk
        if temperature is not None and temperature >= 38.0 and (has_immunosuppressant or has_corticosteroid):
            already_r01 = any(f.rule_id == "R01_FEBRILE_NEUTROPENIA" for f in findings)
            if not already_r01:
                reason = f"Febre {temperature}°C em paciente imunossuprimido."
                if has_corticosteroid:
                    reason += " Corticosteroide pode mascarar sinais de sepse."
                findings.append(RuleFinding(
                    rule_id="R11_IMMUNOSUPPRESSED_FEVER",
                    disposition=ER_IMMEDIATE,
                    reason=reason,
                    evidence={"temperature": temperature, "has_immunosuppressant": has_immunosuppressant, "has_corticosteroid": has_corticosteroid},
                ))

        # ─────────────────────────────────────────────────────────────────────
        # LAYER 1-B: ER_DAYS rules (only if no ER_IMMEDIATE fired)
        # ─────────────────────────────────────────────────────────────────────

        has_immediate = any(f.disposition == ER_IMMEDIATE for f in findings)

        if not has_immediate:
            # R12: Fever in patient NOT on active chemo
            if temperature is not None and temperature >= 38.0:
                findings.append(RuleFinding(
                    rule_id="R12_FEVER_NO_CHEMO",
                    disposition=ER_DAYS,
                    reason=f"Febre {temperature}°C em paciente oncológico fora de quimioterapia. "
                           f"Avaliação médica nas próximas horas.",
                    evidence={"temperature": temperature},
                ))

            # R13: Bowel obstruction
            if self._has_symptom(symptom_names, {"obstrucao_intestinal", "obstrução intestinal", "distensão abdominal"}):
                findings.append(RuleFinding(
                    rule_id="R13_BOWEL_OBSTRUCTION",
                    disposition=ER_DAYS,
                    reason="Sinais de obstrução intestinal. Avaliação cirúrgica urgente necessária.",
                ))

            # R14: Severe diarrhea (dehydration risk)
            if self._has_symptom(symptom_names, {"diarreia_severa", "diarreia severa"}):
                findings.append(RuleFinding(
                    rule_id="R14_SEVERE_DIARRHEA",
                    disposition=ER_DAYS,
                    reason="Diarreia severa — risco de desidratação e distúrbio eletrolítico. "
                           "Avaliação médica nas próximas horas.",
                ))

            # R15: DVT / thrombosis symptoms
            if self._has_symptom(symptom_names, {"trombose", "tvp", "perna inchada", "perna vermelha", "dor na perna"}):
                reason = "Suspeita de trombose venosa profunda."
                if has_anticoagulant:
                    reason += " Paciente já em anticoagulante — verificar subterapêutico."
                findings.append(RuleFinding(
                    rule_id="R15_DVT_SUSPICION",
                    disposition=ER_DAYS,
                    reason=reason,
                ))

            # R16: Uncontrolled pain 7-8/10
            if pain_score is not None and 7 <= int(pain_score) <= 8:
                findings.append(RuleFinding(
                    rule_id="R16_HIGH_PAIN",
                    disposition=ER_DAYS,
                    reason=f"Dor {pain_score}/10 não controlada. Avaliação médica nas próximas horas para ajuste analgésico.",
                    evidence={"pain_score": pain_score},
                ))

            # R17: Severe mucositis (unable to swallow)
            if self._has_symptom(symptom_names, {"mucosite"}) and self._has_symptom(
                symptom_names, {"não consigo comer", "não consigo engolir", "não bebo"}
            ):
                findings.append(RuleFinding(
                    rule_id="R17_SEVERE_MUCOSITIS",
                    disposition=ER_DAYS,
                    reason="Mucosite grave com disfagia — risco de desidratação e desnutrição aguda.",
                ))

        # ─────────────────────────────────────────────────────────────────────
        # LAYER 1-C: ADVANCE_CONSULT rules
        # ─────────────────────────────────────────────────────────────────────

        has_er = any(f.disposition in (ER_IMMEDIATE, ER_DAYS) for f in findings)

        if not has_er:
            # R18: Moderate ECOG deterioration (delta +1)
            if ecog_delta is not None and ecog_delta == 1:
                findings.append(RuleFinding(
                    rule_id="R18_ECOG_DECLINE",
                    disposition=ADVANCE_CONSULT,
                    reason="Declínio funcional de 1 ponto ECOG. Consulta antecipada para reavaliação clínica.",
                    evidence={"ecog_delta": ecog_delta},
                ))

            # R19: Moderate pain 5-6/10
            if pain_score is not None and 5 <= int(pain_score) <= 6:
                findings.append(RuleFinding(
                    rule_id="R19_MODERATE_PAIN",
                    disposition=ADVANCE_CONSULT,
                    reason=f"Dor {pain_score}/10 — analgesia insuficiente. Consulta antecipada para revisão do esquema.",
                    evidence={"pain_score": pain_score},
                ))

            # R20: High symptom burden (multiple symptoms at HIGH)
            high_severity_count = sum(
                1 for s in detected_symptoms if s.get("severity") in ("HIGH", "CRITICAL")
            )
            if high_severity_count >= 3:
                findings.append(RuleFinding(
                    rule_id="R20_HIGH_SYMPTOM_BURDEN",
                    disposition=ADVANCE_CONSULT,
                    reason=f"{high_severity_count} sintomas de alta intensidade simultâneos. "
                           f"Consulta antecipada para reavaliação do plano de suporte.",
                    evidence={"high_severity_count": high_severity_count},
                ))

            # R21: Anticoagulant + any bleeding sign
            if has_anticoagulant and self._has_symptom(symptom_names, {"sangramento", "sangue", "hematúria", "equimose"}):
                findings.append(RuleFinding(
                    rule_id="R21_ANTICOAGULANT_BLEEDING",
                    disposition=ADVANCE_CONSULT,
                    reason="Sangramento em paciente com anticoagulante. Avaliação urgente do INR/nível terapêutico.",
                    evidence={"has_anticoagulant": True},
                ))

        # ─────────────────────────────────────────────────────────────────────
        # LAYER 1-D: SCHEDULED_CONSULT rules
        # ─────────────────────────────────────────────────────────────────────

        has_escalated = any(
            f.disposition in (ER_IMMEDIATE, ER_DAYS, ADVANCE_CONSULT) for f in findings
        )

        if not has_escalated:
            # R22: Any symptom flagged for nursing alert
            if "ALERT_NURSING" in symptom_actions:
                findings.append(RuleFinding(
                    rule_id="R22_NURSING_ALERT_SYMPTOMS",
                    disposition=SCHEDULED_CONSULT,
                    reason="Sintomas moderados que requerem revisão médica programada.",
                ))

            # R23: Moderate symptom count (2+ medium symptoms)
            medium_count = sum(
                1 for s in detected_symptoms if s.get("severity") == "MEDIUM"
            )
            if medium_count >= 2:
                findings.append(RuleFinding(
                    rule_id="R23_MODERATE_SYMPTOM_BURDEN",
                    disposition=SCHEDULED_CONSULT,
                    reason=f"{medium_count} sintomas moderados simultâneos. Consulta programada para revisão.",
                    evidence={"medium_count": medium_count},
                ))

        # ─────────────────────────────────────────────────────────────────────
        # LAYER 2: Validated clinical scores (MASCC / CISNE)
        # Runs when fever is present to enrich rule reasoning.
        # Can upgrade ER_DAYS → ER_IMMEDIATE based on MASCC high-risk result.
        # ─────────────────────────────────────────────────────────────────────

        has_fever = (
            temperature is not None and temperature >= 38.0
        ) or self._has_symptom(
            symptom_names, {"febre", "febre_neutropenica", "febril"}
        )

        if has_fever:
            try:
                scores_result = clinical_scores.evaluate_febrile_neutropenia_risk(
                    clinical_context=clinical_context,
                    symptom_analysis=symptom_analysis,
                    has_fever=True,
                    vitals=structured_vitals,
                )
                if scores_result.mascc:
                    mascc = scores_result.mascc
                    mascc_note = (
                        f"MASCC {mascc.score}/26 ({mascc.risk_level})"
                    )
                    # Upgrade ER_DAYS → ER_IMMEDIATE if MASCC high risk and
                    # no ER_IMMEDIATE finding already from hard rules
                    if mascc.is_high_risk and not has_immediate:
                        findings.append(RuleFinding(
                            rule_id="R_MASCC_HIGH_RISK",
                            disposition=ER_IMMEDIATE,
                            reason=(
                                f"{mascc_note}: {mascc.recommendation}. "
                                f"Score ≤ 20 indica risco elevado de complicações graves."
                            ),
                            confidence=0.9,
                            evidence={"mascc_score": mascc.score, "mascc_components": mascc.components},
                        ))
                    else:
                        # Enrich existing findings with score note
                        for f in findings:
                            if f.rule_id in ("R01_FEBRILE_NEUTROPENIA", "R02_NADIR_FEVER", "R12_FEVER_NO_CHEMO"):
                                f.reason += f" {mascc_note}."
                                f.evidence["mascc_score"] = mascc.score

                if scores_result.cisne and not scores_result.cisne.is_high_risk and scores_result.mascc and not scores_result.mascc.is_high_risk:
                    # Both scores say low risk — annotates R12_FEVER_NO_CHEMO findings with
                    # ambulatory outpatient note (no disposition change; does not downgrade).
                    if not in_nadir_window and not in_chemo:
                        findings_to_downgrade = [
                            f for f in findings
                            if f.rule_id == "R12_FEVER_NO_CHEMO"
                        ]
                        for f in findings_to_downgrade:
                            cisne = scores_result.cisne
                            f.reason += (
                                f" CISNE {cisne.score}/8 ({cisne.risk_level}, {cisne.serious_complication_rate}): "
                                f"baixo risco — candidato a antibioticoterapia oral ambulatorial com supervisão."
                            )
                            f.evidence["cisne_score"] = cisne.score
                            f.evidence["low_risk_ambulatory"] = True

            except Exception as e:
                logger.warning(f"Clinical scores calculation failed (non-blocking): {e}")

        # ─────────────────────────────────────────────────────────────────────
        # Aggregate: pick highest disposition
        # ─────────────────────────────────────────────────────────────────────

        if not findings:
            disposition = REMOTE_NURSING
            reasoning = "Sem achados clínicos de risco elevado. Monitoramento domiciliar adequado."
        else:
            # Pick the most severe disposition found
            disposition = max(findings, key=lambda f: _SEVERITY_ORDER[f.disposition]).disposition
            # Compose reasoning from all findings with that disposition + escalating ones
            top_findings = sorted(
                [f for f in findings if _SEVERITY_ORDER[f.disposition] == _SEVERITY_ORDER[disposition]],
                key=lambda f: f.confidence,
                reverse=True,
            )
            reasoning = " | ".join(f.reason for f in top_findings)

        requires_action = _SEVERITY_ORDER[disposition] >= _SEVERITY_ORDER[ER_DAYS]
        avg_confidence = (
            sum(f.confidence for f in findings) / len(findings) if findings else 1.0
        )

        result = ClinicalRulesResult(
            disposition=disposition,
            reasoning=reasoning,
            findings=findings,
            requires_immediate_action=requires_action,
            confidence=avg_confidence,
        )

        if findings:
            logger.info(
                f"ClinicalRulesEngine: {len(findings)} rule(s) fired → {disposition}. "
                f"Top: {findings[0].rule_id}"
            )
        else:
            logger.debug("ClinicalRulesEngine: no rules fired → REMOTE_NURSING")

        return result

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _is_in_chemo(self, treatments: List[Dict]) -> bool:
        return any(
            t.get("treatmentType") in ("CHEMOTHERAPY", "COMBINED", "IMMUNOTHERAPY")
            and t.get("isActive", False)
            for t in treatments
        )

    def _days_since_last_chemo(self, treatments: List[Dict]) -> Optional[int]:
        """Return days since last chemotherapy application, or None if unavailable."""
        from datetime import datetime, timezone

        best: Optional[int] = None
        for t in treatments:
            if t.get("treatmentType") not in ("CHEMOTHERAPY", "COMBINED", "IMMUNOTHERAPY"):
                continue
            # Phase 0: prefer lastApplicationDate; fall back to lastCycleDate
            date_str = t.get("lastApplicationDate") or t.get("lastCycleDate")
            if not date_str:
                continue
            try:
                last_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                delta = (datetime.now(timezone.utc) - last_date).days
                if best is None or delta < best:
                    best = delta
            except Exception:
                pass
        return best

    def _calculate_ecog_delta(self, history: List[Dict]) -> Optional[int]:
        """
        Return the change in ECOG score between the two most recent assessments.
        Positive = worsening (ECOG increased).
        """
        if len(history) < 2:
            return None
        try:
            sorted_h = sorted(history, key=lambda h: h.get("assessedAt", ""), reverse=True)
            latest = sorted_h[0].get("ecogScore")
            previous = sorted_h[1].get("ecogScore")
            if latest is None or previous is None:
                return None
            return int(latest) - int(previous)
        except Exception:
            return None

    def _has_medication_flag(self, medications: List[Dict], flag: str) -> bool:
        return any(m.get(flag, False) for m in medications if m.get("isActive", True))

    @staticmethod
    def _has_symptom(symptom_names: set, targets: set) -> bool:
        return bool(symptom_names & targets)


# Global singleton
clinical_rules_engine = ClinicalRulesEngine()
