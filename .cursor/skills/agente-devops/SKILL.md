---
name: agente-devops
description: Ativa o subagente devops (Docker, GitHub Actions, CI/CD, health checks, ambientes) no ONCONAV. Use para pipelines, compose ou configuração de deploy de aplicação.
---

# Agente `devops`

## Delegar

- **Task** `subagent_type`: `devops`
- **Definição:** `.cursor/agents/devops.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/devops.mdc`

## Skill legada

- [deploy](../deploy/SKILL.md)

## Ajuda transversal

- [agente-aws](../agente-aws/SKILL.md) · [agente-terraform](../agente-terraform/SKILL.md) · [agente-onconav](../agente-onconav/SKILL.md)
