---
name: arquitetura
description: Aciona o agente architect para decisões cross-layer, revisão de design e análise de dependências
---

# Skill: /arquitetura

## Descrição

Aciona o agente `architect` para decisões arquiteturais que afetam múltiplas camadas da aplicação (frontend + backend + ai-service).

## Uso

```
/arquitetura [contexto ou pergunta]
```

### Exemplos

- `/arquitetura` — revisa o estado atual da arquitetura e sugere melhorias
- `/arquitetura como adicionar um novo serviço de notificações?` — design de novo componente
- `/arquitetura revisar dependências entre módulos de navegação e pacientes` — análise de dependências
- `/arquitetura refatorar o fluxo de ações do ai-service` — proposta de refatoração cross-layer
- `/arquitetura decidir: comunicação síncrona vs assíncrona para o novo fluxo X` — trade-off analysis

## O que faz

1. Lê os arquivos relevantes da camada afetada
2. Mapeia dependências entre módulos/serviços
3. Avalia trade-offs (acoplamento, performance, manutenibilidade, segurança)
4. Propõe design com justificativa (ADR quando relevante)
5. Identifica invariantes que não podem ser violados (ex: clinical_rules sempre antes do LLM)
6. Gera plano de implementação por squad

## Quando usar obrigatoriamente

- Adicionar novo serviço ou processo externo
- Alterar a interface entre backend e ai-service
- Modificar o mecanismo de multi-tenancy
- Adicionar dependência com impacto cross-layer
- Refatoração que afeta 3+ módulos simultaneamente
- Decisão sobre comunicação síncrona vs assíncrona

## Referências

- Rules: `.cursor/rules/architect.mdc`
- AppModule: `backend/src/app.module.ts`
- Squads: `.claude/squads.md`
- Arquitetura: `.claude/agent-architecture.md`
