---
name: squad-plataforma
description: Squad Plataforma ONCONAV — avaliação, orquestração e acionamento obrigatório de backend-nestjs, frontend-nextjs, database-engineer e ux-accessibility (uma Task por agente). Use para entregas em backend, frontend, DB ou UI.
---

# Squad Plataforma

Engenharia core. Alinhado a `.claude/squads.md`.

## Regras a carregar (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/backend-padroes.mdc` e `.cursor/rules/backend.mdc`
- `.cursor/rules/frontend-padroes.mdc` e `.cursor/rules/frontend.mdc`
- `.cursor/rules/database.mdc`
- `.cursor/rules/ux-accessibility.mdc`

## Análise, plano de ação, Tasks, subtasks e to-dos

Seguir o [ciclo de entrega em squad-onconav](../squad-onconav/SKILL.md). **Neste squad:** **4 Tasks** na ordem de acionamento; cada Task com **subtasks** (ficheiros, migrations, API, UI) e **to-dos**; atualizar checklist ao fechar cada agente.

## Avaliação obrigatória (antes das Tasks)

1. Partir o pedido em **API/backend**, **UI**, **schema/queries**, **a11y/UX**.
2. Há **migrations** ou só código? Isso informa prioridade relativa entre `database-engineer` e outros.
3. Se contrato cross-layer for ambíguo, considerar `squad-produto` (`architect`) antes ou em paralelo.

## Acionamento integral do squad (obrigatório)

Acionar **todos** os membros — **uma Task por agente**.

## Ordem de acionamento (obrigatória na 1.ª ronda)

| Passo | subagent_type | Ficheiro | Porquê esta ordem |
|-------|---------------|----------|-------------------|
| **1** | `database-engineer` | `.cursor/agents/database-engineer.md` | Schema, migrations e índices antes de código que dependa do modelo de dados. |
| **2** | `backend-nestjs` | `.cursor/agents/backend-nestjs.md` | API e Prisma alinhados ao schema. |
| **3** | `frontend-nextjs` | `.cursor/agents/frontend-nextjs.md` | UI e cliente HTTP depois do contrato de API estável. |
| **4** | `ux-accessibility` | `.cursor/agents/ux-accessibility.md` | Revisão WCAG/fluxo sobre ecrãs já definidos. |

**Exceção — sem mudança de schema:** se o pedido **não** tocar em Prisma/migrations, o passo **1** é uma Task curta com **N/A**; mantém-se a ordem **2 → 3 → 4**.

**Paralelo:** **2** e **3** só em paralelo se **não** partilharem o mesmo contrato em edição; caso contrário **2** antes de **3**. **4** é normalmente depois de **3**.

Indicar na Task **passo N/4**.

## Atalhos

- `.cursor/skills/novo-modulo-backend/SKILL.md`
- `.cursor/skills/migrar-prisma/SKILL.md`

## Orquestração

Após implementação: `squad-qualidade`. Contrato novo: `squad-produto` primeiro.
