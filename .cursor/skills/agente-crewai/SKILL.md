---
name: agente-crewai
description: Ativa o subagente crewai (Crew, Agent, Task, processos CrewAI) no ONCONAV. Use quando o pedido citar CrewAI, crew de agentes ou expected_output de tasks.
disable-model-invocation: true
---

# Agente `crewai`

## Delegar

- **Task** `subagent_type`: `crewai`
- **Definição:** `.cursor/agents/crewai.md`

## Tarefas → skills `tarefa-*`

| ID | Skill |
|----|--------|
| CR1 | [tarefa-crewai-design](../tarefa-crewai-design/SKILL.md) |
| CR2–CR3 | [tarefa-crewai-tasks-tools](../tarefa-crewai-tasks-tools/SKILL.md) |

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/ai-service.mdc`
- `.cursor/rules/llm-agent-architect.mdc` (quando competir com o desenho do orchestrator)

## Ajuda transversal

- [agente-langgraph](../agente-langgraph/SKILL.md) · [agente-onconav](../agente-onconav/SKILL.md) · [task-skill-agent-router](../task-skill-agent-router/SKILL.md)
