"""
Base class for specialized LLM subagents in the OncoNav multi-agent system.

Each subagent handles a specific clinical domain with domain-specific tools.
Runs its own agentic loop; tool calls are collected (not executed against the DB).
The orchestrator converts collected tool calls into backend action objects.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..llm_provider import llm_provider as global_llm_provider

logger = logging.getLogger(__name__)

MAX_SUBAGENT_ITERATIONS = 6


@dataclass
class SubAgentResult:
    """Result from a specialized subagent execution."""

    agent_name: str
    response: str
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    iterations: int = 0


class BaseSubAgent:
    """
    Base class for specialized LLM subagents.

    Each subagent defines:
    - name: identifier
    - system_prompt: domain-specific instructions
    - tools: domain-specific action tools

    The run() method uses run_agentic_loop() with no tool_executor,
    so tool calls are queued and returned to the orchestrator for processing.
    """

    name: str = "base"

    @property
    def system_prompt(self) -> str:
        raise NotImplementedError

    @property
    def tools(self) -> List[Dict[str, Any]]:
        return []

    async def run(
        self,
        context: str,
        conversation_history: List[Dict[str, str]],
        config: Optional[Dict[str, Any]] = None,
    ) -> SubAgentResult:
        """
        Run the subagent's agentic loop.

        Args:
            context: Formatted clinical context string (from context_builder + RAG)
            conversation_history: Recent conversation turns [{role, content}]
            config: LLM config (provider, model, api_keys)

        Returns:
            SubAgentResult with response text and collected tool_calls
        """
        config = config or {}

        subagent_config = {
            **config,
            "llm_model": config.get("subagent_model", "claude-sonnet-4-6"),
            "max_tokens": 1024,
        }

        system = f"{self.system_prompt}\n\n## CONTEXTO CLÍNICO\n\n{context}"

        messages = [
            m for m in conversation_history
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]

        try:
            result = await global_llm_provider.run_agentic_loop(
                system_prompt=system,
                initial_messages=messages,
                tools=self.tools,
                config=subagent_config,
                tool_executor=None,
                max_iterations=MAX_SUBAGENT_ITERATIONS,
            )
            return SubAgentResult(
                agent_name=self.name,
                response=result.get("response", ""),
                tool_calls=result.get("tool_calls", []),
                iterations=result.get("iterations", 0),
            )
        except Exception as e:
            logger.error(f"[{self.name}] Subagent error: {e}")
            return SubAgentResult(
                agent_name=self.name,
                response="",
                tool_calls=[],
                error=str(e),
            )
