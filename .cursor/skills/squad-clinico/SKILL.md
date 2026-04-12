---
name: squad-clinico
description: Squad Clínico ONCONAV — avaliação, orquestração e acionamento obrigatório de clinical-domain, fhir-integration, whatsapp-integration e especialista-medico (uma Task por agente). Use para protocolos, FHIR, WhatsApp ou parecer clínico.
---

# Squad Clínico

Domínio oncológico e integrações de saúde. Alinhado a `.claude/squads.md`.

## Regras a carregar (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/clinical-domain.mdc`
- `.cursor/rules/fhir-integration.mdc`
- `.cursor/rules/whatsapp-integration.mdc`
- `.cursor/rules/navegacao-oncologica.mdc` — se aplicável

## Análise, plano de ação, Tasks, subtasks e to-dos

Seguir o [ciclo de entrega em squad-onconav](../squad-onconav/SKILL.md). **Neste squad:** **4 Tasks** na ordem de acionamento; cada Task com **subtasks** e **to-dos** no prompt; checklist rastreável entre Tasks.

## Avaliação obrigatória (antes das Tasks)

1. O pedido envolve **regras/triagem em código**, **FHIR**, **WhatsApp** ou **texto/parecer**?
2. Há impacto em `ai-service` ou backend? Anotar para `squad-ia-dados` ou `squad-plataforma` em seguida.
3. Preparar contexto clínico mínimo (sem PII desnecessário) para todas as Tasks.

## Acionamento integral do squad (obrigatório)

Acionar **todos** os membros — **uma Task por agente**.

## Ordem de acionamento (obrigatória na 1.ª ronda)

| Passo | subagent_type | Ficheiro | Porquê esta ordem |
|-------|---------------|----------|-------------------|
| **1** | `clinical-domain` | `.cursor/agents/clinical-domain.md` | Regras e protocolos em código primeiro. |
| **2** | `fhir-integration` | `.cursor/agents/fhir-integration.md` | Interoperabilidade depois das regras de domínio. |
| **3** | `whatsapp-integration` | `.cursor/agents/whatsapp-integration.md` | Canais de mensagem a seguir a lógica clínica. |
| **4** | `especialista-medico` | `.cursor/agents/especialista-medico.md` | Parecer textual por último (não bloqueia código). |

**Paralelo:** apenas para **revisão inicial** sem alteração de regras — podem correr **2** e **3** em paralelo **depois** do passo **1** se forem âmbitos desacoplados; **4** costuma ser último.

Se um domínio for fora de âmbito, a Task pede contributo **ou N/A** numa frase. Indicar na Task **passo N/4**.

## Orquestração com outros squads

Após esta ronda: `squad-ia-dados` e/ou `squad-plataforma` conforme impacto → `squad-qualidade`.
