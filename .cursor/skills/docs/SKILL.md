---
name: docs
description: Aciona o agente documentation para gerar/atualizar documentação técnica, ADRs, guias de API e docs CEP/EBSERH
---

# Skill: /docs

## Descrição

Aciona o agente `documentation` para criar e manter documentação técnica do projeto.

## Uso

```
/docs [tipo ou contexto]
```

### Exemplos

- `/docs api /patients` — documenta o endpoint de pacientes em Markdown
- `/docs adr autenticação JWT` — cria ADR sobre a decisão de autenticação
- `/docs runbook deploy` — cria ou atualiza o runbook de deploy em produção
- `/docs modelo ml` — documenta o modelo LightGBM e features
- `/docs pesquisa tcle` — gera ou atualiza o TCLE para o CEP/EBSERH
- `/docs` — revisa quais documentações estão desatualizadas

## O que faz

1. Identifica o tipo de documento necessário (API, ADR, runbook, pesquisa, README)
2. Lê o código/contexto relevante
3. Gera documento no formato correto com cabeçalho padronizado
4. Salva no diretório temático correto dentro de `docs/`
5. Para ADRs: inclui contexto, decisão, justificativa, alternativas e consequências

## Estrutura de diretórios

```
docs/
├── arquitetura/     ← ADRs, diagramas, decisões de design
├── desenvolvimento/ ← guias de API, integrações
├── pesquisa/        ← CEP/EBSERH, TCLE, metodologia
├── producao/        ← runbooks, INFRA.md
└── ia-modelo-priorizacao/ ← modelo LightGBM, features
```

## Referências

- Rules: `.cursor/rules/documentation.mdc`
- Docs existentes: `docs/`
