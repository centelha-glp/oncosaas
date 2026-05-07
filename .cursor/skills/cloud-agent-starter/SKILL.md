---
name: cloud-agent-starter
description: Starter mínimo para Cloud agents do ONCONAV — como subir, autenticar e testar backend (NestJS), frontend (Next.js) e ai-service (FastAPI), com flags, mocks e atalhos de CI. Use no primeiro turno de qualquer Cloud agent que ainda não conhece este repositório.
---

# Cloud Agent Starter — ONCONAV

> Leia primeiro este arquivo se for a primeira vez que você opera neste repositório como Cloud agent. Aqui está o mínimo prático para colocar o stack para rodar e validar mudanças sem ficar caçando documentação.

## 0. Mapa de 30 segundos

Três serviços + infra Docker:

| Área | Pasta | Stack | Porta | Health |
|---|---|---|---|---|
| Frontend | `frontend/` | Next.js 15 + React 19 + Vitest + Playwright | 3000 | `GET /` |
| Backend | `backend/` | NestJS 11 + Prisma + Jest | 3002 | `GET /api/v1/health` |
| AI Service | `ai-service/` | FastAPI + LightGBM + pytest | 8001 | `GET /health` |
| Infra | `compose.infra.yml` | PostgreSQL 15, Redis 7, RabbitMQ 3 | 5432 / 6379 / 5672 + 15672 | health checks no compose |

Workflow padrão de uma task de Cloud agent:

1. Ler **AGENTS.md / `CLAUDE.md` / regras `.cursor/rules/`** apenas se a task tocar a área.
2. Configurar `.env` por serviço (seção 2).
3. Subir infra com `compose.infra.yml` (seção 3).
4. Rodar a área que você está mexendo (seção 4).
5. Executar os testes correspondentes (seção 5).
6. Antes do PR, rodar o **gate equivalente ao CI** (seção 7).

## 1. Ferramentas e versões

- Node.js 24 (CI usa `node-version: '24'`).
- Python 3.11 (`ai-service/Dockerfile` fixa `python:3.11.15-slim-bookworm`).
- Docker + `docker compose` v2.
- `npm` para frontend e backend; `pip` para ai-service.

Se faltar Node 24 ou Python 3.11 no VM do Cloud agent, instale antes de continuar — não tente rodar com versões diferentes.

## 2. `.env` por serviço (sempre o primeiro passo)

