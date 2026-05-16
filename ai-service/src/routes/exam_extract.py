"""
Extração estruturada de exames (PDF, imagens, texto, áudio transcrito) para evolução em Markdown.
Protegido por BACKEND_SERVICE_TOKEN (via router pai).
"""

from __future__ import annotations

import base64
import binascii
import logging
from io import BytesIO
from typing import Any, List, Optional

from fastapi import APIRouter, Header, HTTPException
from openai import APIError as OpenAIAPIError
from pydantic import BaseModel, ConfigDict, Field

from ..agent.llm_provider import ExamExtractStructuredParseError, llm_provider
from ..agent.prompts.exam_extract_prompt import (
    EXAM_EXTRACT_SYSTEM,
    exam_extract_user_instruction,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_FILES = 10


def _normalize_mime(mime: str) -> str:
    s = (mime or "").strip().lower()
    if not s:
        return ""
    return s.split(";", 1)[0].strip()


_AUDIO_BASE_MIMES = frozenset(
    {
        "audio/webm",
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "audio/m4a",
        "audio/x-m4a",
        "audio/wav",
        "audio/x-wav",
        "audio/flac",
        "audio/ogg",
        "audio/opus",
    }
)

_MULTIMODAL_MIMES = frozenset(
    {"application/pdf", "image/jpeg", "image/png", "image/webp"}
)

_ALLOWED_UPLOAD_MIMES = _AUDIO_BASE_MIMES | _MULTIMODAL_MIMES


class ExamFilePart(BaseModel):
    mimeType: str = Field(..., min_length=3, max_length=128)
    dataBase64: str = Field(..., min_length=1)


class ExamExtractRequest(BaseModel):
    plainText: str | None = None
    files: List[ExamFilePart] = Field(default_factory=list)


class ExamExtractComplementaryResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    performedAt: Optional[str] = None
    valueNumeric: Optional[float] = None
    valueText: Optional[str] = None
    unit: Optional[str] = None
    referenceRange: Optional[str] = None
    isAbnormal: Optional[bool] = None
    report: Optional[str] = None
    components: Any = None


class ExamExtractComplementaryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: str
    name: str
    code: Optional[str] = None
    loincCode: Optional[str] = None
    result: Optional[ExamExtractComplementaryResult] = None


class ExamExtractResponse(BaseModel):
    markdownSummary: str
    detectedCategories: List[str]
    disclaimer: str
    markdownFromStructuredParse: bool = Field(
        default=False,
        description="True só quando markdownSummary veio de JSON estruturado validado.",
    )
    complementaryExams: Optional[List[ExamExtractComplementaryItem]] = Field(
        default=None,
        description="Exames complementares estruturados (opcional).",
    )


def _pdf_text(raw: bytes) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(raw))
        parts: List[str] = []
        for page in reader.pages:
            t = page.extract_text() or ""
            if t.strip():
                parts.append(t)
        return "\n\n".join(parts).strip()
    except Exception as e:
        logger.warning("PDF text extraction failed: %s", type(e).__name__)
        return ""


def _build_multimodal_payload(
    req: ExamExtractRequest,
) -> tuple[List[dict[str, Any]], List[dict[str, Any]], str]:
    """
    Monta blocos só para ficheiros multimodais (PDF + imagens).
    Retorna (anthropic_user_blocks, openai_user_content, user_text_instruction).
    """
    user_instr = exam_extract_user_instruction(req.plainText)
    anthropic_blocks: List[dict[str, Any]] = [
        {"type": "text", "text": user_instr},
    ]
    openai_parts: List[dict[str, Any]] = [
        {"type": "text", "text": user_instr},
    ]

    for idx, f in enumerate(req.files):
        norm = _normalize_mime(f.mimeType)
        if norm not in _MULTIMODAL_MIMES:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo MIME multimodal não permitido: {f.mimeType}",
            )
        try:
            raw = base64.b64decode(f.dataBase64, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(
                status_code=400, detail=f"Base64 inválido no ficheiro {idx + 1}"
            )
        if not raw:
            raise HTTPException(
                status_code=400, detail=f"Ficheiro {idx + 1} vazio após decode"
            )

        if norm == "application/pdf":
            anthropic_blocks.append(
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": base64.standard_b64encode(raw).decode("ascii"),
                    },
                }
            )
            pdf_txt = _pdf_text(raw)
            if pdf_txt:
                openai_parts.append(
                    {
                        "type": "text",
                        "text": (
                            "[Texto extraído do PDF — validar com o original]\n\n"
                            + pdf_txt[:120_000]
                        ),
                    }
                )
            else:
                openai_parts.append(
                    {
                        "type": "text",
                        "text": (
                            "[PDF recebido; extração de texto local falhou — "
                            "use fornecedor com suporte a documento ou reenvie como imagem.]"
                        ),
                    }
                )
        else:
            b64 = base64.standard_b64encode(raw).decode("ascii")
            anthropic_blocks.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": norm,
                        "data": b64,
                    },
                }
            )
            openai_parts.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{norm};base64,{b64}",
                    },
                }
            )

    return anthropic_blocks, openai_parts, user_instr


