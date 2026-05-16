---
name: agente-langgraph
description: Ativa o subagente langgraph (LangGraph, StateGraph, checkpointer, HITL, streaming) no ONCONAV. Use quando o pedido citar LangGraph, grafo de agentes, interrupt ou migração para LangGraph.
disable-model-invocation: true
---

# Agente `langgraph`

## Delegar

- **Task** `subagent_type`: `langgraph`
- **Definição:** `.cursor/agents/langgraph.md`

## Tarefas → skills `tarefa-*`

| ID | Skill |
|----|--------|
| LG1–LG2 | [tarefa-langgraph-orchestration](../tarefa-langgraph-orchestration/SKILL.md) |
| LG3–LG4 | [tarefa-langgraph-persistence-hitl](../tarefa-langgraph-persistence-hitl/SKILL.md) |
| LG5–LG6 | [tarefa-langgraph-integration-debug](../tarefa-langgraph-integration-debug/SKILL.md) |

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/ai-service.mdc`
- `.cursor/rules/llm-agent-architect.mdc` (quando a mudança cruzar com o orchestrator)

## Ajuda transversal

- [agente-llm-agent-architect](../agente-llm-agent-architect/SKILL.md) · [agente-ai-service](../agente-ai-service/SKILL.md) · [agente-onconav](../agente-onconav/SKILL.md) · [task-skill-agent-router](../task-skill-agent-router/SKILL.md)
