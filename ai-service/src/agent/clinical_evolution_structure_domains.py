"""
Modelos Pydantic para domínios estendidos da estruturação de evolução (v3).

Validação antes do Nest: itens inválidos viram rejection_report e são omitidos da resposta.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

COMPLEMENTARY_EXAM_TYPES = frozenset(
    {"LABORATORY", "ANATOMOPATHOLOGICAL", "IMMUNOHISTOCHEMICAL", "IMAGING"}
)
TREATMENT_TYPES = frozenset(
    {"CHEMOTHERAPY", "RADIOTHERAPY", "SURGERY", "COMBINED", "IMMUNOTHERAPY", "TARGETED"}
)
TREATMENT_STATUS = frozenset(
    {"PLANNED", "ACTIVE", "COMPLETED", "SUSPENDED", "DISCONTINUED", "CANCELLED"}
)
TREATMENT_INTENT = frozenset(
    {"CURATIVE", "PALLIATIVE", "ADJUVANT", "NEOADJUVANT"}
)
TREATMENT_RESPONSE = frozenset(
    {
        "COMPLETE_RESPONSE",
        "PARTIAL_RESPONSE",
        "STABLE_DISEASE",
        "PROGRESSIVE_DISEASE",
        "NOT_EVALUATED",
    }
)
JOURNEY_STAGES = frozenset(
    {"SCREENING", "DIAGNOSIS", "TREATMENT", "FOLLOW_UP", "PALLIATIVE"}
)


class RejectionItemOut(BaseModel):
    domain: str
    reason: str
    field: Optional[str] = None


class DiagnosisOut(BaseModel):
    cancer_type: Optional[str] = Field(None, alias="cancer_type", max_length=120)
    icd10_code: Optional[str] = Field(None, alias="icd10_code", max_length=32)
    stage: Optional[str] = Field(None, max_length=120)
    t_stage: Optional[str] = Field(None, alias="t_stage", max_length=16)
    n_stage: Optional[str] = Field(None, alias="n_stage", max_length=16)
    m_stage: Optional[str] = Field(None, alias="m_stage", max_length=16)
    grade: Optional[str] = Field(None, max_length=64)
    histological_type: Optional[str] = Field(None, alias="histological_type", max_length=200)
    staging_date: Optional[str] = Field(None, alias="staging_date", max_length=32)
    pathology_report: Optional[str] = Field(None, alias="pathology_report", max_length=4000)
    diagnosis_date: Optional[str] = Field(None, alias="diagnosis_date", max_length=32)

    model_config = {"populate_by_name": True}


class TreatmentOut(BaseModel):
    treatment_type: str = Field(..., alias="treatment_type", max_length=64)
    treatment_name: Optional[str] = Field(None, alias="treatment_name", max_length=300)
    protocol: Optional[str] = Field(None, max_length=300)
    line: Optional[str] = Field(None, max_length=64)
    intent: Optional[str] = Field(None, max_length=64)
    status: Optional[str] = Field(None, max_length=64)
    start_date: Optional[str] = Field(None, alias="start_date", max_length=32)
    planned_end_date: Optional[str] = Field(None, alias="planned_end_date", max_length=32)
    is_active: Optional[bool] = Field(None, alias="is_active")
    notes: Optional[str] = Field(None, max_length=2000)
    medications_json: Any = Field(None, alias="medications_json")
    toxicities_json: Any = Field(None, alias="toxicities_json")
    response: Optional[str] = Field(None, max_length=64)
    response_date: Optional[str] = Field(None, alias="response_date", max_length=32)
    response_notes: Optional[str] = Field(None, alias="response_notes", max_length=2000)

    model_config = {"populate_by_name": True}

    @field_validator("treatment_type")
    @classmethod
    def _treatment_type_enum(cls, v: str) -> str:
        u = str(v).strip().upper()
        if u not in TREATMENT_TYPES:
            raise ValueError(f"treatment_type inválido: {v}")
        return u

    @field_validator("intent", "status", "response", mode="before")
    @classmethod
    def _optional_enums(cls, v: Any, info) -> Any:
        if v is None or v == "":
            return None
        u = str(v).strip().upper()
        name = info.field_name
        allowed = {
            "intent": TREATMENT_INTENT,
            "status": TREATMENT_STATUS,
            "response": TREATMENT_RESPONSE,
        }.get(name)
        if allowed and u not in allowed:
            raise ValueError(f"{name} inválido: {v}")
        return u


class NavigationStepUpdateOut(BaseModel):
    navigation_step_id: Optional[str] = Field(None, alias="navigation_step_id", max_length=64)
    step_key: Optional[str] = Field(None, alias="step_key", max_length=120)
    cancer_type: Optional[str] = Field(None, alias="cancer_type", max_length=120)
    journey_stage: Optional[str] = Field(None, alias="journey_stage", max_length=64)
    result: Optional[str] = Field(None, max_length=2000)
    findings: Optional[str] = Field(None, max_length=4000)
    notes: Optional[str] = Field(None, max_length=2000)
    metadata: Any = None
    actual_date: Optional[str] = Field(None, alias="actual_date", max_length=32)
    institution_name: Optional[str] = Field(None, alias="institution_name", max_length=400)
    professional_name: Optional[str] = Field(None, alias="professional_name", max_length=300)
    mark_completed: Optional[bool] = Field(None, alias="mark_completed")

    model_config = {"populate_by_name": True}

    @field_validator("journey_stage", mode="before")
    @classmethod
    def _journey_stage(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        u = str(v).strip().upper()
        if u not in JOURNEY_STAGES:
            raise ValueError(f"journey_stage inválido: {v}")
        return u


class ComplementaryExamResultOut(BaseModel):
    performed_at: Optional[str] = Field(None, alias="performed_at", max_length=32)
    value_numeric: Optional[float] = Field(None, alias="value_numeric")
    value_text: Optional[str] = Field(None, alias="value_text", max_length=500)
    unit: Optional[str] = Field(None, max_length=64)
    reference_range: Optional[str] = Field(None, alias="reference_range", max_length=200)
    is_abnormal: Optional[bool] = Field(None, alias="is_abnormal")
    report: Optional[str] = Field(None, max_length=8000)
    components: Any = None

    model_config = {"populate_by_name": True}


class ComplementaryExamOut(BaseModel):
    type: str = Field(..., max_length=64)
    name: str = Field(..., min_length=1, max_length=500)
    code: Optional[str] = Field(None, max_length=64)
    loinc_code: Optional[str] = Field(None, alias="loinc_code", max_length=32)
    result: Optional[ComplementaryExamResultOut] = None

    model_config = {"populate_by_name": True}

    @field_validator("type")
    @classmethod
    def _exam_type(cls, v: str) -> str:
        u = str(v).strip().upper()
        if u not in COMPLEMENTARY_EXAM_TYPES:
            raise ValueError(f"type inválido: {v}")
        return u


class ClinicalPrescriptionLineOut(BaseModel):
    medication_name: str = Field(..., alias="medication_name", min_length=1, max_length=500)
    catalog_key: Optional[str] = Field(None, alias="catalog_key", max_length=120)
    dosage: Optional[str] = Field(None, max_length=200)
    frequency: Optional[str] = Field(None, max_length=200)
    route: Optional[str] = Field(None, max_length=80)
    duration: Optional[str] = Field(None, max_length=200)
    indication: Optional[str] = Field(None, max_length=500)

    model_config = {"populate_by_name": True}


def _validate_list(
    raw_list: list[Any],
    *,
    domain: str,
    model: type[BaseModel],
    rejections: list[RejectionItemOut],
    max_items: int = 200,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, row in enumerate(raw_list[:max_items]):
        if not isinstance(row, dict):
            rejections.append(
                RejectionItemOut(
                    domain=domain,
                    reason=f"item {i} não é objeto",
                    field=str(i),
                )
            )
            continue
        try:
            validated = model.model_validate(row)
            out.append(validated.model_dump(by_alias=True, exclude_none=False))
        except Exception as e:
            rejections.append(
                RejectionItemOut(
                    domain=domain,
                    reason=str(e)[:500],
                    field=str(i),
                )
            )
            logger.debug("structure domain %s skip idx=%s: %s", domain, i, e)
    return out


def validate_extended_domains(
    parsed: dict[str, Any],
    existing_rejections: list[RejectionItemOut],
) -> tuple[dict[str, Any], list[RejectionItemOut]]:
    """
    Valida domínios estendidos; retorna parsed enriquecido + rejection_report consolidado.
    """
    rej = list(existing_rejections)
    result = dict(parsed)

    result["diagnoses"] = _validate_list(
        parsed.get("diagnoses") if isinstance(parsed.get("diagnoses"), list) else [],
        domain="diagnoses",
        model=DiagnosisOut,
        rejections=rej,
    )
    result["treatments"] = _validate_list(
        parsed.get("treatments") if isinstance(parsed.get("treatments"), list) else [],
        domain="treatments",
        model=TreatmentOut,
        rejections=rej,
    )
    result["navigation_step_updates"] = _validate_list(
        parsed.get("navigation_step_updates")
        if isinstance(parsed.get("navigation_step_updates"), list)
        else [],
        domain="navigation_step_updates",
        model=NavigationStepUpdateOut,
        rejections=rej,
    )
    result["complementary_exams"] = _validate_list(
        parsed.get("complementary_exams")
        if isinstance(parsed.get("complementary_exams"), list)
        else [],
        domain="complementary_exams",
        model=ComplementaryExamOut,
        rejections=rej,
    )
    result["clinical_prescription_lines"] = _validate_list(
        parsed.get("clinical_prescription_lines")
        if isinstance(parsed.get("clinical_prescription_lines"), list)
        else [],
        domain="clinical_prescription_lines",
        model=ClinicalPrescriptionLineOut,
        rejections=rej,
    )

    # observations / performance_status_history / questionnaire: dict items only
    for domain in (
        "observations",
        "performance_status_history",
        "questionnaire_responses",
    ):
        raw = parsed.get(domain)
        if not isinstance(raw, list):
            result[domain] = []
            continue
        cleaned: list[dict[str, Any]] = []
        for i, row in enumerate(raw[:200]):
            if isinstance(row, dict):
                cleaned.append(row)
            else:
                rej.append(
                    RejectionItemOut(
                        domain=domain,
                        reason=f"item {i} não é objeto",
                        field=str(i),
                    )
                )
        result[domain] = cleaned

    return result, rej