@router.post("/exam-extract", response_model=ExamExtractResponse)
async def exam_extract(
    body: ExamExtractRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id"),
) -> ExamExtractResponse:
    """
    `X-Tenant-Id` é obrigatório para rastreio multi-tenant; não regista conteúdo clínico.
    """
    if not x_tenant_id or not x_tenant_id.strip():
        raise HTTPException(status_code=400, detail="X-Tenant-Id obrigatório")
    if len(body.files) > _MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Máximo de {_MAX_FILES} ficheiros por pedido",
        )

    text = (body.plainText or "").strip()
    if not text and not body.files:
        raise HTTPException(
            status_code=400,
            detail="Envie plainText e/ou ficheiros",
        )

    merged_plain_parts: List[str] = []
    if text:
        merged_plain_parts.append(text)

    multimodal_files: List[ExamFilePart] = []
    audio_idx = 0
    cfg: dict[str, Any] = {}
    for idx, f in enumerate(body.files):
        norm = _normalize_mime(f.mimeType)
        if norm not in _ALLOWED_UPLOAD_MIMES:
            raise HTTPException(
                status_code=400, detail=f"Tipo MIME não permitido: {f.mimeType}"
            )
        try:
            raw = base64.b64decode(f.dataBase64, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(
                status_code=400, detail=f"Base64 inválido no ficheiro {idx + 1}"
            )
        if not raw:
            raise HTTPException(
                status_code=400, detail=f"Ficheiro {idx + 1} vazio após decode"
            )
        if norm in _MULTIMODAL_MIMES:
            multimodal_files.append(f)
        if norm in _AUDIO_BASE_MIMES:
            audio_idx += 1
            ext = ".webm"
            if norm in ("audio/mpeg", "audio/mp3"):
                ext = ".mp3"
            elif norm in ("audio/wav", "audio/x-wav"):
                ext = ".wav"
            elif norm in ("audio/mp4", "audio/m4a", "audio/x-m4a"):
                ext = ".m4a"
            elif norm == "audio/flac":
                ext = ".flac"
            elif norm == "audio/ogg":
                ext = ".ogg"
            fname = f"exame-audio-{audio_idx}{ext}"
            try:
                transcript = await llm_provider.transcribe_exam_audio(
                    raw,
                    filename=fname,
                    mime_hint=f.mimeType,
                    config=cfg,
                )
            except RuntimeError as e:
                logger.warning("exam_extract audio transcription unavailable: %s", e)
                raise HTTPException(
                    status_code=503,
                    detail=str(e)
                    or "Transcrição de áudio indisponível: configure OPENAI_API_KEY no ai-service.",
                ) from e
            except OpenAIAPIError as e:
                logger.error("exam_extract OpenAI transcription failed: %s", e, exc_info=True)
                raise HTTPException(
                    status_code=502,
                    detail="Falha ao contactar o serviço de transcrição. Tente novamente mais tarde.",
                ) from e
            except Exception as e:
                logger.error("exam_extract transcription error: %s", e, exc_info=True)
                raise HTTPException(
                    status_code=502,
                    detail="Falha ao contactar o serviço de transcrição. Tente novamente mais tarde.",
                ) from e
            merged_plain_parts.append(
                f"--- Transcrição (áudio {audio_idx}) ---\n{transcript}"
            )

    merged_plain = "\n\n".join(merged_plain_parts).strip() if merged_plain_parts else None

    if not merged_plain and not multimodal_files:
        raise HTTPException(
            status_code=400,
            detail="Envie plainText e/ou ficheiros multimodais; áudio vazio após transcrição.",
        )

    inner = ExamExtractRequest(plainText=merged_plain, files=multimodal_files)
    anthropic_blocks, openai_parts, user_instr = _build_multimodal_payload(inner)

    try:
        result = await llm_provider.generate_exam_extract_structured(
            system_prompt=EXAM_EXTRACT_SYSTEM,
            user_text_instruction=user_instr,
            anthropic_user_blocks=anthropic_blocks,
            openai_user_content=openai_parts,
            config={},
        )
    except ExamExtractStructuredParseError as pe:
        if pe.had_model_text:
            logger.warning("exam_extract structured JSON parse failed (model returned non-JSON)")
            raise HTTPException(
                status_code=502,
                detail="Extração indisponível: resposta do modelo inválida. Tente novamente.",
            ) from pe
        logger.warning(
            "exam_extract structured parse failed (empty upstream); "
            "see llm_provider warning for empty output vs missing keys"
        )
        raise HTTPException(
            status_code=503,
            detail="Extração indisponível; tente novamente.",
        ) from pe

    validated_exams: Optional[List[ExamExtractComplementaryItem]] = None
    raw_ce = result.get("complementaryExams")
    if isinstance(raw_ce, list) and raw_ce:
        validated_exams = []
        for item in raw_ce:
            try:
                validated_exams.append(ExamExtractComplementaryItem.model_validate(item))
            except Exception:
                logger.debug("exam_extract skip invalid complementaryExams item", exc_info=True)
        if not validated_exams:
            validated_exams = None

    return ExamExtractResponse(
        markdownSummary=result["markdownSummary"],
        detectedCategories=result["detectedCategories"],
        disclaimer=result["disclaimer"],
        markdownFromStructuredParse=bool(
            result.get("markdownFromStructuredParse", False)
        ),
        complementaryExams=validated_exams,
    )
