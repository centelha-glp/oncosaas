---
name: agente-llm-context-engineer
description: Ativa o subagente llm-context-engineer (prompts, context_builder, janela de contexto, prompt caching) no ONCONAV. Use para otimizar custo/qualidade sem redesenhar orchestrator completo.
---

# Agente `llm-context-engineer`

## Delegar

- **Task** `subagent_type`: `llm-context-engineer`
- **Definição:** `.cursor/agents/llm-context-engineer.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/llm-context-engineer.mdc`

## Skill legada

- [prompt](../prompt/SKILL.md)

## Ajuda transversal

- [agente-llm-agent-architect](../agente-llm-agent-architect/SKILL.md) — se o fluxo multi-step mudar · [agente-onconav](../agente-onconav/SKILL.md)
