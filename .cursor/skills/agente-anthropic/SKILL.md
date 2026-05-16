---
name: agente-anthropic
description: Ativa o subagente anthropic (Messages API, tool_use, prompt caching, structured outputs Claude) no ONCONAV. Use quando o pedido citar Anthropic, Claude ou Messages API.
disable-model-invocation: true
---

# Agente `anthropic`

## Delegar

- **Task** `subagent_type`: `anthropic`
- **Definição:** `.cursor/agents/anthropic.md`

## Tarefas → skills `tarefa-*`

| ID | Skill |
|----|--------|
| AN1–AN2 | [tarefa-anthropic-messages](../tarefa-anthropic-messages/SKILL.md) |
| AN3–AN4 | [tarefa-anthropic-tools-structured](../tarefa-anthropic-tools-structured/SKILL.md) |

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/ai-service.mdc`

## Ajuda transversal

- [agente-openai](../agente-openai/SKILL.md) · [agente-ai-service](../agente-ai-service/SKILL.md) · [agente-onconav](../agente-onconav/SKILL.md) · [task-skill-agent-router](../task-skill-agent-router/SKILL.md)
