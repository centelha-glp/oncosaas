---
name: agente-langchain
description: Ativa o subagente langchain (LCEL, Runnable, prompts, bind_tools, retrieval LangChain) no ONCONAV. Use quando o pedido citar LangChain ou LCEL sem foco exclusivo em LangGraph.
disable-model-invocation: true
---

# Agente `langchain`

## Delegar

- **Task** `subagent_type`: `langchain`
- **Definição:** `.cursor/agents/langchain.md`

## Tarefas → skills `tarefa-*`

| ID | Skill |
|----|--------|
| LC1–LC2 | [tarefa-langchain-compose](../tarefa-langchain-compose/SKILL.md) |
| LC3 | [tarefa-langchain-agents-tools](../tarefa-langchain-agents-tools/SKILL.md) |
| LC4–LC5 | [tarefa-langchain-rag-trace](../tarefa-langchain-rag-trace/SKILL.md) |

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/ai-service.mdc`
- `.cursor/rules/llm-agent-architect.mdc` (quando afectar o pipeline)

## Ajuda transversal

- [agente-rag-engineer](../agente-rag-engineer/SKILL.md) · [agente-langgraph](../agente-langgraph/SKILL.md) · [agente-onconav](../agente-onconav/SKILL.md) · [task-skill-agent-router](../task-skill-agent-router/SKILL.md)
