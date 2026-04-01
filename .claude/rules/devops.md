# DevOps Rules — ONCONAV

Regras extraídas diretamente dos arquivos de infraestrutura existentes: `docker-compose.dev.yml`, `docker-compose.prod.yml`, `compose.infra.yml`, `compose.app.yml`, Dockerfiles de cada serviço e workflows `.github/workflows/ci.yml` e `.github/workflows/deploy.yml`.

---

## 1. Arquivos Compose — Quando Usar Cada Um

| Arquivo | Propósito | Quando usar |
|---|---|---|
| `compose.infra.yml` | Somente infra: PostgreSQL, Redis, RabbitMQ | Desenvolvimento local quando as aplicações rodam fora do Docker (`npm run dev`) |
| `compose.app.yml` | Somente aplicações: backend, frontend, ai-service | Integração local ou staging quando a infra já está rodando separadamente |
| `docker-compose.dev.yml` | Stack completa dev: infra + aplicações com `NODE_ENV=development` | Reprodução local full-stack containerizada ou testes de integração pré-CI |
| `docker-compose.prod.yml` | Stack prod: somente aplicações (sem infra interna) | Deploy em produção na EC2 — infra é gerenciada externamente (RDS, ElastiCache, etc.) |

**Diferenças críticas entre dev e prod:**

- `docker-compose.dev.yml` define `DATABASE_URL`, `REDIS_URL` e `RABBITMQ_URL` inline com credenciais de desenvolvimento. `docker-compose.prod.yml` **não define** essas variáveis — elas devem vir exclusivamente de `backend/.env` injetado via GitHub Secrets na EC2.
- Em dev, todos os serviços (incluindo infra) são iniciados e têm health checks. Em prod, apenas as três aplicações são gerenciadas pelo compose.
- O campo `depends_on` com `condition: service_healthy` é mantido nos dois arquivos para as aplicações.

---

## 2. Dockerfiles — Convenções por Serviço

### Padrão multi-stage obrigatório

Todos os três Dockerfiles usam multi-stage build. Nunca colapsar estágios em um único `FROM` — isso aumenta o tamanho da imagem e inclui artefatos de build na imagem final.

### frontend (`frontend/Dockerfile`)

- **Estágios:** `deps` (node:24.14.0-alpine3.23) → `builder` → `production` (gcr.io/distroless/nodejs24-debian13:nonroot)
- **Imagem final:** distroless `nonroot` — não tem shell, não tem package manager, roda como usuário não-root por construção da imagem base.
- **Build args obrigatórios em produção:** `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_WS_URL` — passados pelo workflow de deploy. Esses valores são embarcados em tempo de build no bundle Next.js; não podem ser alterados em runtime.
- **Output:** standalone Next.js (`output: 'standalone'` deve estar em `next.config.ts`). A imagem copia somente `.next/standalone` e `.next/static`.
- **Porta exposta:** 3000. Entrypoint: `server.js`.

### backend (`backend/Dockerfile`)

- **Estágios:** `deps` → `builder` → `production` (node:24.14.0-alpine3.23)
- **Imagem final:** Alpine com Node 24. O estágio production copia `dist/`, `node_modules/` (após `npm prune --omit=dev`), `prisma/` e `docker-entrypoint.sh`.
- **Usuário não-root:** `USER node` explícito no estágio production, após `chown -R node:node /app`.
- **Entrypoint:** `docker-entrypoint.sh` — responsável por rodar migrações Prisma antes de iniciar o servidor. Nunca alterar o entrypoint para pular migrações.
- **Porta exposta:** 3002.

### ai-service (`ai-service/Dockerfile`)

- **Estágios:** `builder` (python:3.11.15-slim-bookworm) → `runtime`
- **Virtualenv isolado:** o builder cria `/venv` e instala todas as dependências nele. O runtime copia somente `/venv` — nenhuma ferramenta de build vai para a imagem final.
- **Patches de SO:** ambos os estágios executam `apt-get upgrade -y` para aplicar patches de segurança. Manter este padrão.
- **pip/setuptools/wheel:** fixados em versões específicas (`setuptools==82.0.1`, `wheel==0.46.3`) para evitar falsos positivos do Trivy. Nunca remover essas versões fixas.
- **Porta exposta:** 8001.

### Regras gerais de Dockerfile

- Versões de imagem base sempre fixas. Nunca usar `latest`.
- `.dockerignore` deve existir em cada serviço excluindo: `node_modules/`, `.env`, `dist/`, `.next/`, `__pycache__/`, `*.pyc`, `coverage/`.
- Variáveis de ambiente de runtime nunca devem ser `ARG`/`ENV` no Dockerfile — injetar em runtime via `env_file` ou `environment` no compose.
- `NEXT_PUBLIC_*` são exceção legítima para `ARG`/`ENV` no Dockerfile do frontend.

