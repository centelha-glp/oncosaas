---
name: processo-mudanca-clinica-ia
description: Processo para mudanças clínica + IA no ONCONAV: squads com acionamento integral (clínico → IA/Dados → Plataforma → Qualidade). Use para protocolos, agente, PRO-CTCAE/ESAS ou integração clínica + conversação.
---

# Processo: mudança clínica + IA

## Objetivo

**Coerência clínica** → **pipeline IA** → **backend/UI** → **qualidade**. Cada fase que usar `squad-*` segue [squad-onconav](../squad-onconav/SKILL.md) (todos os membros, uma Task por agente).

## Fases

### 1 — Domínio clínico

- [squad-clinico](../squad-clinico/SKILL.md) integral (quatro agentes).

### 2 — Pipeline de IA

- [squad-ia-dados](../squad-ia-dados/SKILL.md) integral (sete agentes); depois consolidar implementação conforme dependências técnicas.

### 3 — Backend / UI

- [squad-plataforma](../squad-plataforma/SKILL.md) integral se houver API, Prisma ou interface.

### 4 — Qualidade e merge

- [processo-gate-commit](../processo-gate-commit/SKILL.md). Dados clínicos/auth: garantir que `seguranca-compliance` integrou a ronda de qualidade.

## Nota

Mudança **apenas** de copy/protocolo sem código: pode usar só [squad-clinico](../squad-clinico/SKILL.md) (ainda assim integral se a skill squad for aplicada) e não forçar Plataforma.
