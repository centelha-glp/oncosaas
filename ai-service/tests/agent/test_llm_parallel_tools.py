"""Testes de execução paralela de tools no run_agentic_loop."""

import asyncio
import time

import pytest

from src.agent.llm_provider import LLMProvider


@pytest.mark.asyncio
async def test_run_tool_batch_parallel_faster_than_serial():
    provider = LLMProvider()
    sleeps = {"a": 0.12, "b": 0.12, "c": 0.12}

    class _TU:
        def __init__(self, name: str):
            self.name = name
            self.input = {}
            self.id = f"id-{name}"

    blocks = [_TU(n) for n in sleeps]

    async def executor(name: str, _inp: dict) -> str:
        await asyncio.sleep(sleeps[name])
        return f'{{"tool":"{name}"}}'

    all_calls: list = []
    start = time.monotonic()
    await provider._run_tool_batch(blocks, executor, all_calls)
    elapsed = time.monotonic() - start

    assert len(all_calls) == 3
    assert elapsed < 0.28


@pytest.mark.asyncio
async def test_run_tool_batch_preserves_order():
    provider = LLMProvider()

    class _TU:
        def __init__(self, name: str):
            self.name = name
            self.input = {}
            self.id = f"id-{name}"

    blocks = [_TU("first"), _TU("second")]

    async def executor(name: str, _inp: dict) -> str:
        return name

    all_calls: list = []
    results = await provider._run_tool_batch(blocks, executor, all_calls)
    assert [r["tool_use_id"] for r in results] == ["id-first", "id-second"]
