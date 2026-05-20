"""
POST /api/v1/clinical-evolution/suggest-orders — sugestão de pedidos/receita em rascunho.

Pipeline 4 chamadas LLM em 2 ondas (structured output via generate_with_tools):
  Onda 1 (paralelo): exam context (1A) + rx context (1B) — 1B omitido se note_type NURSING
  Onda 2 (paralelo): exam generate (2A) + rx generate (2B)
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..agent.llm_provider import llm_provider
from ..agent.prompts.clinical_evolution_exam_context_prompt import SYSTEM_EXAM_CONTEXT_V1
from ..agent.prompts.clinical_evolution_exam_generate_prompt import (
    SYSTEM_EXAM_GENERATE_V2,
)
from ..agent.prompts.clinical_evolution_rx_context_prompt import SYSTEM_RX_CONTEXT_V1
from ..agent.prompts.clinical_evolution_rx_generate_prompt import SYSTEM_RX_GENERATE_V2
from ..agent.clinical_evolution_orders_tools import (
    EXAM_CONTEXT_TOOL_NAME,
    EXAM_GENERATE_TOOL_NAME,
    ORDER_STEP_TOOLS,
    RX_CONTEXT_TOOL_NAME,
    RX_GENERATE_TOOL_NAME,
)
from ..agent.clinical_evolution_truncation import prepare_structure_inputs
from ..config.llm_defaults import merge_agent_llm_config
from .clinical_evolution_structure import RejectionItem, _parse_structure_json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/clinical-evolution", tags=["clinical-evolution"])

PIPELINE_SCHEMA_VERSION = "orders_pipeline_v2"

_LLM_TIMEOUT_S = 55.0


class SuggestOrdersRequest(BaseModel):
    tenant_id: str = Field(..., min_length=1)
    patient_id: str = Field(..., min_length=1)
    clinical_note_id: str = Field(..., min_length=1)
    note_type: str = Field(..., min_length=1)
    content_markdown: str = ""
    patient_snapshot: dict[str, Any] = Field(default_factory=dict)
    include_debug_context: bool = True


class ExamRequestSuggestionOut(BaseModel):
    display_name: str = Field(..., min_length=1)
    code: Optional[str] = None
    loinc_code: Optional[str] = None
    request_source: Literal["explicit", "contextual"] = "explicit"
    rationale: Optional[str] = None


class PrescriptionLineSuggestionOut(BaseModel):
    medication_name: str = Field(..., min_length=1, max_length=500)
    catalog_key: Optional[str] = Field(None, max_length=128)
    dosage: Optional[str] = Field(None, max_length=128)
    frequency: Optional[str] = Field(None, max_length=128)
    route: Optional[str] = Field(None, max_length=64)
    duration: Optional[str] = Field(None, max_length=128)
    indication: Optional[str] = Field(None, max_length=500)
    prescription_intent: Literal["NEW", "DOSE_CHANGE", "SUSPEND"]


class SuggestOrdersResponse(BaseModel):
    pipeline_schema_version: str = PIPELINE_SCHEMA_VERSION
    clinical_exam_requests: list[ExamRequestSuggestionOut] = Field(default_factory=list)
    clinical_prescription_lines: list[PrescriptionLineSuggestionOut] = Field(default_factory=list)
    exam_context: dict[str, Any] = Field(default_factory=dict)
    prescription_context: dict[str, Any] = Field(default_factory=dict)
    rejection_report: list[RejectionItem] = Field(default_factory=list)


def _is_nursing_note(note_type: str) -> bool:
    return (note_type or "").strip().upper() == "NURSING"


def _build_wave1_user_content(body: SuggestOrdersRequest) -> str:
    snap_json, md = prepare_structure_inputs(
        patient_snapshot=body.patient_snapshot or {},
        content_markdown=body.content_markdown or "",
    )
    return (
        f"### Snapshot do paciente (JSON)\n{snap_json}\n\n"
        f"### Tipo de nota\n{body.note_type}\n\n"
        f"### Evolução (Markdown)\n{md}"
    )


def _rejection(
    domain: str,
    reason: str,
    field: Optional[str] = None,
) -> RejectionItem:
    return RejectionItem(domain=domain, reason=reason, field=field)


def _collect_rejections_from_parsed(
    parsed: Optional[dict[str, Any]],
    domain: str,
) -> list[RejectionItem]:
    if not parsed:
        return [_rejection(domain, "Resposta não foi JSON estruturado válido.")]
    out: list[RejectionItem] = []
    for row in parsed.get("rejection_report") or []:
        if isinstance(row, dict) and row.get("reason"):
            try:
                item = RejectionItem.model_validate(
                    {**row, "domain": row.get("domain") or domain}
                )
                out.append(item)
            except Exception:
                out.append(
                    _rejection(domain, str(row.get("reason")), row.get("field"))
                )
    return out


def _parse_tool_json_result(
    result: dict[str, Any],
    tool_name: str,
) -> Optional[dict[str, Any]]:
    for tc in result.get("tool_calls") or []:
        fn = tc.get("function") or {}
        if fn.get("name") != tool_name:
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


async def _llm_json_step(
    *,
    system_prompt: str,
    user_content: str,
    cfg: dict[str, Any],
    usage_step: str,
    tool_name: str,
) -> tuple[Optional[dict[str, Any]], list[RejectionItem]]:
    tools = ORDER_STEP_TOOLS.get(tool_name) or []
    system = (
        f"{system_prompt}\n\n"
        f"Invoque obrigatoriamente a ferramenta '{tool_name}' com o objeto JSON de saída."
    )
    domain = usage_step.replace("clinical_evolution_", "")
    try:
        result = await asyncio.wait_for(
            llm_provider.generate_with_tools(
                system_prompt=system,
                messages=[{"role": "user", "content": user_content}],
                tools=tools,
                config=cfg,
                usage_step=usage_step,
            ),
            timeout=_LLM_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        logger.warning("clinical-evolution/suggest-orders: timeout step=%s", usage_step)
        return None, [_rejection(domain, "Timeout na chamada LLM.")]
    except Exception as e:
        logger.warning(
            "clinical-evolution/suggest-orders: LLM falhou step=%s: %s",
            usage_step,
            e,
        )
        return None, [_rejection(domain, f"Falha na chamada LLM: {e}")]

    parsed = _parse_tool_json_result(result, tool_name)
    if not parsed:
        return None, [
            _rejection(
                domain,
                "Resposta não foi JSON estruturado válido (tool ausente ou inválida).",
            )
        ]
    return parsed, _collect_rejections_from_parsed(parsed, domain)


def _slice_list(value: Any, limit: int) -> list[Any]:
    if not isinstance(value, list):
        return []
    return value[:limit]


def _summary_snapshot_for_exams(snapshot: dict[str, Any]) -> str:
    slim: dict[str, Any] = {}
    for key in (
        "recentLaboratoryResults",
        "comorbidities",
        "diagnoses",
        "cancerDiagnoses",
        "patient",
    ):
        if key in snapshot:
            slim[key] = snapshot.get(key)
    slim["medications"] = _slice_list(snapshot.get("medications"), 40)
    return json.dumps(slim, ensure_ascii=False)


def _summary_snapshot_for_rx(snapshot: dict[str, Any]) -> str:
    slim: dict[str, Any] = {
        "medications": _slice_list(snapshot.get("medications"), 40),
    }
    for key in (
        "diagnoses",
        "cancerDiagnoses",
        "comorbidities",
        "allergies",
        "allergyEntries",
    ):
        if key in snapshot:
            slim[key] = snapshot.get(key)
    return json.dumps(slim, ensure_ascii=False)


def _build_exam_requests(parsed: Optional[dict[str, Any]]) -> list[ExamRequestSuggestionOut]:
    if not parsed:
        return []
    raw_list = parsed.get("clinical_exam_requests")
    if not isinstance(raw_list, list):
        return []
    out: list[ExamRequestSuggestionOut] = []
    for i, row in enumerate(raw_list):
        if not isinstance(row, dict):
            continue
        try:
            source = row.get("request_source") or "explicit"
            if source not in ("explicit", "contextual"):
                source = "explicit"
            if source == "contextual" and not (row.get("rationale") or "").strip():
                logger.debug("suggest-orders: skip contextual exam sem rationale idx=%s", i)
                continue
            out.append(
                ExamRequestSuggestionOut(
                    display_name=str(row.get("display_name") or "").strip(),
                    code=row.get("code"),
                    loinc_code=row.get("loinc_code"),
                    request_source=source,
                    rationale=row.get("rationale"),
                )
            )
        except Exception:
            logger.debug("suggest-orders: skip invalid exam idx=%s", i)
    return [x for x in out if x.display_name]


def _build_prescription_lines(
    parsed: Optional[dict[str, Any]],
) -> list[PrescriptionLineSuggestionOut]:
    if not parsed:
        return []
    raw_list = parsed.get("clinical_prescription_lines")
    if not isinstance(raw_list, list):
        return []
    out: list[PrescriptionLineSuggestionOut] = []
    valid_intents = {"NEW", "DOSE_CHANGE", "SUSPEND"}
    for i, row in enumerate(raw_list):
        if not isinstance(row, dict):
            continue
        intent = row.get("prescription_intent")
        if intent not in valid_intents:
            continue
        name = str(row.get("medication_name") or "").strip()
        if not name:
            continue
        try:
            out.append(
                PrescriptionLineSuggestionOut(
                    medication_name=name,
                    catalog_key=row.get("catalog_key"),
                    dosage=row.get("dosage"),
                    frequency=row.get("frequency"),
                    route=row.get("route"),
                    duration=row.get("duration"),
                    indication=row.get("indication"),
                    prescription_intent=intent,
                )
            )
        except Exception:
            logger.debug("suggest-orders: skip invalid rx line idx=%s", i)
    return out


async def _run_exam_context(
    body: SuggestOrdersRequest,
    cfg: dict[str, Any],
    user_wave1: str,
) -> tuple[dict[str, Any], list[RejectionItem]]:
    parsed, rej = await _llm_json_step(
        system_prompt=SYSTEM_EXAM_CONTEXT_V1,
        user_content=user_wave1,
        cfg=cfg,
        usage_step="clinical_evolution_exam_context",
        tool_name=EXAM_CONTEXT_TOOL_NAME,
    )
    return parsed or {}, rej


async def _run_rx_context(
    body: SuggestOrdersRequest,
    cfg: dict[str, Any],
    user_wave1: str,
) -> tuple[dict[str, Any], list[RejectionItem]]:
    parsed, rej = await _llm_json_step(
        system_prompt=SYSTEM_RX_CONTEXT_V1,
        user_content=user_wave1,
        cfg=cfg,
        usage_step="clinical_evolution_rx_context",
        tool_name=RX_CONTEXT_TOOL_NAME,
    )
    return parsed or {}, rej


async def _run_exam_generate(
    exam_context: dict[str, Any],
    snapshot: dict[str, Any],
    cfg: dict[str, Any],
) -> tuple[list[ExamRequestSuggestionOut], list[RejectionItem]]:
    ctx_json = json.dumps(exam_context, ensure_ascii=False)
    snap_json = _summary_snapshot_for_exams(snapshot)
    user_content = (
        f"### Contexto de exames (passo 1A)\n{ctx_json}\n\n"
        f"### Snapshot resumido (labs recentes, medicamentos, comorbidades)\n"
        f"{snap_json}"
    )
    parsed, rej = await _llm_json_step(
        system_prompt=SYSTEM_EXAM_GENERATE_V2,
        user_content=user_content,
        cfg=cfg,
        usage_step="clinical_evolution_exam_generate",
        tool_name=EXAM_GENERATE_TOOL_NAME,
    )
    return _build_exam_requests(parsed), rej


async def _run_rx_generate(
    rx_context: dict[str, Any],
    snapshot: dict[str, Any],
    cfg: dict[str, Any],
) -> tuple[list[PrescriptionLineSuggestionOut], list[RejectionItem]]:
    ctx_json = json.dumps(rx_context, ensure_ascii=False)
    snap_json = _summary_snapshot_for_rx(snapshot)
    user_content = (
        f"### Contexto de prescrição (passo 1B)\n{ctx_json}\n\n"
        f"### Snapshot clínico resumido (medicamentos, diagnósticos, "
        f"comorbidades, alergias)\n{snap_json}"
    )
    parsed, rej = await _llm_json_step(
        system_prompt=SYSTEM_RX_GENERATE_V2,
        user_content=user_content,
        cfg=cfg,
        usage_step="clinical_evolution_rx_generate",
        tool_name=RX_GENERATE_TOOL_NAME,
    )
    return _build_prescription_lines(parsed), rej


def _merge_gather_errors(
    result: Any,
    domain: str,
) -> tuple[dict[str, Any], list[RejectionItem]]:
    if isinstance(result, Exception):
        logger.warning("clinical-evolution/suggest-orders: gather %s: %s", domain, result)
        return {}, [_rejection(domain, str(result))]
    return result


@router.post("/suggest-orders", response_model=SuggestOrdersResponse)
async def suggest_orders_from_evolution(
    body: SuggestOrdersRequest,
) -> SuggestOrdersResponse:
    empty = SuggestOrdersResponse()
    nursing = _is_nursing_note(body.note_type)

    raw_cfg: dict[str, Any] = {}
    has_a = llm_provider.has_anthropic_key(raw_cfg)
    cfg = merge_agent_llm_config(raw_cfg, has_anthropic_key=has_a)

    if not llm_provider.has_any_llm_key(cfg):
        logger.info(
            "clinical-evolution/suggest-orders: sem chaves LLM tenant=%s note=%s nursing=%s",
            body.tenant_id[:8] if body.tenant_id else "",
            body.clinical_note_id[:8] if body.clinical_note_id else "",
            nursing,
        )
        return empty

    user_wave1 = _build_wave1_user_content(body)
    rejection_report: list[RejectionItem] = []

    # —— Onda 1 ——
    wave1_tasks: list[Any] = [
        _run_exam_context(body, cfg, user_wave1),
    ]
    if not nursing:
        wave1_tasks.append(_run_rx_context(body, cfg, user_wave1))

    wave1_results = await asyncio.gather(*wave1_tasks, return_exceptions=True)

    exam_context: dict[str, Any] = {}
    rx_context: dict[str, Any] = {}

    exam_ctx_result = wave1_results[0]
    if isinstance(exam_ctx_result, Exception):
        exam_context, exam_ctx_rej = _merge_gather_errors(
            exam_ctx_result, "exam_context"
        )
    else:
        exam_context, exam_ctx_rej = exam_ctx_result
    rejection_report.extend(exam_ctx_rej)

    if not nursing:
        rx_ctx_result = wave1_results[1]
        if isinstance(rx_ctx_result, Exception):
            rx_context, rx_ctx_rej = _merge_gather_errors(
                rx_ctx_result, "rx_context"
            )
        else:
            rx_context, rx_ctx_rej = rx_ctx_result
        rejection_report.extend(rx_ctx_rej)

    # —— Onda 2 ——
    wave2_tasks: list[Any] = [
        _run_exam_generate(exam_context, body.patient_snapshot or {}, cfg),
    ]
    if not nursing:
        wave2_tasks.append(
            _run_rx_generate(rx_context, body.patient_snapshot or {}, cfg)
        )

    wave2_results = await asyncio.gather(*wave2_tasks, return_exceptions=True)

    clinical_exam_requests: list[ExamRequestSuggestionOut] = []
    clinical_prescription_lines: list[PrescriptionLineSuggestionOut] = []

    exam_gen_result = wave2_results[0]
    if isinstance(exam_gen_result, Exception):
        rejection_report.extend(_merge_gather_errors(exam_gen_result, "exam_generate")[1])
    else:
        exams, exam_gen_rej = exam_gen_result
        clinical_exam_requests = exams
        rejection_report.extend(exam_gen_rej)

    if not nursing:
        rx_gen_result = wave2_results[1]
        if isinstance(rx_gen_result, Exception):
            rejection_report.extend(
                _merge_gather_errors(rx_gen_result, "rx_generate")[1]
            )
        else:
            lines, rx_gen_rej = rx_gen_result
            clinical_prescription_lines = lines
            rejection_report.extend(rx_gen_rej)

    return SuggestOrdersResponse(
        pipeline_schema_version=PIPELINE_SCHEMA_VERSION,
        clinical_exam_requests=clinical_exam_requests,
        clinical_prescription_lines=clinical_prescription_lines,
        exam_context=exam_context if body.include_debug_context else {},
        prescription_context=rx_context if body.include_debug_context else {},
        rejection_report=rejection_report,
    )
