---
name: agente-terraform
description: Ativa o subagente terraform (IaC, módulos, state, provisionamento) no ONCONAV. Use para .tf, workspaces ou drift de infra.
---

# Agente `terraform`

## Delegar

- **Task** `subagent_type`: `terraform`
- **Definição:** `.cursor/agents/terraform.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/terraform.mdc`

## Skill legada

- [infra](../infra/SKILL.md) — também cobre `aws`

## Ajuda transversal

- [agente-aws](../agente-aws/SKILL.md) · [agente-devops](../agente-devops/SKILL.md) · [agente-onconav](../agente-onconav/SKILL.md)
