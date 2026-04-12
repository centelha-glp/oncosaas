---
name: agente-llm-agent-architect
description: Ativa o subagente llm-agent-architect (orchestrator multi-step, tool use, redesenho do pipeline do agente) no ONCONAV. Use quando mudar fluxo conversacional estrutural, não só texto de prompt.
---

# Agente `llm-agent-architect`

## Delegar

- **Task** `subagent_type`: `llm-agent-architect`
- **Definição:** `.cursor/agents/llm-agent-architect.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/llm-agent-architect.mdc`
- `.cursor/rules/ai-service.mdc`

## Ajuda transversal

- [agente-llm-context-engineer](../agente-llm-context-engineer/SKILL.md) — prompts finos · [agente-rag-engineer](../agente-rag-engineer/SKILL.md) · [agente-onconav](../agente-onconav/SKILL.md)
