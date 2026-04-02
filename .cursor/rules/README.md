# Regras do Cursor — ONCONAV

Este diretório contém **regras de projeto** (`.mdc`) usadas pelo Cursor para orientar código, domínio clínico e agentes. O índice geral do repositório está em `AGENTS.md` na raiz.

## Como o Cursor aplica

- Arquivos **`.mdc`** aqui entram como **Project Rules** conforme o frontmatter YAML (`alwaysApply`, `globs`, `description`).
- Arquivos **`.md`** nesta pasta (`guardrail-*.md`, `atualizar-resumos.md`, `GUARDRAILS-RESUMO.md`) são **documentação de apoio**: use `@arquivo` no chat se precisar do conteúdo; não substituem regras `.mdc`.

## Grupos de regras

| Grupo | Exemplos | Uso típico |
|-------|----------|------------|
| Stack e padrões | `backend-padroes`, `frontend-padroes`, `desenvolvimento-modular` | NestJS, Next.js, modularidade |
| Módulos técnicos | `backend`, `frontend`, `ai-service`, `database`, `security`, `devops`, `performance`, `terraform`, `aws` | Por área ao editar paths cobertos por `globs` |
| Domínio oncológico / clínico | `clinical-domain`, `navegacao-oncologica`, `oncologista`, `fhir-integration` | Lógica de navegação, FHIR, oncologia |
| Especialidades (sempre aplicadas) | `medicina-familia`, `clinica-medica`, `clinica-cirurgica`, `emergencista`, `pronto-socorro`, `intensivista`, `equipe-saas-healthtech` | Contexto clínico amplo em qualquer chat |
| IA / LLM / RAG | `llm-agent-architect`, `llm-context-engineer`, `rag-engineer`, `engenheiro-ia-agentes`, `engenheiro-ia-predicao` | Orchestrator, prompts, RAG, ML |
| Fluxo de agentes / qualidade | `github-organizer`, `test-generator`, `code-simplifier`, `product-owner`, `ux-accessibility`, `whatsapp-integration`, `documentation` | PRs, testes, a11y, WhatsApp, docs |
| Sob demanda | `template-especialista`, `captacao-fapes` | Criar novas regras de especialidade; editais FAPES ES |

## Inventário `.mdc` (atual)

`ai-service`, `architect`, `aws`, `backend-padroes`, `backend`, `captacao-fapes`, `clinica-cirurgica`, `clinica-medica`, `clinical-domain`, `code-simplifier`, `database`, `desenvolvimento-modular`, `devops`, `documentation`, `emergencista`, `engenheiro-ia-agentes`, `engenheiro-ia-predicao`, `equipe-saas-healthtech`, `fhir-integration`, `frontend-padroes`, `frontend`, `github-organizer`, `intensivista`, `llm-agent-architect`, `llm-context-engineer`, `medicina-familia`, `navegacao-oncologica`, `oncologista`, `performance`, `product-owner`, `pronto-socorro`, `rag-engineer`, `security`, `template-especialista`, `terraform`, `test-generator`, `ux-accessibility`, `whatsapp-integration`.

## Frontmatter (referência rápida)

```yaml
---
description: "Uma linha clara do que a regra cobre"
alwaysApply: false
globs:
  - "backend/**/*.ts"
  - "prisma/**/*.prisma"
---
```

- Padrões que começam com `**` em YAML devem ficar **entre aspas** (evita erro de parse).
- Prefira **lista** para `globs` quando houver mais de um padrão.

## Manutenção

1. Editar ou criar apenas arquivos `.mdc` para novas regras automáticas.
2. Rodar validação local (ex.: `python3` + `yaml.safe_load` no primeiro bloco `---` … `---`) após mudanças em massa no frontmatter.
3. Manter `description` preenchida em todo `.mdc`.

**Projeto:** ONCONAV — plataforma SaaS multi-tenant de navegação oncológica.
