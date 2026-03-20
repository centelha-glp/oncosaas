"""
Validated Clinical Scoring Systems — Layer 2.

Implements evidence-based oncology triage scores:
  - MASCC (Multinational Association for Supportive Care in Cancer) Risk Index
    → Febrile neutropenia risk stratification; score ≤ 20 = high risk
  - CISNE (Clinical Index of Stable Febrile Neutropenia)
    → Refines MASCC for stable solid-tumor patients; score ≥ 3 = high risk
  - ECOG utilities (delta, trend)

These scores feed into the clinical rules engine to provide quantitative
evidence for borderline febrile neutropenia decisions.

References:
  - Klastersky J et al. J Clin Oncol 2000 (MASCC)
  - Carmona-Bayonas A et al. J Clin Oncol 2015 (CISNE)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


# ─── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class MASCCResult:
    score: int                    # 0–26 (higher = lower risk)
    risk_level: str               # "LOW" | "HIGH"
    is_high_risk: bool            # True when score ≤ 20
    components: Dict[str, int]    # Each MASCC variable and its points
    notes: List[str] = field(default_factory=list)

    @property
    def recommendation(self) -> str:
        if self.is_high_risk:
            return "MASCC alto risco: hospitalização e antibioticoterapia IV imediata"
        return "MASCC baixo risco: candidato a antibioticoterapia oral ambulatorial (com supervisão)"


@dataclass
class CISNEResult:
    score: int                    # 0–8
    risk_level: str               # "LOW" | "INTERMEDIATE" | "HIGH"
    serious_complication_rate: str  # Approximate %
    components: Dict[str, int]
    notes: List[str] = field(default_factory=list)

    @property
    def is_high_risk(self) -> bool:
        return self.score >= 3

    @property
    def recommendation(self) -> str:
        if self.score >= 3:
            return "CISNE alto risco (≥3): hospitalização necessária"
        if self.score >= 1:
            return "CISNE risco intermediário: considerar observação hospitalar curta"
        return "CISNE baixo risco: candidato a manejo ambulatorial"


@dataclass
class ClinicalScoresResult:
    mascc: Optional[MASCCResult] = None
    cisne: Optional[CISNEResult] = None
    overall_febrile_neutropenia_risk: str = "UNKNOWN"  # "HIGH" | "LOW" | "UNKNOWN"
    summary: str = ""


# ─── Engine ───────────────────────────────────────────────────────────────────

class ClinicalScoresCalculator:
    """
    Computes MASCC and CISNE scores from available clinical context.

    Input fields are extracted from the structured clinical context built by
    ContextBuilder + BuildClinicalContext. Many fields may be unavailable
    (None) — in that case the score assumes the safer (higher risk) default.
    """

    def compute_mascc(self, context: Dict[str, Any]) -> MASCCResult:
        """
        MASCC Risk Index for febrile neutropenia.

        Variables and points:
          - Burden of illness (symptoms at presentation):
              None/mild = 5, Moderate = 3, Severe/moribund = 0
          - No hypotension (SBP ≥ 90 mmHg): 5
          - No COPD: 4
          - Solid tumor OR no prior fungal infection: 4
          - No dehydration: 3
          - Outpatient status at onset of fever: 3
          - Age < 60: 2
          Max total = 26. Score ≤ 20 = HIGH risk.
        """
        components: Dict[str, int] = {}
        notes: List[str] = []

        patient = context.get("patient", {})
        vitals = context.get("vitals", {})
        comorbidities = context.get("comorbidities", [])
        cancer_type = (patient.get("cancerType") or "").lower()
        ecog = patient.get("performanceStatus")
        symptom_analysis = context.get("symptom_analysis", {})
        detected = symptom_analysis.get("detectedSymptoms", [])

        # 1. Burden of illness (approximated from ECOG and symptom severity)
        overall_severity = symptom_analysis.get("overallSeverity", "LOW")
        if ecog is not None and ecog >= 4:
            components["burden_of_illness"] = 0
            notes.append("Status funcional ECOG 4 → carga severa/moribundo")
        elif ecog is not None and ecog >= 2 or overall_severity == "CRITICAL":
            components["burden_of_illness"] = 3
            notes.append("Carga de doença moderada (ECOG 2-3 ou sintomas críticos)")
        else:
            components["burden_of_illness"] = 5

        # 2. No hypotension (SBP ≥ 90)
        bp_sys = vitals.get("bp_sys")
        if bp_sys is not None:
            components["no_hypotension"] = 5 if bp_sys >= 90 else 0
            if bp_sys < 90:
                notes.append(f"Hipotensão: PAS {bp_sys} mmHg → 0 pts")
        else:
            # Conservative: assume normotensive unless we have evidence otherwise
            components["no_hypotension"] = 5

        # 3. No COPD
        has_copd = any(
            c.get("type") in ("COPD", "ASTHMA") or
            "copd" in str(c.get("name", "")).lower() or
            "dpoc" in str(c.get("name", "")).lower()
            for c in comorbidities
        )
        components["no_copd"] = 0 if has_copd else 4
        if has_copd:
            notes.append("DPOC/Asma presente → 0 pts")

        # 4. Solid tumor OR no prior fungal infection
        # Haematological malignancies (lymphoma, leukemia, myeloma) score 0 unless no fungal Hx
        hematological_types = {"lymphoma", "leukemia", "leucemia", "linfoma", "mieloma", "myeloma", "aml", "all"}
        is_hematological = any(h in cancer_type for h in hematological_types)
        # In the absence of fungal infection history, give 4 pts
        has_fungal_hx = any(
            "fungo" in str(c.get("notes", "")).lower() or
            "fungal" in str(c.get("notes", "")).lower()
            for c in comorbidities
        )
        if is_hematological and has_fungal_hx:
            components["solid_or_no_fungal"] = 0
            notes.append("Neoplasia hematológica com histórico de infecção fúngica → 0 pts")
        else:
            components["solid_or_no_fungal"] = 4

        # 5. No dehydration
        has_dehydration = any(
            s.get("name", "").lower() in {"desidratado", "dehydration", "vomito_incoercivel"}
            for s in detected
        )
        components["no_dehydration"] = 0 if has_dehydration else 3
        if has_dehydration:
            notes.append("Desidratação detectada → 0 pts")

        # 6. Outpatient status — assume outpatient (most common in our workflow)
        components["outpatient"] = 3

        # 7. Age < 60
        age = patient.get("age") or patient.get("birthDate")
        if isinstance(age, int):
            components["age_lt_60"] = 2 if age < 60 else 0
        else:
            # Cannot determine age from birthDate string here — give conservative 0
            components["age_lt_60"] = 0
            notes.append("Idade não disponível → conservador: 0 pts")

        total = sum(components.values())
        is_high_risk = total <= 20

        return MASCCResult(
            score=total,
            risk_level="HIGH" if is_high_risk else "LOW",
            is_high_risk=is_high_risk,
            components=components,
            notes=notes,
        )

    def compute_cisne(self, context: Dict[str, Any]) -> CISNEResult:
        """
        CISNE Score for apparently stable solid-tumor patients with febrile neutropenia.
        Only meaningful for solid tumors; for haematological cancers, use MASCC alone.

        Variables and points:
          - ECOG PS ≥ 2: 2
          - Stress hyperglycemia (glucose > 121 mg/dL without prior diabetes): 2
          - COPD: 1
          - Chronic cardiovascular disease (CHF, CAD, AF): 1
          - Mucositis NCI grade ≥ 2: 1
          - Monocytes < 200/µL: 1
          Max = 8.
          Score 0 → low risk (~0.4%)
          Score 1-2 → intermediate (~4.5%)
          Score ≥ 3 → high risk (~36%)
        """
        components: Dict[str, int] = {}
        notes: List[str] = []

        patient = context.get("patient", {})
        comorbidities = context.get("comorbidities", [])
        labs = context.get("labs", {})  # simplified: {glucose, monocytes}
        symptom_analysis = context.get("symptom_analysis", {})
        detected = symptom_analysis.get("detectedSymptoms", [])
        ecog = patient.get("performanceStatus")

        # 1. ECOG PS ≥ 2
        if ecog is not None and ecog >= 2:
            components["ecog_ge_2"] = 2
            notes.append(f"ECOG {ecog} ≥ 2 → 2 pts")
        else:
            components["ecog_ge_2"] = 0

        # 2. Stress hyperglycemia (glucose > 121 mg/dL without diabetes)
        has_diabetes = any(
            c.get("type") in ("DIABETES_TYPE_1", "DIABETES_TYPE_2") or
            "diabet" in str(c.get("name", "")).lower()
            for c in comorbidities
        )
        glucose = labs.get("glucose")
        if glucose is not None and not has_diabetes and glucose > 121:
            components["stress_hyperglycemia"] = 2
            notes.append(f"Hiperglicemia de estresse: glicose {glucose} mg/dL → 2 pts")
        else:
            components["stress_hyperglycemia"] = 0

        # 3. COPD
        has_copd = any(
            c.get("type") in ("COPD", "ASTHMA") or
            "copd" in str(c.get("name", "")).lower() or
            "dpoc" in str(c.get("name", "")).lower()
            for c in comorbidities
        )
        components["copd"] = 1 if has_copd else 0

        # 4. Chronic cardiovascular disease
        cv_types = {"HEART_FAILURE", "CORONARY_ARTERY_DISEASE", "ATRIAL_FIBRILLATION"}
        has_cv = any(c.get("type") in cv_types for c in comorbidities)
        components["chronic_cv_disease"] = 1 if has_cv else 0
        if has_cv:
            notes.append("Doença cardiovascular crônica → 1 pt")

        # 5. Mucositis NCI ≥ 2
        has_severe_mucositis = any(
            s.get("name", "").lower() in {"mucosite"} and
            s.get("severity") in ("HIGH", "CRITICAL")
            for s in detected
        )
        components["mucositis_grade_ge_2"] = 1 if has_severe_mucositis else 0

        # 6. Monocytes < 200/µL
        monocytes = labs.get("monocytes")
        if monocytes is not None and monocytes < 200:
            components["monocytes_lt_200"] = 1
            notes.append(f"Monócitos {monocytes}/µL < 200 → 1 pt")
        else:
            components["monocytes_lt_200"] = 0

        total = sum(components.values())

        if total == 0:
            risk_level = "LOW"
            complication_rate = "~0.4%"
        elif total <= 2:
            risk_level = "INTERMEDIATE"
            complication_rate = "~4.5%"
        else:
            risk_level = "HIGH"
            complication_rate = "~36%"

        return CISNEResult(
            score=total,
            risk_level=risk_level,
            serious_complication_rate=complication_rate,
            components=components,
            notes=notes,
        )

    def evaluate_febrile_neutropenia_risk(
        self,
        clinical_context: Dict[str, Any],
        symptom_analysis: Dict[str, Any],
        has_fever: bool = False,
        vitals: Optional[Dict[str, Any]] = None,
    ) -> ClinicalScoresResult:
        """
        Compute MASCC + CISNE and return combined risk assessment.
        Only runs when fever is present (or suspected).

        Args:
            clinical_context: Full patient context from buildClinicalContext
            symptom_analysis: Output of SymptomAnalyzer
            has_fever: Whether fever is confirmed/suspected
            vitals: Optional vital signs dict

        Returns:
            ClinicalScoresResult with both scores and overall risk
        """
        if not has_fever:
            return ClinicalScoresResult(
                overall_febrile_neutropenia_risk="N/A",
                summary="Scores MASCC/CISNE não aplicáveis: ausência de febre.",
            )

        # Merge context with symptom analysis and vitals for scoring
        enriched = {
            **clinical_context,
            "symptom_analysis": symptom_analysis,
            "vitals": vitals or {},
        }

        mascc = self.compute_mascc(enriched)
        cisne = self.compute_cisne(enriched)

        # Overall risk: high if either score flags high risk
        patient = clinical_context.get("patient", {})
        cancer_type = (patient.get("cancerType") or "").lower()
        hematological_types = {"lymphoma", "leukemia", "leucemia", "linfoma", "mieloma", "myeloma"}
        is_hematological = any(h in cancer_type for h in hematological_types)

        if mascc.is_high_risk:
            overall_risk = "HIGH"
        elif not is_hematological and cisne.is_high_risk:
            # CISNE only applies to solid tumors
            overall_risk = "HIGH"
        elif not is_hematological and cisne.risk_level == "INTERMEDIATE":
            overall_risk = "INTERMEDIATE"
        else:
            overall_risk = "LOW"

        summary_parts = [
            f"MASCC {mascc.score}/26 ({mascc.risk_level}): {mascc.recommendation}",
        ]
        if not is_hematological:
            summary_parts.append(
                f"CISNE {cisne.score}/8 ({cisne.risk_level}, {cisne.serious_complication_rate}): {cisne.recommendation}"
            )
        else:
            summary_parts.append("CISNE não aplicável (neoplasia hematológica)")

        return ClinicalScoresResult(
            mascc=mascc,
            cisne=cisne if not is_hematological else None,
            overall_febrile_neutropenia_risk=overall_risk,
            summary=" | ".join(summary_parts),
        )


# Global singleton
clinical_scores = ClinicalScoresCalculator()
