---
name: agente-openai
description: Ativa o subagente openai (API OpenAI, streaming, structured outputs, tools, Agents SDK) no ONCONAV. Use quando o pedido citar OpenAI API, gpt-* com tools ou OpenAI Agents SDK.
disable-model-invocation: true
---

# Agente `openai`

## Delegar

- **Task** `subagent_type`: `openai`
- **Definição:** `.cursor/agents/openai.md`

## Tarefas → skills `tarefa-*`

| ID | Skill |
|----|--------|
| OP1–OP2 | [tarefa-openai-api](../tarefa-openai-api/SKILL.md) |
| OP3–OP4 | [tarefa-openai-tools-agents](../tarefa-openai-tools-agents/SKILL.md) |

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/ai-service.mdc`

## Ajuda transversal

- [agente-anthropic](../agente-anthropic/SKILL.md) · [agente-ai-service](../agente-ai-service/SKILL.md) · [agente-onconav](../agente-onconav/SKILL.md) · [task-skill-agent-router](../task-skill-agent-router/SKILL.md)
