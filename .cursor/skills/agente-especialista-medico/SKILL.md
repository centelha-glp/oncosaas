---
name: agente-especialista-medico
description: Ativa o subagente especialista-medico (parecer clínico, terminologia, texto médico) no ONCONAV. Use para revisão de conteúdo clínico sem substituir clinical-domain em regras de código.
---

# Agente `especialista-medico`

## Delegar

- **Task** `subagent_type`: `especialista-medico`
- **Definição:** `.cursor/agents/especialista-medico.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/template-especialista.mdc` — quando aplicável
- `.cursor/rules/oncologista.mdc` — contexto oncológico

## Ajuda transversal

- [agente-clinical-domain](../agente-clinical-domain/SKILL.md) — regras e implementação · [agente-onconav](../agente-onconav/SKILL.md)
