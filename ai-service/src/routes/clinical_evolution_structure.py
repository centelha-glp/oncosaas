"""
POST /api/v1/clinical-evolution/structure — estruturação pós-assinatura (Nest → ai-service).

Contrato degradado (HTTP 200, corpo JSON):
- `llm_available`, `parse_ok`, `degraded` — o NestJS marca o run como FAILED quando `degraded` é true.
- `rejection_report` descreve a causa (sem stack).

Sem chaves LLM ou falha total do provedor: HTTP 503 (não devolve sucesso vazio).
JSON inválido / tool ausente: HTTP 200 com `degraded=true`, `parse_ok=false`.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..agent.clinical_evolution_structure_domains import (
    RejectionItemOut,
    validate_extended_domains,
)
from ..agent.clinical_evolution_structure_tools import STRUCTURE_EVOLUTION_TOOLS
from ..agent.clinical_evolution_truncation import prepare_structure_inputs
from ..agent.llm_provider import llm_provider
from ..agent.prompts.clinical_evolution_structure_prompt import SYSTEM_STRUCTURE_EVOLUTION_V3
from ..config.llm_defaults import merge_agent_llm_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/clinical-evolution", tags=["clinical-evolution"])

EXTRACTION_SCHEMA_VERSION = "2026-05-15-v3"
STRUCTURE_TOOL_NAME = "structure_signed_evolution_output"


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
    llm_available: bool = Field(
        default=True,
        description="False quando não havia chaves LLM utilizáveis (só em respostas degradadas legadas).",
    )
    parse_ok: bool = Field(
        default=True,
        description="False quando o texto do modelo não foi JSON estruturado válido.",
    )
    degraded: bool = Field(
        default=False,
        description="True quando o Nest não deve aplicar APPLIED (falha ou indisponibilidade).",
    )
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


def _degraded_structure_response(
    *,
    reason: str,
    llm_available: bool,
    parse_ok: bool,
) -> StructureEvolutionResponse:
    """Resposta explícita de falha — listas vazias, sem simular extração bem-sucedida."""
    return StructureEvolutionResponse(
        extraction_schema_version=EXTRACTION_SCHEMA_VERSION,
        llm_available=llm_available,
        parse_ok=parse_ok,
        degraded=True,
        rejection_report=[
            RejectionItem(domain="llm", reason=reason, field=None),
        ],
    )


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


def _parse_tool_structure_result(result: dict[str, Any]) -> Optional[dict[str, Any]]:
    tool_calls = result.get("tool_calls") or []
    for tc in tool_calls:
        fn = tc.get("function") or {}
        if fn.get("name") != STRUCTURE_TOOL_NAME:
            continue
        args_raw = fn.get("arguments", "{}")
        try:
            args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw
        except json.JSONDecodeError:
            return None
        return args if isinstance(args, dict) else None
    content = (result.get("content") or result.get("response") or "").strip()
    if content:
        return _parse_structure_json(content)
    return None


def _safe_list(items: Any) -> list[Any]:
    return items if isinstance(items, list) else []


def _safe_dict(obj: Any) -> dict[str, Any]:
    return obj if isinstance(obj, dict) else {}


def _build_response_from_parsed(parsed: dict[str, Any]) -> StructureEvolutionResponse:
    validated, rej_models = validate_extended_domains(parsed, [])
    parsed = validated

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
    for r in rej_models:
        rej_out.append(RejectionItem.model_validate(r.model_dump()))

    journey = _safe_dict(parsed.get("journey_patch"))

    return StructureEvolutionResponse(
        extraction_schema_version=EXTRACTION_SCHEMA_VERSION,
        llm_available=True,
        parse_ok=True,
        degraded=False,
        clinical_exam_requests=exams,
        medications=meds,
        comorbidities=coms,
        patient_patch=patch,
        journey_patch=journey,
        diagnoses=list(parsed.get("diagnoses") or []),
        treatments=list(parsed.get("treatments") or []),
        navigation_step_updates=list(parsed.get("navigation_step_updates") or []),
        complementary_exams=list(parsed.get("complementary_exams") or []),
        observations=list(parsed.get("observations") or []),
        performance_status_history=list(parsed.get("performance_status_history") or []),
        clinical_prescription_lines=list(parsed.get("clinical_prescription_lines") or []),
        questionnaire_responses=list(parsed.get("questionnaire_responses") or []),
        rejection_report=rej_out,
    )


@router.post("/structure", response_model=StructureEvolutionResponse)
async def structure_signed_evolution(body: StructureEvolutionRequest) -> StructureEvolutionResponse:
    raw_cfg: dict[str, Any] = {}
    has_a = llm_provider.has_anthropic_key(raw_cfg)
    cfg = merge_agent_llm_config(raw_cfg, has_anthropic_key=has_a)

    if not llm_provider.has_any_llm_key(cfg):
        logger.info(
            "clinical-evolution/structure: sem chaves LLM — 503 tenant=%s note=%s len_md=%s",
            body.tenant_id[:8] if body.tenant_id else "",
            body.clinical_note_id[:8] if body.clinical_note_id else "",
            len(body.content_markdown or ""),
        )
        raise HTTPException(
            status_code=503,
            detail=(
                "Estruturação indisponível: configure OPENAI_API_KEY e/ou "
                "ANTHROPIC_API_KEY no ai-service."
            ),
        )

    snap_json, md = prepare_structure_inputs(
        patient_snapshot=body.patient_snapshot or {},
        content_markdown=body.content_markdown or "",
    )

    user_content = (
        f"### Snapshot do paciente (JSON)\n{snap_json}\n\n"
        f"### Tipo de nota\n{body.note_type}\n\n"
        f"### Evolução (Markdown)\n{md}"
    )

    system_prompt = (
        f"{SYSTEM_STRUCTURE_EVOLUTION_V3}\n\n"
        "Invoque obrigatoriamente a ferramenta "
        f"'{STRUCTURE_TOOL_NAME}' com o objeto JSON de extração."
    )

    try:
        result = await llm_provider.generate_with_tools(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_content}],
            tools=STRUCTURE_EVOLUTION_TOOLS,
            config=cfg,
            usage_step="clinical_evolution_structure",
        )
    except Exception as e:
        logger.warning("clinical-evolution/structure LLM falhou: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Estruturação indisponível: falha ao contactar o modelo de linguagem.",
        ) from e

    parsed = _parse_tool_structure_result(result)
    if not parsed:
        logger.warning(
            "clinical-evolution/structure: structured output inválido ou ausente note=%s",
            body.clinical_note_id[:8] if body.clinical_note_id else "",
        )
        return _degraded_structure_response(
            reason="Resposta não foi JSON estruturado válido.",
            llm_available=True,
            parse_ok=False,
        )

    return _build_response_from_parsed(parsed)
