---
name: squad-produto
description: Squad Produto ONCONAV — avaliação, orquestração e acionamento obrigatório de product-owner, architect, documentation e centelha-es-fase2 (uma Task por agente). Use para backlog, arquitetura, docs ou edital Centelha.
---

# Squad Produto

Visão estratégica, arquitetura e documentação. Alinhado a `.claude/squads.md`.

## Regras a carregar (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/architect.mdc`
- `.cursor/rules/product-owner.mdc`
- `.cursor/rules/documentation.mdc`
- `.cursor/rules/desenvolvimento-modular.mdc`

## Análise, plano de ação, Tasks, subtasks e to-dos

Seguir o [ciclo de entrega em squad-onconav](../squad-onconav/SKILL.md) (análise → plano → Tasks → subtasks → to-dos → execução). **Neste squad:** o plano inclui **4 Tasks** (uma por `subagent_type` na ordem abaixo); em cada **prompt** de Task listar **subtasks** numeradas e **to-dos** verificáveis; o agente principal mantém checklist (`todo_write` ou markdown) até critério de pronto por Task.

## Avaliação obrigatória (antes das Tasks)

1. Resumir o pedido: **backlog**, **contrato/arquitetura**, **documentação**, **edital/Centelha** — o que aplica?
2. Listar **outros squads** necessários depois deste (ex.: `squad-plataforma` para implementar).
3. Preparar **contexto partilhado** (mesmo parágrafo base) a incluir em cada Task para alinhamento.

## Acionamento integral do squad (obrigatório)

Quando esta skill for usada, acionar **todos** os membros — **uma Task por `subagent_type`**.

## Ordem de acionamento (obrigatória na 1.ª ronda)

Disparar **nesta sequência** (esperar o resultado da Task **n** antes da **n+1** quando o pedido exigir decisões em cadeia; se forem só análises independentes, **paralelo permitido** entre os quatro após o passo 1):

| Passo | subagent_type | Ficheiro | Porquê esta ordem |
|-------|---------------|----------|-------------------|
| **1** | `product-owner` | `.cursor/agents/product-owner.md` | Fixar escopo, prioridade e issues antes de arquitetar. |
| **2** | `architect` | `.cursor/agents/architect.md` | Contratos e fronteiras depois do escopo. |
| **3** | `documentation` | `.cursor/agents/documentation.md` | Plano de docs/OpenAPI alinhado ao contrato. |
| **4** | `centelha-es-fase2` | `.cursor/agents/centelha-es-fase2.md` | Edital/Centelha por último na ronda Produto (ou N/A numa frase). |

**Paralelo:** após o passo **1**, se o utilizador pedir só análise rápida sem dependência, podem correr em paralelo os passos **2–4**; caso contrário manter **1 → 2 → 3 → 4**.

Cada Task deve citar o pedido original e indicar **ronda Squad Produto — passo N/4**.

## Orquestração com outros squads

Depois de fechada a ronda Produto (ou em paralelo se independente), encadear `squad-plataforma`, `squad-ia-dados`, etc., conforme [squad-onconav](../squad-onconav/SKILL.md).

## Fluxo típico

`architect` + `product-owner` alinham → implementação noutro squad → `squad-qualidade`.