---

## 3. Health Checks — Padrão por Serviço

Os health checks são usados pelos `depends_on: condition: service_healthy` — alterações nos endpoints ou comandos quebram a cadeia de inicialização.

### PostgreSQL
```yaml
test: ['CMD-SHELL', 'pg_isready -U ONCONAV -d ONCONAV_development']
interval: 10s / timeout: 5s / retries: 5
```

### Redis
```yaml
test: ['CMD', 'redis-cli', 'ping']
interval: 10s / timeout: 5s / retries: 5
```

### RabbitMQ
```yaml
test: ['CMD', 'rabbitmq-diagnostics', 'ping']
interval: 10s / timeout: 5s / retries: 5
```

### Backend (NestJS)
```yaml
test:
  - CMD-SHELL
  - node -e "require('http').get('http://backend:3002/api/v1/health',function(r){process.exit(r.statusCode===200?0:1)}).on('error',function(){process.exit(1)})"
interval: 30s / timeout: 10s / retries: 5 / start_period: 60s
```

O `start_period: 60s` é necessário porque o entrypoint executa migrações Prisma antes do servidor subir.

### AI Service (FastAPI)
```yaml
test: ['CMD-SHELL', 'python -c "import urllib.request; urllib.request.urlopen(\"http://localhost:8001/health\")"']
interval: 30s / timeout: 10s / retries: 5 / start_period: 60s
```

O `start_period: 60s` é necessário porque o serviço carrega o modelo LightGBM e inicializa o índice FAISS/RAG na startup.

---

## 4. Variáveis de Ambiente — Como Injetar por Ambiente

### Desenvolvimento local

Cada serviço lê seu próprio arquivo `.env` via `env_file`. O bloco `environment:` no compose sobrescreve valores do `env_file` para connection strings inter-serviço (hostname `postgres`, não `localhost`).

Variáveis obrigatórias para desenvolvimento:
- `JWT_SECRET`, `ENCRYPTION_KEY` — o backend lança erro na startup se ausentes

### CI (GitHub Actions)

O workflow `ci.yml` copia `.env.example` e faz append das variáveis de CI:
```bash
cp .env.example .env
echo "JWT_SECRET=${{ secrets.CI_JWT_SECRET || 'ci-test-jwt-secret' }}" >> .env
```

Secrets obrigatórios: `CI_JWT_SECRET`, `CI_ENCRYPTION_KEY`, `CI_NEXTAUTH_SECRET`, `CI_BACKEND_SERVICE_TOKEN`.

O fallback hardcoded (`|| 'ci-test-jwt-secret'`) é aceitável apenas em CI — **nunca em produção**.

### Produção (EC2)

Os arquivos `.env` de produção residem na EC2 em `/opt/oncosaas/current/`. Não são gerenciados pelo pipeline de deploy — provisionados manualmente ou via AWS Secrets Manager/SSM Parameter Store.

Variáveis de ambiente necessárias no repositório GitHub para deploy:
- `AWS_REGION`, `AWS_ACCOUNT_ID`, `APP_URL`, `AWS_ROLE_TO_ASSUME`, `EC2_INSTANCE_ID`

---

## 5. CI/CD — Workflows Existentes

### `ci.yml` — Integração Contínua

**Trigger:** push e pull_request para `main`.

**Sequência:**
```
compose-validate
    ├── frontend (paralelo)
    ├── backend (paralelo)
    └── ai-service (paralelo)
```

**Job `compose-validate`:** valida os quatro arquivos compose com `docker compose config`. Falha se qualquer arquivo tiver erro.

**Job `frontend`:** `.env` → `npm ci` → `type-check` → `lint` → `npm test` → `npm audit` (warn) → `npm run build`

**Job `backend`:** `.env` → `npm ci` → `prisma generate` → `type-check` → `lint` → `npm test --forceExit` → `npm audit` (warn) → `npm run build`

**Job `ai-service`:** `.env` → `pip install` → `ruff check .` → `pytest tests/ -v` → `pip-audit` (warn)

`npm audit` e `pip-audit` têm `continue-on-error: true` — não bloqueiam CI, mas devem ser revisados periodicamente.

### `deploy.yml` — Deploy Contínuo

**Trigger:** push para `main` apenas.

**Concorrência:** `cancel-in-progress: true` — deploys simultâneos são cancelados.

**Autenticação AWS:** OIDC (`id-token: write`). Nunca usar AWS access keys estáticas.

**Sequência:**
```
build-and-push (matrix: backend, frontend, ai-service — paralelo)
    └── scan (matrix: backend, frontend, ai-service — paralelo)
            └── deploy (single job)
```

