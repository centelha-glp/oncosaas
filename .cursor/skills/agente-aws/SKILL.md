---
name: agente-aws
description: Ativa o subagente aws (ECS, RDS, ElastiCache, VPC, IAM, CloudWatch) no ONCONAV. Use para recursos AWS ou quando o usuário pedir cloud AWS.
disable-model-invocation: false
---

# Agente `aws`

## Delegar

- **Task** `subagent_type`: `aws`
- **Definição:** `.cursor/agents/aws.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/aws.mdc`

## Ajuda transversal

- [agente-onconav](../agente-onconav/SKILL.md) · [agente-terraform](../agente-terraform/SKILL.md) · [agente-devops](../agente-devops/SKILL.md)
