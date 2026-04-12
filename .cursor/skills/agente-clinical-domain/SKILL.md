---
name: agente-clinical-domain
description: Ativa o subagente clinical-domain (protocolos, regras de triagem, lógica clínica oncológica no código) no ONCONAV. Use quando o usuário pedir validação clínica de regras ou domínio oncológico em implementação.
---

# Agente `clinical-domain`

## Delegar

- **Task** `subagent_type`: `clinical-domain`
- **Definição:** `.cursor/agents/clinical-domain.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/clinical-domain.mdc`
- `.cursor/rules/navegacao-oncologica.mdc`

## Skill legada

- [validar-clinico](../validar-clinico/SKILL.md)

## Ajuda transversal

- [agente-onconav](../agente-onconav/SKILL.md)
