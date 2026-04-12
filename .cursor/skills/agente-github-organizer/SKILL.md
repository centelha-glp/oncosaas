---
name: agente-github-organizer
description: Ativa o subagente github-organizer (commits atómicos, PRs estruturadas) no ONCONAV. Use após testes e segurança ou quando o usuário pedir organização de PR/commit.
---

# Agente `github-organizer`

## Delegar

- **Task** `subagent_type`: `github-organizer`
- **Definição:** `.cursor/agents/github-organizer.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/github-organizer.mdc`

## Antes de commit / PR (obrigatório)

Seguir o **passo 0** em `.cursor/agents/github-organizer.md`:

1. `git fetch origin` e branch atual.
2. Não commitar em `main` — criar branch a partir de `origin/main`.
3. `gh pr list --head <branch> --state merged` — se houver PR mergeado com este nome, criar **nova** branch de `origin/main` para trabalho novo.
4. Se a branch não for ideal (nome, base poluída, escopo errado), nova branch de `origin/main`.

## Ajuda transversal

- [processo-gate-commit](../processo-gate-commit/SKILL.md) · [agente-onconav](../agente-onconav/SKILL.md)
