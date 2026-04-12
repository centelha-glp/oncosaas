# Environment Variables Classification by Subrepo

Scope reviewed:
- `backend`, `frontend`, `ai-service`, `infra`
- root compose files and GitHub Actions workflows

Legend:
- `Build`: needed while building artifact/image
- `Run`: needed while process/container is running
- `Type`: `Variable` (non-secret config) or `Secret` (must be protected)

## Backend (`backend/`)

### Core variables used by backend code

| Variable | Build | Run | Type | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | Yes (Docker `ARG`) | Yes | Secret | Build step should use a non-sensitive placeholder; runtime must be real secret DSN. |
| `JWT_SECRET` | No | Yes | Secret | Required for auth token signing/verification. |
| `ENCRYPTION_KEY` | No | Yes | Secret | Required in production; dev has insecure fallback. |
| `FRONTEND_URL` | No | Yes | Variable | Required in production validation. |
| `REDIS_URL` | No | Yes | Variable (or Secret if auth in URL) | Required in production validation. |
| `NODE_ENV` | No | Yes | Variable | Controls production checks and behavior. |
| `PORT` | No | Yes | Variable | Defaults to `3002` if unset. |
| `AI_SERVICE_URL` | No | Yes | Variable | Optional; defaults to localhost URL in code paths. |
| `ALLOWED_ORIGINS` | No | Yes | Variable | Optional CORS override list. |
| `JWT_EXPIRES_IN` | No | Yes | Variable | Optional; defaults to `24h`. |
| `USE_HTTPS` | No | Yes | Variable | Optional local HTTPS toggle. |
| `DATABASE_SCHEMA` | No | Yes | Variable | Read by config module (not in `.env.example`). |

### Optional integration variables used by backend code

| Variable | Build | Run | Type | Notes |
|---|---|---|---|---|
| `META_APP_ID` | No | Yes | Variable | Meta app identifier. |
| `META_APP_SECRET` | No | Yes | Secret | Used for signature validation and app access token flows. |
| `META_API_VERSION` | No | Yes | Variable | API version selector. |
| `META_APP_CONFIG_ID` | No | Yes | Variable | Embedded signup config ID. |
| `META_EMBEDDED_SIGNUP_REDIRECT_URI` | No | Yes | Variable | OAuth/signup redirect config. |
| `META_EMBEDDED_SIGNUP_USE_REDIRECT_URI` | No | Yes | Variable | Boolean feature flag (missing in `.env.example`). |
| `META_OAUTH_REDIRECT_URI` | No | Yes | Variable | Optional explicit OAuth callback (missing in `.env.example`). |
| `META_REDIRECT_URI` | No | Yes | Variable | Legacy alias fallback (missing in `.env.example`). |
| `BACKEND_URL` | No | Yes | Variable | Used to build webhook URL (missing in `.env.example`). |
| `WEBHOOK_URL` | No | Yes | Variable | Optional explicit webhook URL (missing in `.env.example`). |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | No | Yes | Secret | Should never use default fallback in production. |

### Declared in `backend/.env.example` but currently not used by backend code

| Variable | Build | Run | Type | Notes |
|---|---|---|---|---|
| `BACKEND_SERVICE_TOKEN` | No | No (backend code) | Secret | Present in template but not read by backend code today. |
| `RABBITMQ_URL` | No | No (backend code) | Secret (if URL has creds) | Declared but not consumed in backend source. |
| `RUN_SEED_ON_BOOT` | No | No | Variable | Declared but no code usage found. |
| `WHATSAPP_API_URL` | No | No | Variable | Declared but no code usage found. |
| `WHATSAPP_API_TOKEN` | No | No | Secret | Declared but no code usage found. |
| `FHIR_BASE_URL` | No | No | Variable | Mentioned in docs only. |
| `FHIR_CLIENT_ID` | No | No | Variable | Mentioned in docs only. |
| `FHIR_CLIENT_SECRET` | No | No | Secret | Mentioned in docs only. |
| `POSTGRES_USER` | No | Infra runtime only | Variable | Used by Docker Postgres container bootstrap, not backend app code. |
| `POSTGRES_PASSWORD` | No | Infra runtime only | Secret | Used by Docker Postgres container bootstrap. |
| `POSTGRES_DB` | No | Infra runtime only | Variable | Used by Docker Postgres container bootstrap. |
| `RABBITMQ_DEFAULT_USER` | No | Infra runtime only | Variable | Used by Docker RabbitMQ container bootstrap. |
| `RABBITMQ_DEFAULT_PASS` | No | Infra runtime only | Secret | Used by Docker RabbitMQ container bootstrap. |

## Frontend (`frontend/`)

### Variables used by frontend code

| Variable | Build | Run | Type | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Dev runtime too | Variable (public) | Exposed to browser; never store secrets. |
| `NEXT_PUBLIC_WS_URL` | Yes | Dev runtime too | Variable (public) | Exposed to browser. |
| `NEXT_PUBLIC_API_PORT` | Yes | Dev runtime too | Variable (public) | Used in URL fallback logic. |
| `NEXT_PUBLIC_META_APP_ID` | Yes | Dev runtime too | Variable (public) | Used in client-side embedded signup flow. |
| `NEXT_PUBLIC_META_CONFIG_ID` | Yes | Dev runtime too | Variable (public) | Used in embedded signup flow. |
| `NEXT_PUBLIC_META_APP_CONFIG_ID` | Yes | Dev runtime too | Variable (public) | Alias fallback in embedded signup flow. |
| `NODE_ENV` | No | Yes | Variable | Runtime mode switch. |

