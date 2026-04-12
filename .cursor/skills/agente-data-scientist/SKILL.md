---
name: agente-data-scientist
description: Ativa o subagente data-scientist (treino LightGBM, EDA, métricas, bias) no ONCONAV. Use para laboratório de ML de priorização, não para só ajustar prompts.
---

# Agente `data-scientist`

## Delegar

- **Task** `subagent_type`: `data-scientist`
- **Definição:** `.cursor/agents/data-scientist.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/ai-service.mdc` (contexto produto; treino pesado é laboratório)

## Skill legada

- [modelo](../modelo/SKILL.md)

## Ajuda transversal

- [agente-engenheiro-ia-predicao](../agente-engenheiro-ia-predicao/SKILL.md) — contrato em produto · [agente-onconav](../agente-onconav/SKILL.md)
