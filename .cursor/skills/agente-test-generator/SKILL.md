---
name: agente-test-generator
description: Ativa o subagente test-generator (testes unitários e E2E alinhados às mudanças) no ONCONAV. Use antes de commit ou quando o usuário pedir cobertura de testes.
---

# Agente `test-generator`

## Delegar

- **Task** `subagent_type`: `test-generator`
- **Definição:** `.cursor/agents/test-generator.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/test-generator.mdc`

## Skill legada

- [gerar-testes](../gerar-testes/SKILL.md)

## Ajuda transversal

- [agente-onconav](../agente-onconav/SKILL.md) · [processo-gate-commit](../processo-gate-commit/SKILL.md)
