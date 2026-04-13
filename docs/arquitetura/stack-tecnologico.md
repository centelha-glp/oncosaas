# Stack tecnológico — ONCONAV

> **Status:** Em revisão  
> **Versão:** 2.0  
> **Última atualização:** 2026-04-13  
> **Nota:** Portas, comandos e variáveis de ambiente atualizados estão no [`README.md`](../../README.md) na raiz do repositório.

## Sumário

- [Visão do repositório](#visão-do-repositório)
- [Frontend](#frontend)
- [Backend](#backend)
- [AI Service](#ai-service)
- [Dados e multi-tenant](#dados-e-multi-tenant)
- [Integrações](#integrações)
- [Infraestrutura e operações](#infraestrutura-e-operações)

## Visão do repositório

Monorepo com **três aplicações** que conversam por HTTP/WebSocket:

| Pasta | Tecnologia | Função |
|--------|------------|--------|
| `frontend/` | Next.js (App Router) | Dashboard, chat, navegação oncológica, proxy opcional de `/api/v1` |
| `backend/` | NestJS | API REST `/api/v1`, Prisma, auth JWT em cookie HttpOnly, Socket.io |
| `ai-service/` | FastAPI | Agente conversacional, priorização (LightGBM), RAG (FAISS) |

Portas de desenvolvimento habituais: frontend **3000**, backend **3002**, AI Service **8001** (ver `README.md`).

## Frontend

- **Framework:** Next.js **15** (App Router), React **19**, TypeScript  
- **UI:** Tailwind CSS, componentes Radix/shadcn  
- **Dados no cliente:** TanStack React Query; estado global com Zustand quando necessário  
- **Formulários:** React Hook Form + Zod  
- **Gráficos:** Recharts (onde aplicável)  
- **Autenticação:** **Não** usa NextAuth como fluxo principal. Sessão via **JWT emitido pelo Nest** em cookies **HttpOnly**; com `NEXT_PUBLIC_USE_RELATIVE_API=true` o browser envia cookies na mesma origem. Detalhes em [`README.md`](../../README.md) (secção “Autenticação e sessão”).  
- **Testes:** Vitest; E2E com Playwright  

## Backend

- **Framework:** NestJS **11** (estrutura modular por domínio)  
- **ORM:** Prisma + PostgreSQL  
- **Validação:** `class-validator` / `class-transformer`  
- **Auth:** JWT (access/refresh), guards de tenant e papéis  
- **Tempo real:** Socket.io (alertas, mensagens, etc.)  
- **Cache / filas:** Redis e RabbitMQ conforme `docker-compose` (uso evolutivo por feature)  

## AI Service

- **Runtime:** Python 3.11+  
- **API:** FastAPI, Pydantic v2  
- **Priorização:** LightGBM (artefato joblib), features alinhadas ao contrato de produto  
- **RAG:** FAISS + embeddings (ex.: fastembed), corpus oncológico  
- **LLM:** OpenAI e/ou Anthropic (configurável por ambiente)  

Dependências pinadas em `ai-service/requirements.txt`.

## Dados e multi-tenant

- **SGBD:** PostgreSQL (15+ em ambientes típicos).  
- **Isolamento multi-tenant:** coluna **`tenantId`** em modelos de domínio e **filtro obrigatório** nas queries; não há “um schema PostgreSQL por tenant” no schema atual — ver comentários em `backend/prisma/schema.prisma`.  
- **Migrations:** Prisma Migrate (`backend/prisma/`).  

## Integrações

- **WhatsApp:** canal preparado para WhatsApp Business API / fluxos de mensagem (detalhes em `docs/desenvolvimento/` e módulos do backend).  
- **HL7/FHIR:** documentação de integração em `docs/arquitetura/integracao-hl7-fhir.md` e ficheiros relacionados; evolução por fases.  

## Infraestrutura e operações

- **Local:** Docker Compose (`docker-compose.dev.yml`, `compose.infra.yml`, `compose.app.yml`).  
- **Produção:** alvo típico em nuvem (ex.: AWS) com TLS, segredos geridos e observabilidade — ver [`docs/producao/INFRA.md`](../producao/INFRA.md) e runbooks quando existirem.  
- **CI:** GitHub Actions (pipelines no repositório).  

## Diagrama simplificado

```text
[Browser]
   │ HTTPS
   ▼
[Next.js — frontend :3000]
   │  /api/v1 (proxy opcional)     WebSocket / API direta
   ├──────────────────────────────────────► [NestJS — backend :3002]
   │                                              │
   │                                              ├── PostgreSQL
   │                                              ├── Redis
   │                                              └── RabbitMQ
   └──────────────────────────────────────► [FastAPI — ai-service :8001]
```

## Decisões em vigor

- **Monorepo modular:** um processo Nest por domínio **dentro** do mesmo `backend/`, não dezenas de repositórios separados no MVP.  
- **LLM via API** gerida no AI Service; chaves só no servidor.  
- **Segurança de sessão:** cookies HttpOnly e CORS com credenciais conforme documentação raiz.  

## Referências

- [`README.md`](../../README.md) — stack, env, auth, Docker  
- [`docs/desenvolvimento/setup-e-deploy.md`](../desenvolvimento/setup-e-deploy.md) — setup operacional  
- [`docs/desenvolvimento/resumo-entregas-chats-abr-2026.md`](../desenvolvimento/resumo-entregas-chats-abr-2026.md) — entregas recentes (2026)  
