---
name: agente-product-owner
description: Ativa o subagente product-owner (backlog, milestones, issues GitHub) no ONCONAV. Use para desdobrar épicos, priorização de entrega ou quando o usuário pedir /po.
disable-model-invocation: false
---

# Agente `product-owner`

## Delegar

- **Task** `subagent_type`: `product-owner`
- **Definição:** `.cursor/agents/product-owner.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/product-owner.mdc`

## Ajuda transversal

- [agente-onconav](../agente-onconav/SKILL.md)
