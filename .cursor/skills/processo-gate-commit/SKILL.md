---
name: processo-gate-commit
description: Gate obrigatório antes de commit/merge no ONCONAV: testes, segurança, PR. Orquestra squad-qualidade na ordem sugerida. Use antes de commit, ao pedir PR ready, revisão de segurança pré-merge ou checklist de entrega.
---

# Processo: gate de commit / merge

## Objetivo

Saída **testada**, **alinhada a LGPD/multi-tenant** e **PR organizada**.

## Ordem de squads

1. Skill: [squad-qualidade](../squad-qualidade/SKILL.md) — aplicar **acionamento integral** dos quatro membros (ver skill; ordem recomendada na própria `squad-qualidade`).

## Ordem de agentes (uma Task cada)

1. `test-generator` — cobrir alterações; executar testes relevantes.
2. `seguranca-compliance` — rotas novas, PII, `tenantId`, audit.
3. `performance` — apenas se a mudança puder impactar bundle, queries quentes ou Redis.
4. `github-organizer` — commits atómicos e PR (último passo).

## Regra

Não chamar `github-organizer` antes de `test-generator` e `seguranca-compliance` para código que toca domínio sensível.

## Atalho no repositório

- Skill de testes: [gerar-testes](../gerar-testes/SKILL.md) (complementa o passo 1).
