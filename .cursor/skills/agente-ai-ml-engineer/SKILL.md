---
name: agente-ai-ml-engineer
description: Ativa o subagente ai-ml-engineer para entregas que cruzam conversação (ai-service) e modelo/score de priorização no ONCONAV. Use quando uma única tarefa exige ambos os domínios.
---

# Agente `ai-ml-engineer`

## Delegar

- **Task** `subagent_type`: `ai-ml-engineer`
- **Definição:** `.cursor/agents/ai-ml-engineer.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/ai-service.mdc`
- `.cursor/rules/engenheiro-ia-predicao.mdc`
- `.cursor/rules/engenheiro-ia-agentes.mdc`

## Ajuda transversal

- Se a tarefa puder partir em duas: [agente-ai-service](../agente-ai-service/SKILL.md) e [agente-engenheiro-ia-predicao](../agente-engenheiro-ia-predicao/SKILL.md) em sequência.
- [agente-onconav](../agente-onconav/SKILL.md)
