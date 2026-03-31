# ONCONAV - Claude Code Guide

## Project Overview

ONCONAV is a multi-tenant SaaS oncology navigation platform with:

- AI conversational agent via WhatsApp Business API
- Intelligent case prioritization (XGBoost/LightGBM)
- Real-time alerts and nursing dashboard
- FHIR/HL7 integration

## Architecture

```
OncoSaas/
├── frontend/     # Next.js 14 + TypeScript (port 3000)
├── backend/      # NestJS + TypeScript + Prisma (port 3002)
├── ai-service/   # Python FastAPI + ML models (port 8001)
└── docker-compose.yml  # PostgreSQL, Redis, RabbitMQ
```

## Development Commands

```bash
# Install all dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd ai-service && pip install -r requirements.txt && cd ..

# Start all services (frontend + backend + ai-service)
npm run dev

# Start individual services
npm run frontend:dev     # Next.js on :3000
npm run backend:dev      # NestJS on :3002
npm run ai:dev           # FastAPI on :8001

# Database
npm run docker:up        # Start PostgreSQL, Redis, RabbitMQ
npm run db:migrate       # Run Prisma migrations
cd backend && npx prisma db seed && cd ..  # Seed test data
```

## Linting & Formatting

```bash
# Lint
npm run lint             # Both frontend + backend
cd frontend && npm run lint     # Frontend only (Next.js ESLint)
cd backend && npm run lint      # Backend only (ESLint --fix)

# Format
npm run format           # Prettier on all *.ts, *.tsx, *.json, *.md
npm run format:check     # Check without modifying

# Type check
cd frontend && npm run type-check
cd backend && npm run type-check
```

## Tests

```bash
# Backend tests (Jest)
cd backend && npm test
cd backend && npm run test:cov    # With coverage
cd backend && npm run test:e2e    # E2E tests

# Frontend tests
cd frontend && npm test
```

## Service URLs (Development)

| Service     | URL                          |
| ----------- | ---------------------------- |
| Frontend    | http://localhost:3000        |
| Backend API | http://localhost:3002/api/v1 |
| AI Service  | http://localhost:8001        |
| Swagger     | http://localhost:8001/docs   |
| PostgreSQL  | localhost:5432               |
| Redis       | localhost:6379               |
| RabbitMQ    | localhost:5672 / 15672       |

## Test Credentials (after seeding)

| Role        | Email                         | Password |
| ----------- | ----------------------------- | -------- |
| ADMIN       | admin@hospitalteste.com       | senha123 |
| ONCOLOGIST  | oncologista@hospitalteste.com | senha123 |
| NURSE       | enfermeira@hospitalteste.com  | senha123 |
| COORDINATOR | coordenador@hospitalteste.com | senha123 |

## Key Directories

### Backend (`backend/src/`)

- `auth/` - JWT authentication, multi-tenant login
- `patients/` - Patient CRUD with tenant isolation
- `oncology-navigation/` - Navigation steps engine (colorectal, etc.)
- `alerts/` - Automatic delay/pending-step alerts
- `dashboard/` - Aggregated nurse dashboard
- `gateways/` - WebSocket (Socket.io) for real-time alerts
- `whatsapp-connections/` - WhatsApp Business API integration
- `integrations/fhir/` - HL7/FHIR interoperability
- `common/` - Guards, filters, interceptors, decorators

### Frontend (`frontend/src/`)

- `app/` - Next.js 14 App Router pages
- `components/` - Reusable UI components (Radix UI + Tailwind)
- `hooks/` - React Query hooks for data fetching
- `lib/` - API clients, utilities
- `stores/` - Zustand state management

### AI Service (`ai-service/`)

- FastAPI app with prioritization models (XGBoost/LightGBM)
- WhatsApp agent message processing
- RAG pipeline (sentence-transformers)
- Falls back to mocked responses if no API keys set

## Environment Variables

Copy and configure:

```bash
cp .env.example .env
cp .env.example backend/.env
cp .env.example frontend/.env
```

Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Must be set in production
- `ENCRYPTION_KEY` - Must be set in production (throws error otherwise)
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` - Optional (AI mocked if absent)
- `WHATSAPP_*` - WhatsApp Business API credentials

## Git Hooks (Husky)

```bash
npm run prepare   # Install Husky git hooks (pre-commit, pre-push)
```

Pre-commit runs lint-staged: ESLint + Prettier on changed files.

## Multi-Tenant Architecture

Every backend query must include `tenantId` to enforce data isolation. Controllers extract `tenantId` from the JWT token via the `@CurrentUser()` decorator. Never omit tenant scoping in new queries.

## Code Standards

- Backend: NestJS modules, DTOs with class-validator, `ParseUUIDPipe` on all `:id` params
- Frontend: React Query for server state, Zustand for client state, Zod for validation
- Logging: Use NestJS `Logger` — never `console.log` in backend services
- Rate limiting: 100 req/min general, 10 req/min for auth endpoints
- No `console.log` in production frontend code

## Agent Workflow

### Ordem obrigatória pré-commit (sempre)
```
código alterado → test-generator → seguranca-compliance (se backend) → github-organizer
```

| Situação | Agent | Quando acionar |
|---|---|---|
| Qualquer código novo ou modificado | `test-generator` | **Sempre** — antes de `seguranca-compliance` e `github-organizer` |
| Criar/modificar endpoint, service, DTO ou guard no backend | `seguranca-compliance` | **Sempre** — após `test-generator`, antes do commit |
| Qualquer commit | `github-organizer` | **Sempre** — nunca commitar diretamente |

### Squads (19 agentes em 6 squads)

Ver `.claude/squads.md` para referência completa.

| Squad | Agentes | Área |
|---|---|---|
| **Produto** | `product-owner`, `architect`, `documentation` | Visão, arquitetura, docs |
| **Clínico** | `clinical-domain`, `fhir-integration`, `whatsapp-integration` | Domínio oncológico, integrações de saúde |
| **Plataforma** | `backend-nestjs`, `frontend-nextjs`, `database-engineer`, `ux-accessibility` | Engenharia core |
| **IA/Dados** | `ai-service`, `data-scientist` | ML, agente conversacional |
| **Infra/Cloud** | `devops`, `aws`, `terraform` | AWS, IaC, CI/CD |
| **Qualidade** | `seguranca-compliance`, `test-generator`, `performance`, `github-organizer` | Transversal |

### Agents situacionais (acionar por área)

| Situação | Agent |
|---|---|
| Tarefas em `backend/src/` ou `backend/prisma/` | `backend-nestjs` |
| Tarefas em `frontend/src/` | `frontend-nextjs` |
| Tarefas em `ai-service/` | `ai-service` |
| Schema Prisma, migrations, queries lentas | `database-engineer` |
| Modelos ML, features, MASCC/CISNE | `data-scientist` |
| Docker, CI/CD de aplicação | `devops` |
| Infraestrutura AWS (ECS, RDS, VPC) | `aws` |
| Terraform IaC | `terraform` |
| HL7/FHIR, interoperabilidade hospitalar | `fhir-integration` |
| WhatsApp Business API, webhook | `whatsapp-integration` |
| Validação de lógica clínica oncológica | `clinical-domain` |
| UX, acessibilidade WCAG | `ux-accessibility` |
| Performance, bundle, N+1 | `performance` |
| Documentação técnica, OpenAPI, docs CEP | `documentation` |
| Decisões arquiteturais cross-layer | `architect` |
| Gestão de backlog, milestones, issues | `product-owner` (via `/po`) |
