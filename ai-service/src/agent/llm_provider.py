import json
import logging
from typing import Dict, List, Optional, Any
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
import os
from pathlib import Path
from dotenv import dotenv_values

"""
Multi-LLM provider abstraction.
Supports Anthropic (Claude) and OpenAI (GPT-4), configurable per tenant.
"""

logger = logging.getLogger(__name__)


class LLMProvider:
    """Abstração para múltiplos provedores LLM, configurável por tenant."""

    def __init__(self):
        self._anthropic_client: Optional[AsyncAnthropic] = None
        self._openai_client: Optional[AsyncOpenAI] = None

    def _looks_like_placeholder(self, value: Optional[str]) -> bool:
        if not value:
            return True
        normalized = value.strip().lower()
        return normalized in {
            "",
            "your-openai-api-key",
            "your-anthropic-api-key",
            "none",
            "null",
        }

    def _read_dotenv_key(self, key_name: str) -> Optional[str]:
        """
        Resolve API keys from ai-service/.env to avoid stale OS overrides.
        """
        service_root = Path(__file__).resolve().parents[2]  # ai-service/

        env_path = service_root / ".env"
        if env_path.exists():
            values = dotenv_values(env_path)
            value = values.get(key_name)
            if value and not self._looks_like_placeholder(value):
                return value.strip()

        return None

    def _resolve_api_key(self, key_name: str, explicit_key: Optional[str]) -> Optional[str]:
        # Explicit runtime key has highest priority.
        if explicit_key and not self._looks_like_placeholder(explicit_key):
            return explicit_key.strip()

        # Then prefer .env file values over process environment variables.
        file_key = self._read_dotenv_key(key_name)
        if file_key:
            return file_key

        env_key = os.getenv(key_name)
        if env_key and not self._looks_like_placeholder(env_key):
            return env_key.strip()

        return None

    def has_any_llm_key(self, config: Optional[Dict[str, Any]] = None) -> bool:
        """
        Return True if at least one LLM API key is available (from config or .env).
        Used by the orchestrator to decide whether to call an LLM at all.
        """
        cfg = config or {}
        anthropic = self._resolve_api_key("ANTHROPIC_API_KEY", cfg.get("anthropic_api_key"))
        openai = self._resolve_api_key("OPENAI_API_KEY", cfg.get("openai_api_key"))
        return bool(anthropic or openai)

    def has_anthropic_key(self, config: Optional[Dict[str, Any]] = None) -> bool:
        """
        Return True if Anthropic API key is available.
        The multi-agent pipeline (run_agentic_loop) requires Anthropic; when only
        OpenAI is set, the orchestrator should use generate() instead.
        """
        cfg = config or {}
        key = self._resolve_api_key("ANTHROPIC_API_KEY", cfg.get("anthropic_api_key"))
        return bool(key)

    def _get_anthropic_client(self, api_key: Optional[str] = None) -> Optional[AsyncAnthropic]:
        """Get or create Anthropic client."""
        key = self._resolve_api_key("ANTHROPIC_API_KEY", api_key)
        if not key:
            return None
        return AsyncAnthropic(api_key=key)

    def _get_openai_client(self, api_key: Optional[str] = None) -> Optional[AsyncOpenAI]:
        """Get or create OpenAI client."""
        key = self._resolve_api_key("OPENAI_API_KEY", api_key)
        if not key:
            return None
        return AsyncOpenAI(api_key=key)

    async def generate(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        config: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Generate a response using the configured LLM provider.

        Args:
            system_prompt: System prompt for the LLM
            messages: Conversation history [{role, content}]
            config: Agent configuration with provider details

        Returns:
            Generated text response
        """
        config = config or {}
        provider = config.get("llm_provider", "anthropic")
        model = config.get("llm_model", "claude-sonnet-4-6")

        # Try primary provider
        try:
            if provider == "anthropic":
                return await self._call_anthropic(system_prompt, messages, model, config)
            elif provider == "openai":
                return await self._call_openai(system_prompt, messages, model, config)
            else:
                raise ValueError(f"Provider não suportado: {provider}")
        except Exception as e:
            logger.error(
                "Primary LLM (%s/%s) failed: %s (use fallback or safe message)",
                provider,
                model,
                e,
                exc_info=True,
            )

            # Try fallback provider
            fallback_provider = config.get("llm_fallback_provider")
            fallback_model = config.get("llm_fallback_model")

            if fallback_provider and fallback_model:
                logger.info(f"Trying fallback: {fallback_provider}/{fallback_model}")
                try:
                    if fallback_provider == "anthropic":
                        return await self._call_anthropic(
                            system_prompt, messages, fallback_model, config
                        )
                    elif fallback_provider == "openai":
                        return await self._call_openai(
                            system_prompt, messages, fallback_model, config
                        )
                except Exception as fallback_error:
                    logger.error(f"Fallback LLM also failed: {fallback_error}")

            # Return a safe fallback response
            logger.warning("LLM generate: using safe fallback (no working provider)")
            return self._fallback_response()

    async def generate_with_tools(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a response with tool use for structured extraction.

        Args:
            system_prompt: System prompt
            messages: Conversation history
            tools: Tool definitions for function calling
            config: Agent configuration

        Returns:
            Dict with response text and any tool calls
        """
        config = config or {}
        provider = config.get("llm_provider", "anthropic")
        model = config.get("llm_model", "claude-sonnet-4-6")

        if provider == "anthropic":
            return await self._call_anthropic_with_tools(
                system_prompt, messages, tools, model, config
            )
        elif provider == "openai":
            return await self._call_openai_with_tools(
                system_prompt, messages, tools, model, config
            )
        else:
            logger.warning("generate_with_tools: unsupported provider %s, using fallback", provider)
            return {"response": self._fallback_response(), "tool_calls": []}

    async def _call_anthropic(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        model: str,
        config: Dict[str, Any],
    ) -> str:
        """Call Anthropic Claude API."""
        api_key = config.get("anthropic_api_key")
        client = self._get_anthropic_client(api_key)

        if not client:
            raise RuntimeError("Anthropic API key not configured")

        # Anthropic uses system as a separate parameter
        anthropic_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m["role"] != "system"
        ]

        response = await client.messages.create(
            model=model,
            max_tokens=1024,
            system=system_prompt,
            messages=anthropic_messages,
        )

        return response.content[0].text

    async def _call_openai(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        model: str,
        config: Dict[str, Any],
    ) -> str:
        """Call OpenAI GPT API."""
        api_key = config.get("openai_api_key")
        client = self._get_openai_client(api_key)

        if not client:
            raise RuntimeError("OpenAI API key not configured")

        openai_messages = [{"role": "system", "content": system_prompt}]
        for m in messages:
            if m["role"] != "system":
                openai_messages.append({"role": m["role"], "content": m["content"]})

        response = await client.chat.completions.create(
            model=model,
            messages=openai_messages,
            temperature=0.7,
            max_tokens=1024,
        )

        return response.choices[0].message.content or ""

    def _tools_openai_to_anthropic(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert OpenAI function tools to Anthropic custom tool format."""
        anthropic_tools = []
        for t in tools:
            if t.get("type") == "function" and "function" in t:
                fn = t["function"]
                anthropic_tools.append({
                    "name": fn["name"],
                    "description": fn.get("description", ""),
                    "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
                })
            elif "name" in t and "input_schema" in t:
                anthropic_tools.append(t)
            else:
                logger.warning("Skipping tool with unknown format: %s", list(t.keys()))
        return anthropic_tools

    async def _call_anthropic_with_tools(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        model: str,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Call Anthropic with tool use."""
        api_key = config.get("anthropic_api_key")
        client = self._get_anthropic_client(api_key)

        if not client:
            return {"response": self._fallback_response(), "tool_calls": []}

        anthropic_tools = self._tools_openai_to_anthropic(tools)
        if not anthropic_tools:
            logger.warning("No valid tools after conversion; calling without tools")
            text = await self._call_anthropic(system_prompt, messages, model, config)
            return {"response": text, "tool_calls": []}

        anthropic_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m["role"] != "system"
        ]

        response = await client.messages.create(
            model=model,
            max_tokens=1024,
            system=system_prompt,
            messages=anthropic_messages,
            tools=anthropic_tools,
        )

        text_response = ""
        tool_calls = []

        for block in response.content:
            if block.type == "text":
                text_response = block.text
            elif block.type == "tool_use":
                inp = block.input
                args_str = json.dumps(inp) if isinstance(inp, dict) else (inp or "{}")
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "function": {"name": block.name, "arguments": args_str},
                })

        return {"response": text_response, "tool_calls": tool_calls}

    async def _call_openai_with_tools(
        self,
        system_prompt: str,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        model: str,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Call OpenAI with function calling."""
        api_key = config.get("openai_api_key")
        client = self._get_openai_client(api_key)

        if not client:
            return {"response": self._fallback_response(), "tool_calls": []}

        openai_messages = [{"role": "system", "content": system_prompt}]
        for m in messages:
            if m["role"] != "system":
                openai_messages.append({"role": m["role"], "content": m["content"]})

        # Use OpenAI format as-is, or convert from Anthropic format
        openai_tools = []
        for t in tools:
            if t.get("type") == "function" and "function" in t:
                openai_tools.append(t)
            elif "name" in t:
                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": t.get("description", ""),
                        "parameters": t.get("input_schema", {}),
                    },
                })

        response = await client.chat.completions.create(
            model=model,
            messages=openai_messages,
            tools=openai_tools if openai_tools else None,
            temperature=0.7,
            max_tokens=1024,
        )

        choice = response.choices[0]
        text_response = choice.message.content or ""
        tool_calls = []

        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments or "{}",
                    },
                })

        return {"response": text_response, "tool_calls": tool_calls}

    def _tools_to_openai_format(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert tools to OpenAI API format (type/function with name, description, parameters)."""
        out = []
        for t in tools:
            if t.get("type") == "function" and "function" in t:
                out.append(t)
            elif "name" in t:
                out.append({
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": t.get("description", ""),
                        "parameters": t.get("input_schema", {"type": "object", "properties": {}}),
                    },
                })
            else:
                logger.warning("Skipping tool with unknown format: %s", list(t.keys()))
        return out

    async def _run_agentic_loop_openai(
        self,
        system_prompt: str,
        initial_messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        config: Dict[str, Any],
        tool_executor: Optional[Any],
        max_iterations: int,
    ) -> Dict[str, Any]:
        """Run agentic loop using OpenAI (tool use + multiple turns). Used as fallback when Anthropic is unavailable."""
        client = self._get_openai_client(config.get("openai_api_key"))
        if not client:
            return {"response": "", "tool_calls": [], "iterations": 0}

        model = config.get("llm_fallback_model") or config.get("llm_model") or "gpt-4o"
        openai_tools = self._tools_to_openai_format(tools)
        if not openai_tools:
            logger.warning("run_agentic_loop_openai: no valid tools")

        working = [
            {"role": m["role"], "content": m.get("content") or ""}
            for m in initial_messages
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]
        openai_messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            *working,
        ]
        all_tool_calls: List[Dict[str, Any]] = []
        final_text = ""
        iterations = 0

        for iteration in range(max_iterations):
            iterations = iteration + 1
            try:
                create_kwargs: Dict[str, Any] = dict(
                    model=model,
                    messages=openai_messages,
                    temperature=0.3,
                    max_tokens=config.get("max_tokens", 2048),
                )
                if openai_tools:
                    create_kwargs["tools"] = openai_tools
                response = await client.chat.completions.create(**create_kwargs)
            except Exception as e:
                logger.error("OpenAI agentic loop error (iteration %s): %s", iterations, e)
                break

            msg = response.choices[0].message
            final_text = (msg.content or "").strip()

            if not getattr(msg, "tool_calls", None):
                break

            openai_messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments or "{}"},
                    }
                    for tc in msg.tool_calls
                ],
            })

            for tc in msg.tool_calls:
                name = tc.function.name
                try:
                    raw = tc.function.arguments or "{}"
                    inp = json.loads(raw) if isinstance(raw, str) else raw
                except json.JSONDecodeError:
                    inp = {}
                all_tool_calls.append({"name": name, "input": inp, "id": tc.id})

                if tool_executor:
                    try:
                        result_str = await tool_executor(name, inp)
                    except Exception as e:
                        logger.error("tool_executor error for %s: %s", name, e)
                        result_str = json.dumps({"error": str(e)})
                else:
                    result_str = json.dumps({"status": "queued", "tool": name})

                openai_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result_str if isinstance(result_str, str) else json.dumps(result_str),
                })

        return {
            "response": final_text,
            "tool_calls": all_tool_calls,
            "iterations": iterations,
        }

    async def run_agentic_loop(
        self,
        system_prompt: str,
        initial_messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        config: Optional[Dict[str, Any]] = None,
        tool_executor: Optional[Any] = None,
        max_iterations: int = 8,
    ) -> Dict[str, Any]:
        """
        Run multi-agent loop with tool use. Prefers Anthropic (Claude), falls back to OpenAI.

        If tool_executor is provided (async callable(name, input) -> str),
        it is called for each tool use and the result is returned to the LLM.

        Returns:
            {"response": str, "tool_calls": [...], "iterations": int}
        """
        config = config or {}
        result: Dict[str, Any] = {"response": "", "tool_calls": [], "iterations": 0}

        # 1) Prefer Anthropic
        client_anthropic = self._get_anthropic_client(config.get("anthropic_api_key"))
        if client_anthropic:
            try:
                anthropic_tools = self._tools_openai_to_anthropic(tools)
                working_messages = [
                    {"role": m["role"], "content": m["content"]}
                    for m in initial_messages
                    if m.get("role") in ("user", "assistant") and m.get("content")
                ]
                all_tool_calls: List[Dict[str, Any]] = []
                final_text = ""
                iterations = 0
                model = config.get("llm_model", "claude-opus-4-6")
                extra_params: Dict[str, Any] = {}
                if config.get("use_adaptive_thinking") and model in ("claude-opus-4-6", "claude-sonnet-4-6"):
                    extra_params["thinking"] = {"type": "adaptive"}

                for iteration in range(max_iterations):
                    iterations = iteration + 1
                    create_kwargs: Dict[str, Any] = dict(
                        model=model,
                        max_tokens=config.get("max_tokens", 2048),
                        system=system_prompt,
                        messages=working_messages,
                        **extra_params,
                    )
                    if anthropic_tools:
                        create_kwargs["tools"] = anthropic_tools
                    response = await client_anthropic.messages.create(**create_kwargs)

                    text_parts = []
                    tool_use_blocks = []
                    for block in response.content:
                        if block.type == "text":
                            text_parts.append(block.text)
                        elif block.type == "tool_use":
                            tool_use_blocks.append(block)
                        elif getattr(block, "type", None) == "thinking":
                            pass
                    final_text = " ".join(text_parts).strip()

                    if response.stop_reason == "end_turn" or not tool_use_blocks:
                        break

                    assistant_content = []
                    for block in response.content:
                        if block.type == "text":
                            assistant_content.append({"type": "text", "text": block.text})
                        elif block.type == "tool_use":
                            assistant_content.append({
                                "type": "tool_use",
                                "id": block.id,
                                "name": block.name,
                                "input": block.input,
                            })
                    working_messages.append({"role": "assistant", "content": assistant_content})

                    tool_results = []
                    for tu in tool_use_blocks:
                        tc = {"name": tu.name, "input": tu.input, "id": tu.id}
                        all_tool_calls.append(tc)
                        if tool_executor:
                            try:
                                result_str = await tool_executor(tu.name, tu.input)
                            except Exception as e:
                                logger.error("tool_executor error for %s: %s", tu.name, e)
                                result_str = json.dumps({"error": str(e)})
                        else:
                            result_str = json.dumps({"status": "queued", "tool": tu.name})
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tu.id,
                            "content": result_str if isinstance(result_str, str) else json.dumps(result_str),
                        })
                    working_messages.append({"role": "user", "content": tool_results})

                result = {
                    "response": final_text,
                    "tool_calls": all_tool_calls,
                    "iterations": iterations,
                    "provider": "anthropic",
                    "model": model,
                }
                if result["response"]:
                    return result
            except Exception as e:
                logger.warning("Anthropic agentic loop failed, trying OpenAI fallback: %s", e)

        # 2) Fallback: OpenAI
        if self._get_openai_client(config.get("openai_api_key")):
            try:
                result = await self._run_agentic_loop_openai(
                    system_prompt=system_prompt,
                    initial_messages=initial_messages,
                    tools=tools,
                    config=config,
                    tool_executor=tool_executor,
                    max_iterations=max_iterations,
                )
                if result.get("response"):
                    result["provider"] = "openai"
                    result["model"] = config.get("llm_fallback_model") or config.get("llm_model") or "gpt-4o"
                    logger.info("run_agentic_loop: using OpenAI fallback")
                    return result
            except Exception as e:
                logger.error("OpenAI agentic loop also failed: %s", e)

        if not result.get("response"):
            result["response"] = self._fallback_response()
        result.setdefault("provider", "none")
        result.setdefault("model", "")
        return result

    @staticmethod
    def _fallback_response() -> str:
        """Return a safe fallback when no LLM is available."""
        return (
            "Sua mensagem foi registrada. No momento, nosso sistema de IA está "
            "sendo configurado. Um membro da equipe de enfermagem será notificado "
            "para dar continuidade ao seu atendimento."
        )


# Global instance
llm_provider = LLMProvider()
