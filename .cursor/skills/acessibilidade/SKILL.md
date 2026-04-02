---
name: acessibilidade
description: Aciona o agente ux-accessibility para revisão WCAG 2.1 AA, UX para profissionais de saúde e acessibilidade de componentes
---

# Skill: /acessibilidade

## Descrição

Aciona o agente `ux-accessibility` para revisar e melhorar acessibilidade (WCAG 2.1 AA) e UX de componentes e páginas, com foco no contexto hospitalar de alta carga cognitiva.

## Uso

```
/acessibilidade [componente ou página]
```

### Exemplos

- `/acessibilidade PatientCard` — revisão de contraste, foco e ARIA
- `/acessibilidade dashboard de enfermagem` — UX para profissionais sob pressão
- `/acessibilidade formulário de sintomas` — labels, erros, navegação por teclado
- `/acessibilidade` — revisão geral dos componentes modificados

## O que faz

1. Lê os componentes relevantes em `frontend/src/components/`
2. Verifica conformidade WCAG 2.1 AA:
   - Contraste ≥ 4.5:1 (texto normal), ≥ 3:1 (texto grande)
   - Foco visível (`focus-visible:ring-2`)
   - Labels em formulários (`htmlFor`)
   - Alt text em imagens
   - Atributos ARIA completos por role
3. Avalia UX para ambiente hospitalar (alertas ER_IMMEDIATE visíveis, feedback de loading/erro)
4. Propõe correções pontuais

## Critérios de UX hospitalar

- Pacientes críticos sempre visíveis no topo com destaque persistente
- Alertas `ER_IMMEDIATE` nunca apenas ícone — badge + cor diferenciada
- Todo processo assíncrono tem 3 estados: loading (Skeleton), error (Alert), success (data)
- Confirmação obrigatória antes de ações irreversíveis (encerrar protocolo, etc.)

## Referências

- Rules: `.cursor/rules/ux-accessibility.mdc`
- Componentes: `frontend/src/components/`
- Design tokens: `frontend/tailwind.config.ts` (tokens `priority.*`)
