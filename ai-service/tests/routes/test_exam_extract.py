"""Testes da rota /api/v1/exam-extract (mock do LLM)."""

import os
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app
from src.agent.llm_provider import llm_provider
from src.agent.prompts.exam_extract_prompt import EXAM_EXTRACT_SYSTEM

client = TestClient(app)

TID = "550e8400-e29b-41d4-a716-446655440000"


def test_exam_extract_system_prompt_keywords():
    """Regressão leve: formato LAB (tabela EXAME|RESULTADO, sem VR/Status) e fidelidade imagem/patologia."""
    assert "| EXAME | RESULTADO |" in EXAM_EXTRACT_SYSTEM
    assert "| --- | --- |" in EXAM_EXTRACT_SYSTEM
    assert "VR | STATUS" not in EXAM_EXTRACT_SYSTEM
    assert "obrigatoriamente só siglas" in EXAM_EXTRACT_SYSTEM.lower()
    assert "negrito" in EXAM_EXTRACT_SYSTEM.lower()
    assert "não reagente" in EXAM_EXTRACT_SYSTEM.lower()
    assert "completude prevale sobre brevidade" in EXAM_EXTRACT_SYSTEM.lower()
    assert "## imagem" in EXAM_EXTRACT_SYSTEM.lower()
    assert "anatomia patológica" in EXAM_EXTRACT_SYSTEM.lower() or "anatomopatologia" in EXAM_EXTRACT_SYSTEM.lower()
    assert "sem cabeçalho de identificação" in EXAM_EXTRACT_SYSTEM.lower()
    assert "não invente" in EXAM_EXTRACT_SYSTEM.lower()
    assert "data da coleta" in EXAM_EXTRACT_SYSTEM.lower()
    assert "rótulos do tipo" in EXAM_EXTRACT_SYSTEM.lower()
    assert "para outros parâmetros" in EXAM_EXTRACT_SYSTEM.lower()
    assert "ureia → **u**" in EXAM_EXTRACT_SYSTEM.lower()
    assert "complementary_exams" in EXAM_EXTRACT_SYSTEM

_MOCK_RESULT = {
    "markdownSummary": "## Laboratorial\n\nHb 12 g/dL",
    "detectedCategories": ["LAB"],
    "disclaimer": "Validar com o original.",
    "markdownFromStructuredParse": True,
}


def _headers(*, tenant: bool = True) -> dict[str, str]:
    h: dict[str, str] = {}
    if tenant:
        h["X-Tenant-Id"] = TID
    st = os.environ.get("BACKEND_SERVICE_TOKEN", "").strip()
    if st:
        h["Authorization"] = f"Bearer {st}"
    return h


@patch(
    "src.routes.exam_extract.llm_provider.generate_exam_extract_structured",
    new_callable=AsyncMock,
)
def test_exam_extract_200_text_only(mock_llm: AsyncMock):
    mock_llm.return_value = _MOCK_RESULT
    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(),
        json={"plainText": "Hemograma: Hb 12", "files": []},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["markdownSummary"] == _MOCK_RESULT["markdownSummary"]
    assert data["detectedCategories"] == ["LAB"]
    assert data.get("markdownFromStructuredParse") is True
    mock_llm.assert_awaited_once()


def test_exam_extract_400_sem_corpo_util():
    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(),
        json={"plainText": "   ", "files": []},
    )
    assert r.status_code == 400


def test_exam_extract_400_sem_tenant_header():
    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(tenant=False),
        json={"plainText": "x", "files": []},
    )
    assert r.status_code == 422


@patch.object(llm_provider, "has_any_llm_key", return_value=False)
def test_exam_extract_200_sem_chaves_llm_resposta_estruturada_mock(mock_has_keys):
    """Sem OPENAI/ANTHROPIC: deve 200 com JSON válido e markdownFromStructuredParse=true."""
    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(),
        json={"plainText": "Creatinina 1,2 mg/dL", "files": []},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("markdownFromStructuredParse") is True
    assert data.get("detectedCategories") == ["OTHER"]
    assert "creatinina" in data["markdownSummary"].lower()
    mock_has_keys.assert_called()


@patch(
    "src.routes.exam_extract.llm_provider.generate_exam_extract_structured",
    new_callable=AsyncMock,
)
def test_exam_extract_400_mime_invalido(mock_llm: AsyncMock):
    import base64

    mock_llm.return_value = _MOCK_RESULT
    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(),
        json={
            "plainText": None,
            "files": [
                {
                    "mimeType": "application/octet-stream",
                    "dataBase64": base64.b64encode(b"x").decode("ascii"),
                }
            ],
        },
    )
    assert r.status_code == 400
    mock_llm.assert_not_called()


@patch(
    "src.routes.exam_extract.llm_provider.generate_exam_extract_structured",
    new_callable=AsyncMock,
)
@patch(
    "src.routes.exam_extract.llm_provider.transcribe_exam_audio",
    new_callable=AsyncMock,
)
def test_exam_extract_audio_transcricao_no_user_instruction(
    mock_transcribe: AsyncMock, mock_llm: AsyncMock
):
    """Áudio é transcrito e o texto entra na instrução utilizador enviada ao extract estruturado."""
    import base64

    mock_transcribe.return_value = "Paciente descreve creatinina 1,2 por voz."
    mock_llm.return_value = _MOCK_RESULT
    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(),
        json={
            "files": [
                {
                    "mimeType": "audio/webm",
                    "dataBase64": base64.b64encode(b"\x1a\x45\xdf\xa3fake").decode(
                        "ascii"
                    ),
                }
            ],
        },
    )
    assert r.status_code == 200
    mock_transcribe.assert_awaited_once()
    mock_llm.assert_awaited_once()
    instr = mock_llm.await_args.kwargs["user_text_instruction"]
    assert "Transcrição (áudio 1)" in instr
    assert "Paciente descreve creatinina" in instr


