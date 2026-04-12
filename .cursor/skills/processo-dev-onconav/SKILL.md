---
name: processo-dev-onconav
description: Índice de processos de desenvolvimento ONCONAV que orquestram skills de squad em sequência. Use quando o usuário pedir fluxo de desenvolvimento, como implementar uma entrega, processo de feature, bugfix, deploy, commit ou checklist de squad.
---

# Processos de desenvolvimento ONCONAV

## Princípio

Cada **processo** abaixo é uma skill à parte: lê o `SKILL.md` correspondente e executa as fases **na ordem**. Quando uma fase referenciar uma **skill de squad**, aplicar [squad-onconav](../squad-onconav/SKILL.md): **avaliação** + **plano de ação** + **Tasks** com **subtasks** e **to-dos** + **acionamento de todos** os membros desse squad (uma Task por agente), salvo instrução explícita do utilizador em contrário. O ciclo detalhado está na secção **«Ciclo de entrega»** de `squad-onconav`.

## Catálogo de processos

| Processo | Pasta | Quando usar |
|----------|--------|-------------|
| Feature end-to-end | `processo-feature-e2e` | Nova funcionalidade com API + UI (e opcionalmente clínico/IA) |
| Mudança clínica + IA | `processo-mudanca-clinica-ia` | Regras/protocolos que afetam agente ou triagem + backend |
| Correção de bug | `processo-correcao-bug` | Diagnosticar e corrigir com escopo mínimo |
| Infra / deploy | `processo-infra-deploy` | Terraform, AWS, CI/CD, ambientes |
| Gate antes do commit | `processo-gate-commit` | Testes, segurança, PR (obrigatório antes de merge) |
| Evolução do agente / RAG | `processo-evolucao-ia-pipeline` | Prompts, RAG, orchestrator, modelo de priorização |

## Referências globais

- Skills **por agente** (ativação individual + ajuda transversal): [agente-onconav](../agente-onconav/SKILL.md)
- Squads: [squad-onconav](../squad-onconav/SKILL.md)
- Fluxos narrados: `.claude/squads.md`
