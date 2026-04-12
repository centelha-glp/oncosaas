---
name: agente-seguranca-compliance
description: Ativa o subagente seguranca-compliance (LGPD, multi-tenant, audit, endurecimento de API) no ONCONAV. Use antes de merge sensível ou quando o usuário pedir revisão de segurança.
---

# Agente `seguranca-compliance`

## Delegar

- **Task** `subagent_type`: `seguranca-compliance`
- **Definição:** `.cursor/agents/seguranca-compliance.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/security.mdc`

## Skill legada

- [seguranca](../seguranca/SKILL.md)

## Ajuda transversal

- [agente-onconav](../agente-onconav/SKILL.md) · [processo-gate-commit](../processo-gate-commit/SKILL.md)
