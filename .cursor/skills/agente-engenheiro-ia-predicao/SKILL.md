---
name: agente-engenheiro-ia-predicao
description: Ativa o subagente engenheiro-ia-predicao (priorityScore, contrato API/backend, integração do modelo de priorização no produto) no ONCONAV. Use para scoring em produção, não para EDA pesada.
---

# Agente `engenheiro-ia-predicao`

## Delegar

- **Task** `subagent_type`: `engenheiro-ia-predicao`
- **Definição:** `.cursor/agents/engenheiro-ia-predicao.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/engenheiro-ia-predicao.mdc`

## Ajuda transversal

- [agente-data-scientist](../agente-data-scientist/SKILL.md) — treino · [agente-backend-nestjs](../agente-backend-nestjs/SKILL.md) — contrato HTTP · [agente-onconav](../agente-onconav/SKILL.md)
