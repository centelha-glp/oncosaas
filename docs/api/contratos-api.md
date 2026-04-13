# Contratos de API — mapa dos serviços

> **Status:** Em revisão  
> **Última atualização:** 2026-04-13  

Este documento é a **fonte canônica** para saber *qual serviço expõe qual API* e *onde encontrar documentação interativa* (OpenAPI). Evita confundir a API do **produto** (NestJS) com a do **AI Service** (FastAPI).

## Resumo rápido

| Serviço | Base URL típica (dev) | Contrato / descoberta |
|---------|------------------------|------------------------|
| **Backend (NestJS)** — app, auth, pacientes, proxy para o agente | `http://localhost:3002/api/v1` | Markdown em `docs/desenvolvimento/` (não há Swagger UI no Nest neste repositório) |
| **AI Service (FastAPI)** — agente, priorização, `/risk/predict` | `http://localhost:8001/api/v1` | OpenAPI automático: **`http://localhost:8001/docs`** (Swagger UI) e `/openapi.json` |

O **frontend** (Next.js) usa normalmente o mesmo host com proxy de `/api/v1` para o Nest; o browser não chama o AI Service diretamente nas rotas do dashboard — o **backend** orquestra chamadas ao AI Service quando necessário.

## Onde está o “Swagger”?

- **`http://localhost:8001/docs`** → documentação **FastAPI** (AI Service): rotas como `POST /api/v1/agent/process`, priorização, etc.
- **Não** confundir com a API REST do **dashboard** (login, pacientes, alertas, …), que vive no Nest em **`/api/v1`** na porta **3002**.

Para testar endpoints do Nest com exemplos, use [`../desenvolvimento/testar-endpoints.md`](../desenvolvimento/testar-endpoints.md).

## Endpoints críticos do backend (Nest) — visão por domínio

Prefixo global: **`/api/v1`**. Autenticação típica: JWT (cookie HttpOnly ou `Authorization`) + `X-Tenant-Id` onde aplicável.

| Domínio | Prefixo de rota (após `/api/v1`) | Notas |
|---------|-----------------------------------|--------|
| Autenticação / utilizadores | `auth`, `users` | Login, registro, papéis |
| Pacientes e jornada | `patients`, `oncology-navigation`, `treatments`, `observations`, … | Dados clínicos por `patientId` |
| Mensagens e canais | `messages`, `channel-gateway`, `whatsapp-connections` | Conversas e integrações |
| Agente (orquestração no Nest) | `agent` | O Nest chama o AI Service; o cliente usa o backend |
| Alertas e dashboard | `alerts`, `dashboard` | |
| Auditoria / ML | `audit-logs`, `disposition-feedback` | Papéis restritos (ex.: ADMIN) |
| FHIR (integração) | `fhir`, `fhir/config` | Índice e ordem de leitura: [`../fhir/README.md`](../fhir/README.md) |

Lista detalhada com URLs de exemplo: [`../desenvolvimento/testar-endpoints.md`](../desenvolvimento/testar-endpoints.md).

## AI Service (FastAPI) — prefixo

Todas as rotas expostas pelo router principal usam **`/api/v1`** (ver `ai-service/src/routes/`). A documentação exata de cada operação está em **`http://localhost:8001/docs`**.

## Manutenção

- Alterou-se uma rota pública do Nest → atualizar `docs/desenvolvimento/testar-endpoints.md` (e este arquivo se mudar o mapa conceitual).
- Alterou-se rotas do FastAPI → o OpenAPI em `/docs` atualiza-se com o código; validar exemplos em testes ou guias se existirem.
