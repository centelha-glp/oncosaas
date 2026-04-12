---
name: processo-infra-deploy
description: Processo de infra e deploy no ONCONAV: squad infra integral, depois Plataforma/Qualidade conforme impacto. Use para Terraform, AWS, Docker, CI/CD ou ambientes.
---

# Processo: infra e deploy

## Objetivo

IaC e CI alinhados, sem expor segredos. Skills `squad-*` com acionamento integral: [squad-onconav](../squad-onconav/SKILL.md).

## Fases

### 1 — Desenho e provisionamento

- [squad-infra-cloud](../squad-infra-cloud/SKILL.md) integral: `devops`, `aws`, `terraform` (uma Task por agente; ordem lógica na própria skill).

### 2 — App em runtime (se necessário)

- Nova config consumida pelo Nest/Next: [squad-plataforma](../squad-plataforma/SKILL.md) integral ou agentes afetados.

### 3 — Validação

- [squad-qualidade](../squad-qualidade/SKILL.md) integral antes de merge de infra sensível.
- [processo-gate-commit](../processo-gate-commit/SKILL.md).

## Lembrete

Otimização de **código** (bundle, N+1): `squad-qualidade`, não confundir com cloud.
