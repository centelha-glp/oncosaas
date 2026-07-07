"""
POST /api/v1/clinical-evolution/structure — estruturação pós-assinatura (Nest → ai-service).

Com chaves LLM: uma chamada `generate` + JSON parse + validação Pydantic (núcleo) + campos estendidos como JSON.
Sem chaves: retorna estrutura vazia (determinístico); o backend continua aplicável com heurísticas futuras.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..agent.llm_provider import llm_provider
from ..agent.prompts.clinical_evolution_structure_prompt import SYSTEM_STRUCTURE_EVOLUTION_V3
from ..config.llm_defaults import merge_agent_llm_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/clinical-evolution", tags=["clinical-evolution"])

EXTRACTION_SCHEMA_VERSION = "2026-05-15-v3"


class StructureEvolutionRequest(BaseModel):
    tenant_id: str = Field(..., min_length=1)
    patient_id: str = Field(..., min_length=1)
    clinical_note_id: str = Field(..., min_length=1)
    note_type: str = Field(..., min_length=1)
    content_markdown: str = ""
    patient_snapshot: dict[str, Any] = Field(default_factory=dict)


class ExamRequestOut(BaseModel):
    display_name: str = Field(..., min_length=1)
    code: Optional[str] = None
    loinc_code: Optional[str] = None


class MedicationOut(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    dosage: Optional[str] = Field(None, max_length=200)
    frequency: Optional[str] = Field(None, max_length=200)
    indication: Optional[str] = Field(None, max_length=500)
    route: Optional[str] = Field(None, max_length=80)
    category: Optional[str] = Field(None, max_length=64)
    notes: Optional[str] = Field(None, max_length=2000)


class ComorbidityOut(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    type: Optional[str] = Field(None, max_length=64)
    severity: Optional[str] = Field(None, max_length=32)
    controlled: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=2000)


class PatientPatchOut(BaseModel):
    cancerType: Optional[str] = Field(None, max_length=120)
    stage: Optional[str] = Field(None, max_length=120)
    performanceStatus: Optional[int] = None
    occupation: Optional[str] = Field(None, max_length=300)
    preferredEmergencyHospital: Optional[str] = Field(None, max_length=400)
    healthCoverageType: Optional[str] = Field(None, max_length=32)
    healthPlanName: Optional[str] = Field(None, max_length=300)
    insuranceMemberId: Optional[str] = Field(None, max_length=120)
    currentSpecialty: Optional[str] = Field(None, max_length=120)


class RejectionItem(BaseModel):
    domain: str
    reason: str
    field: Optional[str] = None


class StructureEvolutionResponse(BaseModel):
    extraction_schema_version: str = EXTRACTION_SCHEMA_VERSION
    clinical_exam_requests: list[ExamRequestOut] = Field(default_factory=list)
    medications: list[MedicationOut] = Field(default_factory=list)
    comorbidities: list[ComorbidityOut] = Field(default_factory=list)
    patient_patch: PatientPatchOut = Field(default_factory=PatientPatchOut)
    journey_patch: dict[str, Any] = Field(default_factory=dict)
    diagnoses: list[dict[str, Any]] = Field(default_factory=list)
    treatments: list[dict[str, Any]] = Field(default_factory=list)
    navigation_step_updates: list[dict[str, Any]] = Field(default_factory=list)
    complementary_exams: list[dict[str, Any]] = Field(default_factory=list)
    observations: list[dict[str, Any]] = Field(default_factory=list)
    performance_status_history: list[dict[str, Any]] = Field(default_factory=list)
    clinical_prescription_lines: list[dict[str, Any]] = Field(default_factory=list)
    questionnaire_responses: list[dict[str, Any]] = Field(default_factory=list)
    rejection_report: list[RejectionItem] = Field(default_factory=list)


def _parse_structure_json(raw: str) -> Optional[dict[str, Any]]:
    text = (raw or "").strip()
    if not text:
        return None
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()
    try:
        obj = json.loads(text)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
        except Exception:
            return None
    return obj if isinstance(obj, dict) else None


def _safe_list(items: Any) -> list[Any]:
    return items if isinstance(items, list) else []


def _safe_dict(obj: Any) -> dict[str, Any]:
    return obj if isinstance(obj, dict) else {}


def _dict_items(raw_list: list[Any], domain: str, max_items: int = 200) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, row in enumerate(raw_list[:max_items]):
        if isinstance(row, dict):
            out.append(row)
        else:
            logger.debug("structure_evolution: skip non-dict %s idx=%s", domain, i)
    return out


def _build_response_from_parsed(parsed: dict[str, Any]) -> StructureEvolutionResponse:
    exams_raw = _safe_list(parsed.get("clinical_exam_requests"))
    meds_raw = _safe_list(parsed.get("medications"))
    com_raw = _safe_list(parsed.get("comorbidities"))
    patch_raw = parsed.get("patient_patch")
    rej_llm = _safe_list(parsed.get("rejection_report"))

    exams: list[ExamRequestOut] = []
    for i, row in enumerate(exams_raw):
        if not isinstance(row, dict):
            continue
        try:
            exams.append(ExamRequestOut.model_validate(row))
        except Exception:
            logger.debug("structure_evolution: skip invalid exam idx=%s", i)

    meds: list[MedicationOut] = []
    for i, row in enumerate(meds_raw):
        if not isinstance(row, dict):
            continue
        try:
            meds.append(MedicationOut.model_validate(row))
        except Exception:
            logger.debug("structure_evolution: skip invalid medication idx=%s", i)

    coms: list[ComorbidityOut] = []
    for i, row in enumerate(com_raw):
        if not isinstance(row, dict):
            continue
        try:
            coms.append(ComorbidityOut.model_validate(row))
        except Exception:
            logger.debug("structure_evolution: skip invalid comorbidity idx=%s", i)

    patch = PatientPatchOut()
    if isinstance(patch_raw, dict):
        try:
            patch = PatientPatchOut.model_validate(patch_raw)
        except Exception:
            patch = PatientPatchOut()

    rej_out: list[RejectionItem] = []
    for row in rej_llm:
        if isinstance(row, dict) and row.get("domain") and row.get("reason"):
            try:
                rej_out.append(RejectionItem.model_validate(row))
            except Exception:
                continue

    journey = _safe_dict(parsed.get("journey_patch"))

    return StructureEvolutionResponse(
        extraction_schema_version=EXTRACTION_SCHEMA_VERSION,
        clinical_exam_requests=exams,
        medications=meds,
        comorbidities=coms,
        patient_patch=patch,
        journey_patch=journey,
        diagnoses=_dict_items(_safe_list(parsed.get("diagnoses")), "diagnoses"),
        treatments=_dict_items(_safe_list(parsed.get("treatments")), "treatments"),
        navigation_step_updates=_dict_items(
            _safe_list(parsed.get("navigation_step_updates")), "navigation_step_updates"
        ),
        complementary_exams=_dict_items(
            _safe_list(parsed.get("complementary_exams")), "complementary_exams"
        ),
        observations=_dict_items(_safe_list(parsed.get("observations")), "observations"),
        performance_status_history=_dict_items(
            _safe_list(parsed.get("performance_status_history")),
            "performance_status_history",
        ),
        clinical_prescription_lines=_dict_items(
            _safe_list(parsed.get("clinical_prescription_lines")),
            "clinical_prescription_lines",
        ),
        questionnaire_responses=_dict_items(
            _safe_list(parsed.get("questionnaire_responses")), "questionnaire_responses"
        ),
        rejection_report=rej_out,
    )


@router.post(
    "/structure",
    response_model=StructureEvolutionResponse,
    response_model_exclude_none=True,
)
async def structure_signed_evolution(body: StructureEvolutionRequest) -> StructureEvolutionResponse:
    empty = StructureEvolutionResponse()

    raw_cfg: dict[str, Any] = {}
    has_a = llm_provider.has_anthropic_key(raw_cfg)
    cfg = merge_agent_llm_config(raw_cfg, has_anthropic_key=has_a)

    if not llm_provider.has_any_llm_key(cfg):
        logger.info(
            "clinical-evolution/structure: sem chaves LLM — resposta vazia tenant=%s note=%s len_md=%s",
            body.tenant_id[:8] if body.tenant_id else "",
            body.clinical_note_id[:8] if body.clinical_note_id else "",
            len(body.content_markdown or ""),
        )
        return empty

    snap_json = json.dumps(body.patient_snapshot or {}, ensure_ascii=False)
    if len(snap_json) > 14_000:
        snap_json = snap_json[:14_000] + "…"
    md = body.content_markdown or ""
    if len(md) > 28_000:
        md = md[:28_000] + "\n…"

    user_content = (
        f"### Snapshot do paciente (JSON)\n{snap_json}\n\n"
        f"### Tipo de nota\n{body.note_type}\n\n"
        f"### Evolução (Markdown)\n{md}"
    )

    try:
        raw_text = await llm_provider.generate(
            SYSTEM_STRUCTURE_EVOLUTION_V3,
            [{"role": "user", "content": user_content}],
            cfg,
            usage_step="clinical_evolution_structure",
            max_output_tokens=8192,
            temperature=0.2,
        )
    except Exception as e:
        logger.warning("clinical-evolution/structure LLM falhou: %s", e)
        return empty

    parsed = _parse_structure_json(raw_text)
    if not parsed:
        logger.warning(
            "clinical-evolution/structure: JSON inválido ou vazio após LLM note=%s",
            body.clinical_note_id[:8] if body.clinical_note_id else "",
        )
        out = empty.model_copy()
        out.rejection_report = [
            RejectionItem(domain="llm", reason="Resposta não foi JSON estruturado válido.", field=None)
        ]
        return out

    return _build_response_from_parsed(parsed)
