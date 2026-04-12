---
name: agente-database-engineer
description: Ativa o subagente database-engineer (Prisma, schema, migrations, índices, performance SQL) no ONCONAV. Use para modelagem, query plans ou quando o usuário pedir otimização de banco.
---

# Agente `database-engineer`

## Delegar

- **Task** `subagent_type`: `database-engineer`
- **Definição:** `.cursor/agents/database-engineer.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/database.mdc`
- `.cursor/rules/backend-padroes.mdc` (queries com tenant)

## Skill legada

- [db](../db/SKILL.md) · [migrar-prisma](../migrar-prisma/SKILL.md)

## Ajuda transversal

- [agente-onconav](../agente-onconav/SKILL.md)
