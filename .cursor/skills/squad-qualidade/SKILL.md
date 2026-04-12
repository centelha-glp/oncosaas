---
name: squad-qualidade
description: Squad Qualidade ONCONAV — avaliação, orquestração e acionamento obrigatório de test-generator, seguranca-compliance, performance e github-organizer (uma Task por agente). Use antes de merge, auditoria ou PR.
---

# Squad Qualidade

Qualidade, segurança e entrega.

## Regras a carregar (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/security.mdc`
- `.cursor/rules/test-generator.mdc`
- `.cursor/rules/performance.mdc`
- `.cursor/rules/github-organizer.mdc`

## Análise, plano de ação, Tasks, subtasks e to-dos

Seguir o [ciclo de entrega em squad-onconav](../squad-onconav/SKILL.md). **Neste squad:** **4 Tasks** em sequência estrita (`test-generator` → `seguranca-compliance` → `performance` → `github-organizer`); cada Task com **subtasks** e **to-dos**; o último passo só após os anteriores fechados.

## Avaliação obrigatória (antes das Tasks)

1. Tipo de alteração: **código novo**, **PII**, **rotas**, **bundle/perf**, **PR**?
2. Gate de merge: testes e segurança devem preceder **organização de PR** quando houver risco.

## Acionamento integral do squad (obrigatório)

Acionar **todos** os quatro — **uma Task por agente**.

## Ordem de acionamento (obrigatória — gate de merge)

**Sempre sequencial** nesta ordem para PR/merge (não paralelizar estes quatro no mesmo gate):

| Passo | subagent_type | Ficheiro | Porquê esta ordem |
|-------|---------------|----------|-------------------|
| **1** | `test-generator` | `.cursor/agents/test-generator.md` | Falhas de teste antes de auditar segurança e PR. |
| **2** | `seguranca-compliance` | `.cursor/agents/seguranca-compliance.md` | LGPD, tenant e superfície de ataque sobre código já testado. |
| **3** | `performance` | `.cursor/agents/performance.md` | Bundle, queries, Redis — depois de estabilidade funcional e segurança; senão N/A breve. |
| **4** | `github-organizer` | `.cursor/agents/github-organizer.md` | Commits e PR **por último**, quando o código já passou testes e revisão de risco. |

Para **auditoria parcial** (sem merge imediato), manter a **mesma ordem**; no passo **4** pode ser só sugestão de estrutura de PR.

Indicar na Task **passo N/4**.

**Paralelo:** **não** aplicar entre estes quatro no gate; paralelo só entre **outros** squads noutras fases da entrega.

## Skills relacionadas

- `.cursor/skills/gerar-testes/SKILL.md`
