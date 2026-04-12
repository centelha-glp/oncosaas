---
name: processo-correcao-bug
description: Processo de correção de bug no ONCONAV: classificar origem, usar squad (acionamento integral) ou um único agente, fechar com Qualidade. Use para hotfix, regressão ou erro em produção.
---

# Processo: correção de bug

## Objetivo

Corrigir com **blast radius** controlado. **Uma** Task por `subagent_type`.

## Escolha: squad integral vs agente único

- **Skill de squad** (`squad-*`): seguir [squad-onconav](../squad-onconav/SKILL.md) — **todos** os membros desse squad recebem Task (ronda de análise/correção no seu domínio).
- **Hotfix mínimo** (utilizador ou contexto pede só uma camada): usar apenas a skill [agente-onconav](../agente-onconav/SKILL.md) do agente correspondente, **sem** ronda completa do squad.

## Passo 0 — Classificar a origem

| Sintoma provável | Squad |
|------------------|--------|
| Erro HTTP, Prisma, guard, tenant; UI; DB | [squad-plataforma](../squad-plataforma/SKILL.md) |
| Resposta do agente, LLM, Python, RAG, score | [squad-ia-dados](../squad-ia-dados/SKILL.md) |
| Regra clínica / FHIR / WhatsApp / texto | [squad-clinico](../squad-clinico/SKILL.md) |
| CI, deploy, container, AWS, Terraform | [squad-infra-cloud](../squad-infra-cloud/SKILL.md) |

## Passo 1 — Corrigir

- Com **squad**: avaliar e acionar **todos** os membros (ver skill do squad).
- Com **agente único**: uma Task para o `subagent_type` escolhido.
- Dívida estrutural: [squad-produto](../squad-produto/SKILL.md) (ronda integral) ou só [agente-architect](../agente-architect/SKILL.md).

## Passo 2 — Regressão

- Preferir [squad-qualidade](../squad-qualidade/SKILL.md) integral antes de merge; ou pelo menos [agente-test-generator](../agente-test-generator/SKILL.md).

## Passo 3 — Merge

- [processo-gate-commit](../processo-gate-commit/SKILL.md).