**Job `build-and-push`:**
- Plataforma: `linux/arm64` (EC2 Graviton). Imagens `amd64` não rodam.
- Tags: `ECR_REGISTRY/oncosaas-<service>:<sha>` e `:latest`

**Job `scan`:**
- Trivy `v0.69.3`. `CRITICAL` bloqueia para backend e frontend; warn para ai-service.

**Job `deploy`:**
1. Copia `docker-compose.prod.yml` para EC2 via SSM
2. Pull das imagens com tag `${{ github.sha }}`
3. `docker compose config` — validação antes do up
4. `docker compose up -d --no-build --force-recreate --remove-orphans`
5. Health checks: `curl -fsS` nos três endpoints
6. `docker container prune -f && docker image prune -f`

---

## 6. Serviços Externos — Configurações

### PostgreSQL 15
- Imagem: `postgres:15-alpine` | Volume: `postgres_data:/var/lib/postgresql/data`
- Porta vinculada a `127.0.0.1` — não exposta externamente
- Em produção: gerenciado externamente (RDS ou equivalente)

### Redis 7
- Imagem: `redis:7-alpine` | Volume: `redis_data:/data`
- Sem autenticação em dev. Em produção: usar auth via URL.
- Em produção: gerenciado externamente (ElastiCache)

### RabbitMQ 3
- Imagem: `rabbitmq:3-management-alpine`
- Portas: 5672 (AMQP) e 15672 (Management UI) — vinculadas a `127.0.0.1`
- Management UI porta 15672 **nunca expor publicamente**
- Em produção: gerenciado externamente

---

## 7. Portas — Mapeamento Definitivo

Todas as portas vinculadas a `127.0.0.1` — nunca `0.0.0.0`.

| Serviço | Porta Container | Porta Host |
|---|---|---|
| Frontend (Next.js) | 3000 | 127.0.0.1:3000 |
| Backend (NestJS) | 3002 | 127.0.0.1:3002 |
| AI Service (FastAPI) | 8001 | 127.0.0.1:8001 |
| PostgreSQL | 5432 | 127.0.0.1:5432 (dev) / RDS (prod) |
| Redis | 6379 | 127.0.0.1:6379 (dev) / ElastiCache (prod) |
| RabbitMQ AMQP | 5672 | 127.0.0.1:5672 |
| RabbitMQ Management | 15672 | 127.0.0.1:15672 (dev) / nunca (prod) |

---

## 8. Monitoramento — Logs

- **Backend:** NestJS Logger obrigatório. `console.log` proibido. `LoggingInterceptor` injeta correlation ID via `x-request-id`.
- **AI Service:** logs JSON estruturados via `_JsonFormatter`. Nunca logar valores de API keys.
- **Dados sensíveis:** nunca logar CPF, telefone, tokens JWT, `ENCRYPTION_KEY`, `JWT_SECRET`.

**Health Endpoints:**

| Serviço | Endpoint | Resposta |
|---|---|---|
| Backend | `GET /api/v1/health` | HTTP 200 |
| AI Service | `GET /health` | `{"status": ..., "model_trained": ..., "capabilities": ...}` |
| Frontend | `GET /` | HTTP 200 |

---

## 9. Deploy em Produção — Procedimento

O deploy é automatizado via `deploy.yml` no push para `main`. Para rollback, re-run o job de deploy de um commit anterior no GitHub Actions ou manualmente via SSM com o SHA do commit anterior.

Os volumes `backend_uploads` persistem entre deploys — nunca rodar `docker volume prune` sem verificar o conteúdo.

---

## 10. O que NUNCA Fazer em Infraestrutura

- **Nunca commitar arquivos `.env`** — usar `.env.example` como template.
- **Nunca usar `latest` como tag de imagem base** em Dockerfiles.
- **Nunca expor portas em `0.0.0.0`** nos arquivos compose — sempre `127.0.0.1:<porta>`.
- **Nunca hardcodar `JWT_SECRET` ou `ENCRYPTION_KEY`** em qualquer arquivo commitado.
- **Nunca buildar imagens para `amd64`** no pipeline — a EC2 usa ARM64 (Graviton).
- **Nunca rodar `docker-compose.prod.yml` com `--build`** no deploy — imagens devem vir do ECR.
- **Nunca alterar `docker-entrypoint.sh` do backend para pular migrações.**
- **Nunca reduzir `start_period`** do health check abaixo de 60s sem medir startup real.
- **Nunca expor a porta 15672 do RabbitMQ** fora de loopback.
- **Nunca usar AWS access keys estáticas** no pipeline — autenticação é via OIDC.
- **Nunca executar `docker volume prune`** em produção sem verificar `backend_uploads`.
