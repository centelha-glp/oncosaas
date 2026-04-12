---
name: squad-infra-cloud
description: Squad Infra/Cloud ONCONAV — avaliação, orquestração e acionamento obrigatório de devops, aws e terraform (uma Task por agente). Use para Docker, CI/CD, AWS ou IaC.
---

# Squad Infra/Cloud

Infraestrutura e cloud. Alinhado a `.claude/squads.md`.

## Regras a carregar (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/devops.mdc`
- `.cursor/rules/aws.mdc`
- `.cursor/rules/terraform.mdc`

## Análise, plano de ação, Tasks, subtasks e to-dos

Seguir o [ciclo de entrega em squad-onconav](../squad-onconav/SKILL.md). **Neste squad:** **3 Tasks** (`terraform` → `aws` → `devops`); cada Task com **subtasks** (recursos, IAM, CI) e **to-dos** até validação.

## Avaliação obrigatória (antes das Tasks)

1. O pedido é **pipeline/CI**, **serviço AWS**, **Terraform/state**, ou misto?
2. Alterações na app (env, health) exigem coordenação com `squad-plataforma` depois?
3. Secrets e IAM: marcar revisão com `squad-qualidade` (`seguranca-compliance`) após mudanças.

## Acionamento integral do squad (obrigatório)

Acionar **todos** os três — **uma Task por agente**.

## Ordem de acionamento (obrigatória na 1.ª ronda)

IaC e recursos cloud antes de encaixar pipeline de aplicação:

| Passo | subagent_type | Ficheiro | Porquê esta ordem |
|-------|---------------|----------|-------------------|
| **1** | `terraform` | `.cursor/agents/terraform.md` | Módulos, state e recurso como código primeiro. |
| **2** | `aws` | `.cursor/agents/aws.md` | Serviços, IAM, rede e observabilidade alinhados ao que o .tf define ou vai definir. |
| **3** | `devops` | `.cursor/agents/devops.md` | Docker, GitHub Actions e env **depois** do desenho de infra estável. |

**Paralelo:** **1** e **2** podem correr em paralelo **só** em fase de **planeamento**; **3** (`devops`) deve ser **depois** quando o CI depender dos recursos/IaC acordados.

Indicar na Task **passo N/3**.

## Nota

Otimização de **código** (bundle, N+1): `squad-qualidade` (`performance`), não confundir com cloud.

## Orquestração

Após infra sensível: `squad-qualidade`.
