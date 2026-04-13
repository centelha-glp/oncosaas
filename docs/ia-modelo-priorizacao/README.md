# IA — priorização, agente e modelo ML

> **Última atualização:** 2026-04-13  

Este diretório concentra documentação de **produto** sobre o modelo de priorização. O **código** do pipeline (regras, LightGBM, orchestrator) vive em `ai-service/`; o **NestJS** orquestra chamadas e persistência.

## Ordem sugerida de leitura

| Passo | Recurso | Conteúdo |
|-------|---------|----------|
| 1 | [`../api/contratos-api.md`](../api/contratos-api.md) | Onde está cada API: Nest (`3002`) vs FastAPI (`8001`); OpenAPI em `http://localhost:8001/docs` |
| 2 | [`../../ai-service/README.md`](../../ai-service/README.md) | Variáveis de ambiente, rotas em `src/routes/`, fallback do agente |
| 3 | [`prototipo-priorizacao.md`](prototipo-priorizacao.md) | Objetivo do modelo, features e visão de produto |
| 4 | [`../arquitetura/ia-multiagente-detalhes.md`](../arquitetura/ia-multiagente-detalhes.md) | Arquitetura multi-agente e fluxos |
| 5 | [`../desenvolvimento/plano-agentes-ia.md`](../desenvolvimento/plano-agentes-ia.md) | Plano / roadmap do agente (se aplicável) |

## Código de referência (não duplicar aqui)

| Tema | Local |
|------|--------|
| Orchestrator, regras clínicas, RAG | `ai-service/src/agent/` |
| Priorização ML | `ai-service/src/models/priority_model.py`, `src/routes/` (`/risk`, `/prioritize` conforme rotas ativas) |
| Chamadas backend → AI Service | `backend/src/agent/agent.service.ts` e serviços relacionados |

## Manutenção

- Mudança de contrato HTTP ou novos endpoints públicos → `docs/api/contratos-api.md` + `ai-service/README.md` + OpenAPI em `/docs`.
- Evolução do modelo ou features → atualizar `prototipo-priorizacao.md` ou criar novo `.md` nesta pasta, com referência ao treino em `ai-service/scripts/` quando relevante.
