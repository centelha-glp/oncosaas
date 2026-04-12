---
name: processo-feature-e2e
description: Processo de nova feature end-to-end no ONCONAV usando squads em ordem; cada fase que usar skill squad aplica acionamento integral (avaliação + todos os agentes). Use para entrega completa ou full-stack guiado.
---

# Processo: feature end-to-end

## Objetivo

Entregar com **fronteiras claras**, **contrato estável** e **qualidade** antes do merge. Sempre que uma fase referenciar uma **skill `squad-*`**, aplicar [squad-onconav](../squad-onconav/SKILL.md) (todos os membros daquele squad, uma Task por agente).

## Fases (sequenciais entre squads)

### 1 — Alinhar escopo e contrato

- Skill: [squad-produto](../squad-produto/SKILL.md) — ronda integral: `product-owner`, `architect`, `documentation`, `centelha-es-fase2` (com N/A no edital se não aplicar).
- Saída esperada: rotas/DTOs acordados, impacto multi-tenant, dependências entre `backend/`, `frontend/`, `ai-service/` se existir.

### 2 — Implementar por camada

- Skill: [squad-plataforma](../squad-plataforma/SKILL.md) — ronda integral dos quatro agentes; depois consolidar alterações conforme dependências de ficheiros.

### 2b — Ramo opcional (clínico e/ou IA)

- [squad-clinico](../squad-clinico/SKILL.md) integral se domínio clínico.
- [squad-ia-dados](../squad-ia-dados/SKILL.md) integral se pipeline/score/RAG.

### 3 — Documentar se expuser API ou integração

- Se já coberto na ronda Produto, validar; senão nova referência a [squad-produto](../squad-produto/SKILL.md) ou só [agente-documentation](../agente-documentation/SKILL.md).

### 4 — Fechar com qualidade

- [processo-gate-commit](../processo-gate-commit/SKILL.md) ou [squad-qualidade](../squad-qualidade/SKILL.md) integral.

## O que não fazer

- Não fundir dois `subagent_type` na mesma Task.
- Não saltar `squad-qualidade` antes de merge quando houver alteração de código.
