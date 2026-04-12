---
name: processo-evolucao-ia-pipeline
description: Processo para evoluir pipeline de IA no ONCONAV; primeira ronda com squad-ia-dados integral (7 agentes), depois Plataforma/Produto/Qualidade conforme contrato. Use para agente, RAG, prompts ou score.
---

# Processo: evolução do pipeline de IA

## Objetivo

Iterar em **ai-service** e ML/RAG com orquestração explícita.

## Quando aplicar

- Mudança sem nova tela obrigatória: preferir a [squad-ia-dados](../squad-ia-dados/SKILL.md) integral em vez de só um agente.
- Decisão clínica nova: [processo-mudanca-clinica-ia](../processo-mudanca-clinica-ia/SKILL.md) antes se necessário.

## Ronda squad IA/Dados (obrigatória se usar esta skill de processo)

1. Aplicar [squad-ia-dados](../squad-ia-dados/SKILL.md): **acionar os sete** `subagent_type` (avaliação na skill).
2. Depois da ronda, **implementar** mudanças reais seguindo dependências técnicas (ex.: `data-scientist` / `engenheiro-ia-predicao` → `llm-agent-architect` / `llm-context-engineer` → `rag-engineer` → `ai-service`; entregas cruzadas via `ai-ml-engineer` quando fizer sentido).

## Backend / produto

- Contrato HTTP ou Prisma: [squad-plataforma](../squad-plataforma/SKILL.md) integral ou subconjunto conforme impacto.
- Docs de API: [squad-produto](../squad-produto/SKILL.md) ou [agente-documentation](../agente-documentation/SKILL.md).

## Fecho

- [processo-gate-commit](../processo-gate-commit/SKILL.md).
