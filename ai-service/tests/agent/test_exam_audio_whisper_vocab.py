"""Testes do prompt de vocabulário Whisper para transcrição de exames."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from src.agent.exam_audio_whisper_vocab import build_exam_whisper_prompt
from src.agent.llm_provider import LLMProvider


def test_build_exam_whisper_prompt_non_empty_and_bounded():
    p = build_exam_whisper_prompt()
    assert isinstance(p, str)
    assert len(p) > 50
    assert len(p) <= 900
    assert "hemograma" in p.lower()
    assert "reagente" in p.lower() or "não reagente" in p.lower()


def test_build_exam_whisper_prompt_max_chars():
    assert len(build_exam_whisper_prompt(400)) <= 400
    assert len(build_exam_whisper_prompt(1)) <= 1


def test_build_exam_whisper_prompt_extra_appended(monkeypatch):
    monkeypatch.setenv("EXAM_WHISPER_PROMPT_EXTRA", "sigla_teste_xyz_extra")
    p = build_exam_whisper_prompt(8000)
    assert "sigla_teste_xyz_extra" in p


def test_truncation_prefers_suffix(monkeypatch):
    """Sufixo deve preservar termos de alta prioridade (fim da concatenação)."""
    monkeypatch.setenv("EXAM_WHISPER_PROMPT_EXTRA", "token_final_whisper_vocab")
    full = build_exam_whisper_prompt(20000)
    short = build_exam_whisper_prompt(80)
    assert "token_final_whisper_vocab" in full
    assert "token_final_whisper_vocab" in short
    assert len(short) <= 80


def test_transcribe_exam_audio_passes_prompt_to_whisper(monkeypatch):
    mock_create = AsyncMock(return_value=SimpleNamespace(text="  transcrito  "))
    mock_client = SimpleNamespace(
        audio=SimpleNamespace(
            transcriptions=SimpleNamespace(create=mock_create),
        )
    )
    provider = LLMProvider()
    monkeypatch.setattr(provider, "_get_openai_client", lambda _k=None: mock_client)

    async def _run():
        out = await provider.transcribe_exam_audio(
            b"\x00\x01",
            filename="exame.webm",
            mime_hint="audio/webm",
        )
        assert out == "transcrito"
        mock_create.assert_awaited_once()
        kw = mock_create.await_args.kwargs
        assert kw.get("prompt")
        assert len(kw["prompt"]) <= 900
        assert kw.get("file") is not None
        assert kw.get("model")

    asyncio.run(_run())