### Declared in `frontend/.env.example` but currently unused in frontend code

| Variable | Build | Run | Type | Notes |
|---|---|---|---|---|
| `NEXTAUTH_URL` | No | No (current code) | Variable | Keep only if NextAuth routes/session handlers are added. |
| `NEXTAUTH_SECRET` | No | No (current code) | Secret | Keep only if NextAuth is actually active. |

## AI Service (`ai-service/`)

### Variables used by AI service code

| Variable | Build | Run | Type | Notes |
|---|---|---|---|---|
| `BACKEND_URL` | No | Yes | Variable | Backend base URL for side effects. |
| `BACKEND_SERVICE_TOKEN` | No | Yes | Secret | Required for authenticated write-backs to backend. |
| `AI_SERVICE_REQUIRE_SERVICE_TOKEN` | No | Yes | Variable | If `true`/`1`/`yes`/`on`, ai-service returns 503 when `BACKEND_SERVICE_TOKEN` is unset (any environment). |
| `OPENAI_API_KEY` | No | Yes | Secret | Optional individually, but at least one LLM key is needed for non-fallback responses. |
| `ANTHROPIC_API_KEY` | No | Yes | Secret | Optional individually, but at least one LLM key is needed for non-fallback responses. |
| `CORS_ORIGINS` | No | Yes | Variable | Comma-separated allowed origins. |
| `RAG_EMBEDDING_MODEL` | No | Yes | Variable | Optional tuning. |
| `RAG_TOP_K` | No | Yes | Variable | Optional tuning. |
| `RAG_SCORE_THRESHOLD` | No | Yes | Variable | Optional tuning. |
| `ENABLE_DEBUG_ENDPOINTS` | No | Yes | Variable | Optional debug-only flag; used but missing in `.env.example`. |
| `GOOGLE_CLOUD_PROJECT_ID` | No | Yes | Variable | Declared in settings; currently not used in core logic. |
| `LOCALAPPDATA` | No | OS runtime | Variable | Windows-only system env fallback for FAISS cache path. |

## Infra (`infra/` + deployment workflows)

### Terraform apply-time inputs (`infra/variables.tf`)

| Variable | Build | Run | Type | Notes |
|---|---|---|---|---|
| `aws_region`, `project`, `environment` | Yes (infra apply) | N/A | Variable | Infra identity/config. |
| `github_repo`, `github_branch` | Yes (infra apply) | N/A | Variable | OIDC trust policy scope. |
| `vpc_cidr`, `public_subnet_cidr`, `private_subnet_cidrs`, `availability_zones` | Yes (infra apply) | N/A | Variable | Network topology. |
| `instance_type`, `key_name`, `allow_ssh`, `admin_cidr`, `ssh_public_key` | Yes (infra apply) | N/A | Variable | Host access/shape. |
| `app_url` | Yes (infra apply) | Used to generate app runtime env | Variable | Public app URL. |
| `db_name`, `db_master_username`, `db_instance_class`, `db_allocated_storage_gb`, `db_backup_retention_days` | Yes (infra apply) | N/A | Variable | DB sizing/identity (username is non-secret). |

### Secrets generated/stored by infra in SSM (runtime consumption)

| Parameter | Build | Run | Type | Notes |
|---|---|---|---|---|
| `/${project}/${environment}/db/master_password` | No | Yes | Secret | Generated random password. |
| `/${project}/${environment}/db/url` | No | Yes | Secret | Full DSN with credentials. |
| `/${project}/${environment}/backend/JWT_SECRET` | No | Yes | Secret | Generated random secret. |
| `/${project}/${environment}/backend/ENCRYPTION_KEY` | No | Yes | Secret | Generated random key. |
| `/${project}/${environment}/frontend/NEXTAUTH_SECRET` | No | Yes | Secret | Generated random secret. |
| `/${project}/${environment}/shared/BACKEND_SERVICE_TOKEN` | No | Yes | Secret | Generated random internal token. |

### CI/CD variables used in workflows (`.github/workflows/deploy.yml`)

| Variable | Build | Run | Type | Notes |
|---|---|---|---|---|
| `AWS_REGION`, `AWS_ACCOUNT_ID`, `APP_URL`, `AWS_ROLE_TO_ASSUME`, `EC2_INSTANCE_ID` | Yes (pipeline/deploy) | No | Variable | GitHub Actions vars. |
| `ECR_REGISTRY`, `IMAGE_TAG` | Yes (image/deploy selection) | Yes (compose interpolation at deploy) | Variable | Not secret. |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` | Yes (frontend image build args) | No (for baked client config) | Variable (public) | Build-time frontend public config. |

## Recommended cleanup / gaps

1. Add missing backend variables to `backend/.env.example`: `BACKEND_URL`, `WEBHOOK_URL`, `USE_HTTPS`, `DATABASE_SCHEMA`, `META_OAUTH_REDIRECT_URI`, `META_REDIRECT_URI`, `META_EMBEDDED_SIGNUP_USE_REDIRECT_URI`.
2. Add missing ai-service variables to `ai-service/.env.example`: `ENABLE_DEBUG_ENDPOINTS`, `GOOGLE_CLOUD_PROJECT_ID`.
3. Decide whether to remove or mark deprecated unused template vars (`RUN_SEED_ON_BOOT`, `WHATSAPP_API_*`, `FHIR_*`, etc.) to avoid operator confusion.
4. Do not pass real production DB credentials as Docker build args (`DATABASE_URL`) in backend builds; use a placeholder at build and real secret only at runtime.
5. If production AI responses must use real LLMs, provision `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` through secure runtime secret delivery (currently not generated by infra template).