Cada serviço lê o **seu próprio** `.env` (root `.env` não é lido pelo Next/Nest/FastAPI). Comece sempre copiando os templates:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-service/.env.example ai-service/.env
```

### Defaults seguros para Cloud agent (dev/CI)

Adicione (append) ao `.env` correspondente:

**`backend/.env`** (sem esses dois, o Nest sobe mas falha em produção; em dev tem fallback inseguro)

```env
JWT_SECRET=ci-test-jwt-secret
ENCRYPTION_KEY=12345678901234567890123456789012
DATABASE_URL=postgresql://ONCONAV:ONCONAV_dev@localhost:5432/ONCONAV_development
REDIS_URL=redis://localhost:6379
BACKEND_SERVICE_TOKEN=ci-backend-service-token
```

**`frontend/.env`** (modo proxy relativo — recomendado, evita problemas de CORS/cookie)

```env
JWT_SECRET=ci-test-jwt-secret
BACKEND_URL=http://localhost:3002
NEXT_PUBLIC_USE_RELATIVE_API=true
NEXT_PUBLIC_WS_URL=ws://localhost:3002
```

**`ai-service/.env`**

```env
BACKEND_URL=http://localhost:3002
BACKEND_SERVICE_TOKEN=ci-backend-service-token
CORS_ORIGINS=http://localhost:3000
```

Detalhes completos por variável em `docs/desenvolvimento/env-vars-classification.md`. Nunca commit `.env`.

### Flags e modos que importam para Cloud agents

| Flag | Onde | Efeito | Quando ligar |
|---|---|---|---|
| `NEXT_PUBLIC_USE_RELATIVE_API=true` | `frontend/.env` | Next faz proxy de `/api/v1/*` para `BACKEND_URL`; cookie `access_token` HttpOnly funciona na mesma origem | **Padrão recomendado** em dev e CI |
| `USE_HTTPS=true` | `backend/.env` (e `npm run start:dev:https`) | Backend sobe em HTTPS com cert auto-assinado | Apenas para testar Embedded Signup / Meta |
| `AI_SERVICE_REQUIRE_SERVICE_TOKEN=true` | `ai-service/.env` | `/agent/*` retorna 503 se `BACKEND_SERVICE_TOKEN` ausente | Reproduzir bug de auth do ai-service; default em prod |
| `ENABLE_DEBUG_ENDPOINTS=true` | `ai-service/.env` | Habilita `GET /api/v1/debug/llm-status` | Verificar quais LLM keys estão configuradas |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | `ai-service/.env` | Sem nenhum dos dois, o agente cai em **fallback determinístico** (sem LLM real) | Deixe **vazio** por padrão em Cloud agent — fallback é determinístico, suficiente para testes não-LLM |
| `RUN_DB_SEED_ON_EMPTY=false` | `backend/.env` (CI) / `RUN_SEED_ON_BOOT=false` em `.env.example` | Sinaliza intenção de pular o seed automático no boot do container; usado pelo job `integration` do CI. Verifique o entrypoint atual antes de confiar | CI/integration tests |

> Não há sistema de feature flags próprio no produto. Comportamentos opcionais hoje são apenas env vars como as acima. Se você adicionar flags novas, atualize esta tabela (seção 9).

## 3. Subir a infraestrutura local

Sempre que a task envolver banco, Redis, mensagens ou auth, suba a infra primeiro:

```bash
docker compose -f compose.infra.yml up -d
```

Aguarde os healthchecks (`docker compose -f compose.infra.yml ps` mostra `healthy`).

Para parar e limpar volumes (útil entre tasks que mexem em schema):

```bash
docker compose -f compose.infra.yml down -v
```

Stack completa (apps + infra) em um único comando:

```bash
docker compose -f docker-compose.dev.yml up -d --build
# logs: docker compose -f docker-compose.dev.yml logs -f
# parar: docker compose -f docker-compose.dev.yml down
```

A versão completa é o que o job `integration` do CI roda — útil para reproduzir CI localmente.

## 4. Por área: como rodar e como autenticar

### 4.1 Backend (`backend/`)

**Instalar e migrar:**

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy   # aplica migrations já existentes
npx prisma db seed          # cria tenant + 4 usuários de teste
```

**Subir em dev (watch):**

```bash
npm run start:dev
# health: curl -fsS http://localhost:3002/api/v1/health
```

**Login (4 contas pós-seed, todas com `senha123`):**

| Email | Role |
|---|---|
| `admin@hospitalteste.com` | ADMIN |
| `oncologista@hospitalteste.com` | ONCOLOGIST |
| `enfermeira@hospitalteste.com` | NURSE |
| `coordenador@hospitalteste.com` | COORDINATOR |

**Cookie jar (jeito recomendado — funciona com `NEXT_PUBLIC_USE_RELATIVE_API=true`):**

```bash
# 1. Login (cookie HttpOnly access_token vai para onconav.cookies)
curl -c onconav.cookies -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospitalteste.com","password":"senha123"}'

# 2. Pegar tenantId da resposta JSON (campo user.tenantId).

# 3. Chamar endpoints autenticados
curl -b onconav.cookies http://localhost:3002/api/v1/patients \
  -H "X-Tenant-Id: <tenantId-do-login>"
```

`Authorization: Bearer <token>` também é aceito (token está dentro do cookie `access_token`). Mais exemplos em `docs/desenvolvimento/quick-test-guide.md`.

**Mocks no backend:**

- O backend **não mocka** o ai-service em runtime; falhas no ai-service degradam para resposta de erro controlado. Para testes unitários, mock o `AiService` no Jest.
- WhatsApp/Meta: defina `META_APP_ID/SECRET` apenas se a task tocar Embedded Signup. Sem isso, os endpoints de canal ficam inertes — o que é o comportamento desejado em Cloud agent.

### 4.2 Frontend (`frontend/`)

```bash
cd frontend
npm ci
npm run dev   # http://localhost:3000
```

A UI espera o backend ouvindo em `BACKEND_URL` (proxy via `src/app/api/v1/[[...path]]/route.ts`). Faça login no `/login` com a mesma credencial do seed; o cookie HttpOnly fica preso na sessão.

**E2E com Playwright (precisa do stack rodando):**

```bash
# terminal 1: infra + backend + ai-service ligados
# terminal 2:
cd frontend
npx playwright install --with-deps chromium   # primeira vez
npm run test:e2e             # headless
npm run test:e2e:headed      # com browser visível (precisa xvfb no Cloud agent)
```

### 4.3 AI Service (`ai-service/`)

```bash
cd ai-service
python -m pip install -r requirements-dev.txt   # inclui pytest, ruff
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
# health: curl -fsS http://localhost:8001/health
# OpenAPI: http://localhost:8001/docs
```

**Modo sem LLM (default em Cloud agent):** deixe `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` vazios. O orquestrador detecta via `llm_provider.has_any_llm_key()` e usa `_fallback_response()` — Layer 1 (clinical_rules) e Layer 3 (modelo LightGBM) seguem funcionando, suficiente para testar regras determinísticas.

**Re-treinar modelo de priorização (raro):**

```bash
cd ai-service
python -m scripts.train_model           # sintético, 5000 amostras
python -m scripts.train_model --eval    # avalia sem retreinar
```

## 5. Workflows concretos de teste por área

> Sempre comite com `npm test` / `pytest` verde no escopo afetado. CI bloqueia merge.

### 5.1 Backend (Jest + Prisma)

```bash
cd backend
npm run lint
npm run type-check
npm test -- --forceExit                 # unit (espelha o passo do CI)
npm run test:cov                        # com coverage
npm run test:e2e                        # E2E (precisa de PG via compose.infra)
# checagem de paridade clínica usada no CI:
npm run export-protocol-snapshot && git diff --exit-code shared/clinical-protocol-snapshot.v1.json
```

Para rodar um único arquivo:

```bash
npx jest src/alerts/alerts.service.spec.ts
```

Padrão de teste obrigatório quando alterar service: happy path + `NotFoundException` + isolamento multi-tenant (verificar `tenantId` no `where`). Detalhe em `.claude/skills/gerar-testes/SKILL.md`.

### 5.2 Frontend (Vitest + Playwright)

```bash
cd frontend
npm run lint
npm run type-check
npm test                          # Vitest unit + RTL
npm run test:cov
npm run test:e2e                  # Playwright (full stack precisa estar up)
```

Padrão para hook: success + erro + loading. Para componente: render + interação principal.

### 5.3 AI Service (pytest + ruff)

```bash
cd ai-service
ruff check .
pytest tests/ -v --tb=short
pytest tests/agent/test_clinical_rules.py -v   # foco em regras determinísticas
pytest --cov=src --cov-report=term-missing
```

Ao mexer em `clinical_rules.py` / `clinical_scores.py` / `priority_model.py`, **obrigatório** cobrir caso positivo + caso negativo no limiar exato (ex.: febre 38.0°C dispara, 37.9°C não). Detalhe em `.cursor/rules/ai-service.mdc`.

## 6. Endpoints que você usa o tempo todo

| Para | Comando |
|---|---|
| Health backend | `curl -fsS http://localhost:3002/api/v1/health` |
| Health ai-service | `curl -fsS http://localhost:8001/health` |
| Status migrations | `cd backend && npx prisma migrate status` |
| Reset DB (limpa tudo) | `cd backend && npx prisma migrate reset --force` |
| Logs container backend | `docker logs -f backend` |
| Logs ai-service | `docker logs -f ai-service` |
| Listar pacientes (autenticado) | ver seção 4.1 |

## 7. Reproduzir o CI antes de abrir PR

O job `integration` do `.github/workflows/ci.yml` é a verdade. Para rodar equivalente local:

```bash
docker compose -f docker-compose.dev.yml up -d --build
# espera healthchecks (~60s)
curl -fsS http://127.0.0.1:3000/        > /dev/null
curl -fsS http://127.0.0.1:3002/api/v1/health > /dev/null
curl -fsS http://127.0.0.1:8001/health   > /dev/null
docker compose -f docker-compose.dev.yml down -v
```

Por área, o CI executa exatamente:

- **frontend**: `npm ci → type-check → lint → test → build`
- **backend**: `npm ci → prisma generate → prisma migrate deploy → export-protocol-snapshot (checa diff) → type-check → lint → test --forceExit → build`
- **ai-service**: `pip install -r requirements-dev.txt → ruff check . → pytest tests/ -v`

Se sua mudança não passa por algum desses comandos, ela quebra o CI.

## 8. Pegadinhas conhecidas

- **Cookie HttpOnly + porta**: `access_token` é setado no domínio do backend (porta 3002). Se você chamar a API direto de outra origem sem `withCredentials: true` ou sem proxy, o cookie não viaja. Use `NEXT_PUBLIC_USE_RELATIVE_API=true`.
- **`prisma generate` faltando**: backend não compila se você pular. Está no `postinstall`, mas se mexer em `schema.prisma` rode `npx prisma generate` antes do `npm run start:dev`.
- **Plataforma ARM/AMD**: Dockerfiles de produção são `linux/arm64` (EC2 Graviton). Para build local em máquina amd64 use `--platform=linux/amd64` ou rode com `npm`/`pip` direto fora do Docker.
- **`start_period: 60s`** nos healthchecks de backend e ai-service é proposital (migrations + carga do modelo). Não diminua.
- **Seed roda quando o banco está vazio** (em Docker). Se já existe dado e você quer reseedar: `npx prisma migrate reset --force` no backend.
- **Sem internet**: dependências precisam estar pré-instaladas. Se `npm ci`/`pip install` falhar por rede, instale via cache local antes de rodar testes.

## 9. Como atualizar esta skill

Esta skill é para Cloud agents. Sempre que você descobrir um truque, env var, comando, mock ou flag útil que não está aqui, **adicione antes de fechar o PR**. Regras:

1. **Mantenha minimalista.** Se um detalhe é específico de uma área profunda (ex.: padrão de retorno do orchestrator), referencie a regra `.cursor/rules/<area>.mdc` em vez de duplicar.
2. **Edite ambos os espelhos**: `.cursor/skills/cloud-agent-starter/SKILL.md` e `.claude/skills/cloud-agent-starter/SKILL.md`. Os dois devem ficar idênticos.
3. **Atualize a tabela de flags (seção 2)** se a sua mudança introduzir uma env var que afeta runtime, mocks ou bypass de auth.
4. **Atualize o bloco "Reproduzir o CI"** (seção 7) se mudou algum passo do `.github/workflows/ci.yml` — esta seção precisa bater com o CI real.
5. **Adicione uma linha em "Pegadinhas conhecidas" (seção 8)** quando perder ≥30 minutos depurando algo que não estava documentado. Ajude o próximo agent.
6. **Não documente conteúdo de outros squads aqui.** Para regras clínicas, modelo ML, RAG, etc., o lugar é `.cursor/rules/` ou skills específicas (`agente-*`).

Após editar, rode (sanity):

```bash
ls .cursor/skills/cloud-agent-starter/SKILL.md .claude/skills/cloud-agent-starter/SKILL.md
diff .cursor/skills/cloud-agent-starter/SKILL.md .claude/skills/cloud-agent-starter/SKILL.md   # deve sair vazio
```

Commit em mensagem dedicada: `docs(skill): cloud-agent-starter — <o que foi descoberto>`.