@patch(
    "src.routes.exam_extract.llm_provider.generate_exam_extract_structured",
    new_callable=AsyncMock,
)
@patch(
    "src.routes.exam_extract.llm_provider.transcribe_exam_audio",
    new_callable=AsyncMock,
)
def test_exam_extract_503_audio_sem_chave_openai(
    mock_transcribe: AsyncMock, mock_llm: AsyncMock
):
    mock_transcribe.side_effect = RuntimeError(
        "Configure OPENAI_API_KEY no ai-service para transcrever áudio na extração de exames."
    )
    import base64

    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(),
        json={
            "files": [
                {
                    "mimeType": "audio/webm;codecs=opus",
                    "dataBase64": base64.b64encode(b"x").decode("ascii"),
                }
            ],
        },
    )
    assert r.status_code == 503
    mock_llm.assert_not_called()


@patch(
    "src.routes.exam_extract.llm_provider.generate_exam_extract_structured",
    new_callable=AsyncMock,
)
def test_exam_extract_imagem_pequena(mock_llm: AsyncMock):
    import base64

    mock_llm.return_value = _MOCK_RESULT
    png = base64.b64encode(
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x00\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    ).decode("ascii")
    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(),
        json={"files": [{"mimeType": "image/png", "dataBase64": png}]},
    )
    assert r.status_code == 200
    mock_llm.assert_awaited_once()
    call_kw = mock_llm.await_args.kwargs
    blocks = call_kw["anthropic_user_blocks"]
    assert any(b.get("type") == "image" for b in blocks)


def test_parse_exam_extract_json_com_fence():
    from src.agent.llm_provider import LLMProvider

    raw = (
        '```json\n{"markdownSummary": "x", "detectedCategories": ["LAB"], '
        '"disclaimer": "d"}\n```'
    )
    out = LLMProvider._parse_exam_extract_json(raw)
    assert out is not None
    assert out["markdownSummary"] == "x"
    assert out["detectedCategories"] == ["LAB"]
    assert "complementaryExams" not in out


@patch(
    "src.routes.exam_extract.llm_provider.generate_exam_extract_structured",
    new_callable=AsyncMock,
)
def test_exam_extract_502_parse_failure_com_texto_do_modelo(mock_llm: AsyncMock):
    from src.agent.llm_provider import ExamExtractStructuredParseError

    mock_llm.side_effect = ExamExtractStructuredParseError(had_model_text=True)
    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(),
        json={"plainText": "Hb 12", "files": []},
    )
    assert r.status_code == 502


@patch(
    "src.routes.exam_extract.llm_provider.generate_exam_extract_structured",
    new_callable=AsyncMock,
)
def test_exam_extract_503_parse_failure_sem_texto_do_modelo(mock_llm: AsyncMock):
    from src.agent.llm_provider import ExamExtractStructuredParseError

    mock_llm.side_effect = ExamExtractStructuredParseError(had_model_text=False)
    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(),
        json={"plainText": "Hb 12", "files": []},
    )
    assert r.status_code == 503


def test_parse_exam_extract_json_complementary_exams_snake():
    from src.agent.llm_provider import LLMProvider

    raw = (
        '{"markdownSummary": "m", "detectedCategories": ["LAB"], "disclaimer": "d", '
        '"complementary_exams": [{"type": "laboratory", "name": "Hb", '
        '"result": {"performed_at": "2025-06-01", "value_numeric": 12.1, "unit": "g/dL"}}]}'
    )
    out = LLMProvider._parse_exam_extract_json(raw)
    assert out is not None
    assert out.get("complementaryExams")
    ce = out["complementaryExams"]
    assert len(ce) == 1
    assert ce[0]["type"] == "LABORATORY"
    assert ce[0]["name"] == "Hb"
    assert ce[0]["result"]["performedAt"] == "2025-06-01"
    assert ce[0]["result"]["valueNumeric"] == 12.1
    assert ce[0]["result"]["unit"] == "g/dL"


@patch(
    "src.routes.exam_extract.llm_provider.generate_exam_extract_structured",
    new_callable=AsyncMock,
)
def test_exam_extract_200_complementary_exams_no_break(mock_llm: AsyncMock):
    mock_llm.return_value = {
        **_MOCK_RESULT,
        "complementaryExams": [
            {
                "type": "LABORATORY",
                "name": "Hemoglobina",
                "result": {"valueNumeric": 12.0, "unit": "g/dL"},
            }
        ],
    }
    r = client.post(
        "/api/v1/exam-extract",
        headers=_headers(),
        json={"plainText": "Hb 12", "files": []},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["complementaryExams"]) == 1
    assert data["complementaryExams"][0]["type"] == "LABORATORY"
    assert data["complementaryExams"][0]["name"] == "Hemoglobina"
