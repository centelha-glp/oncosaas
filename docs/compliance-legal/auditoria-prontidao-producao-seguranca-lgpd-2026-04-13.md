# Auditoria de prontidão para produção — segurança e alinhamento técnico LGPD (ONCONAV)

> **Tipo:** avaliação técnica de implementação (não certificação jurídica nem parecer de DPO)  
> **Data:** 2026-04-13  
> **Escopo:** repositório atual — backend (NestJS), frontend (Next.js), Prisma, ai-service (FastAPI), canais (WhatsApp), CI/compose conforme ficheiros analisados  
> **Nota:** `docker-compose.yml` na raiz não existe; compose validado no CI: `docker-compose.dev.yml`, `docker-compose.prod.yml`, `compose.infra.yml`, `compose.app.yml`.

---

## 1. Resumo executivo

O ONCONAV apresenta **fundação sólida** em várias frentes esperadas para SaaS multi-tenant com dados de saúde: **JWT + cookies HttpOnly no fluxo de auth**, **validação global com `ValidationPipe`**, **CORS com origens explícitas**, **Helmet**, **trust proxy**, **rate limiting**, **lockout de login**, **refresh com rotação em Redis**, **schema Prisma com `tenantId` em modelos de domínio**, **auditoria automática de mutações e leituras GET em recursos PHI definidos**, **webhook WhatsApp com verificação de assinatura em produção**, e **ai-service com autenticação por `BACKEND_SERVICE_TOKEN` em ambientes staging/production**.

**Não** se pode afirmar “LGPD compliant” ou “apto para produção” em sentido legal ou operacional pleno sem **lacunas de negócio/jurídico** (bases legais documentadas, RIPD/DPIA, contratos com subcontratados LLM/WhatsApp, política de retenção aprovada). Do ponto de vista **puramente técnico**, permanecem riscos e débitos que devem ser **priorizados antes de um go-live** (ver secção 6).

---

## 2. Metodologia e fontes

| Área | Evidências principais |
|------|------------------------|
| Regras de projeto | `.cursor/rules/security.mdc`, `.cursor/rules/onconav-core.mdc` |
| Bootstrap e HTTP | `backend/src/main.ts` |
| Auth | `backend/src/auth/auth.service.ts`, `auth.controller.ts`, guards |
| Dados | `backend/prisma/schema.prisma` (amostra extensa), `disposition-feedback.service.ts` (`$queryRaw` com `Prisma.sql`) |
| Auditoria | `backend/src/audit-log/audit-log.interceptor.ts` |
| Canal WhatsApp | `backend/src/channel-gateway/channel-gateway.controller.ts`, `channels/whatsapp.channel.ts` |
| Frontend sessão | `frontend/src/middleware.ts`, `frontend/src/lib/api/client.ts` |
| AI Service | `ai-service/main.py`, `ai-service/src/auth.py` |
| CI | `.github/workflows/ci.yml` |
| Compose dev | `docker-compose.dev.yml` |

---

## 3. Matriz LGPD (implementação técnica — não jurídica)

| Princípio / obrigação (visão técnica) | O que o código/config permite inferir | Lacunas / confirmação externa |
|--------------------------------------|----------------------------------------|--------------------------------|
| **Minimização** | DTOs + `whitelist`/`forbidNonWhitelisted`; listagens com paginação em mensagens; `select` em vários fluxos | Revisar payloads enviados ao **LLM** (prompt) e retenção em **logs** de terceiros; política de campos por endpoint |
| **Segurança (Art. 46 LGPD)** | `ENCRYPTION_KEY`, bcrypt para senhas, campos sensíveis referidos nas regras; HTTPS/TLS assumido na borda em produção | Pen-test, gestão de segredos em runtime (SSM/Secrets), **hardening** do cookie espelho no frontend |
| **Isolamento (multi-tenant)** | `tenantId` no JWT; guards; serviços recebem `tenantId` do controller; raw SQL parametrizado com `tenantId` | Garantir **revisão sistemática** de todo novo endpoint; testes E2E de isolamento |
| **Rastreabilidade** | `AuditLogInterceptor` (mutações + GET em tipos PHI listados); login auditado | Cobertura de **todas** as leituras sensíveis relevantes; retenção de logs alinhada a política (5 anos citados nas regras para audit — validar com DPO) |
| **Subcontratados / transferência** | Dados trafegam para **Meta (WhatsApp)**, **LLM (OpenAI/Anthropic)**, infra AWS | Registros de operações de tratamento, DPAs, cláusulas padrão/contratos |
| **Direitos do titular** | Não mapeado nesta auditoria de código | Processos operacionais (export, correção, eliminação) e suporte |

---

## 4. Síntese da superfície de ataque

- **Entradas HTTP:** API versionada `/api/v1`, exceções filtradas (`HttpExceptionFilter`, `PrismaExceptionFilter`).
- **Entradas públicas:** login, registro, refresh, forgot/reset password, **webhooks WhatsApp** (`@Public()` em `channel-gateway`).
- **WebSocket:** gateways com `tenantId` no handshake; **alerts.gateway** valida paciente no BD antes de join em room de paciente (`alerts.gateway.ts`).
- **AI Service:** exposto em rede interna/compose; depende de **Bearer** compartilhado com backend; em **development** pode aceitar rotas sem token se `BACKEND_SERVICE_TOKEN` vazio (`ai-service/src/auth.py`).
- **Frontend:** middleware valida JWT com `jose` + `JWT_SECRET`; cookie espelho `auth_token` para cenário cross-origin (não HttpOnly).

---

## 5. Achados priorizados

Legenda: **C** = crítico, **A** = alto, **M** = médio, **B** = baixo.

| ID | Sev | Área | Achado | Evidência | Recomendação | Esforço |
|----|-----|------|--------|-----------|--------------|---------|
| F-01 | **A** | Frontend | Cookie **`auth_token`** (espelho para middleware) é **legível por JavaScript** — superfície XSS amplia impacto vs access token só HttpOnly | `frontend/src/lib/api/client.ts` (`setMiddlewareRouteMirrorCookie`, documentação em `middleware.ts`) | CSP estrita, revisão de XSS, considerar **same-site** + rotas só server-side ou BFF; avaliar eliminar espelho se API relativa cobrir 100% | M–L |
| F-02 | **M** | AI / LGPD | **Dados clínicos** no contexto enviado ao LLM; **subprocessadores** (OpenAI/Anthropic) exigem governança contratual e minimização de prompt | `backend/src/agent/agent.service.ts` → `callAIService`; `ai-service` pipeline | Inventário de dados em prompt; DPA; opção de **anonimização**/redação; registro de operações de tratamento | L |
| F-03 | **M** | AI Service | Em **desenvolvimento**, endpoints podem ficar **sem** `BACKEND_SERVICE_TOKEN` (warning) | `ai-service/src/auth.py` | Garantir `ENVIRONMENT=production`/`staging` + token em **todos** os deploys; opcional `AI_SERVICE_REQUIRE_SERVICE_TOKEN=true` também em staging | S |
| F-04 | **M** | Observabilidade | **`main.py`** do AI Service regista prefixos mascarados de chaves LLM — reduz risco mas ainda indica existência de segredo em logs | `ai-service/main.py` (`_mask_key`) | Logar apenas boolean “configured”; evitar qualquer fragmento de chave | S |
| F-05 | **M** | Autorização | **`RolesGuard`**: se **não** houver `@Roles()`, **permite** qualquer utilizador autenticado | `backend/src/auth/guards/roles.guard.ts` | Auditoria de controllers: handlers privilegiados devem declarar `@Roles(...)` explicitamente | M |
| F-06 | **B** | WhatsApp | Logs de erro da API Graph podem incluir **corpo de erro** da Meta | `whatsapp.channel.ts` (`logger.error` com `errorBody`) | Truncar/redigir respostas upstream em produção | S |
| F-07 | **B** | CORS | Pedidos **sem header `Origin`** são aceites (`callback(null, true)`) | `backend/src/main.ts` | Aceitável para apps móveis/health checks; documentar e monitorar abusos | S |
| F-08 | **B** | Interceptor | **`LoggingInterceptor`** regista **body** de requests não-GET — risco de **PII em logs** se aplicado a rotas sensíveis | `backend/src/common/interceptors/logging.interceptor.ts` | **Não** registar body em produção ou sanitizar; hoje o `AppModule` regista apenas `AuditLogInterceptor` — evitar adicionar logging global sem sanitização | S |
| F-09 | **B** | CI | `npm audit` / `pip-audit` com **`continue-on-error: true`** | `.github/workflows/ci.yml` | Falhas de dependência não bloqueiam merge — processo periódico ou gate em `main` | S |
| F-10 | **B** | Documentação | Nest **sem Swagger** formal — superfície de API menos visível para revisão de segurança | `docs/README.md` (nota em documentation.mdc) | OpenAPI seletivo ou revisão manual por módulo | M |

**Multi-tenant:** não foi identificado, nesta amostragem, um padrão de query Prisma **sem** `tenantId` nos serviços revistos (`messages.service.ts`, `disposition-feedback` raw SQL com `WHERE "tenantId" = ${tenantId}`). O risco **crítico** de cross-tenant continua sendo **erro humano em novo código** — mitigação: hooks de PR, testes E2E, checklist em code review.

---

## 6. Critérios de go / no-go (técnicos)

**Go condicionado** se, no mínimo:

1. Variáveis obrigatórias em produção preenchidas e validadas (`validateEnv` em `main.ts`: inclui `BACKEND_SERVICE_TOKEN` no backend).
2. Webhooks WhatsApp com `META_APP_SECRET` e assinatura validada em produção; `WHATSAPP_WEBHOOK_VERIFY_TOKEN` definido.
3. AI Service com `BACKEND_SERVICE_TOKEN` forte e rede **não** exposta publicamente (apenas backend/VPC).
4. Revisão explícita de endpoints **`@Public()`** e de controllers sem `@Roles()` onde o negócio exige papel.
5. Plano de **subcontratados** (LLM, Meta) e **minimização** de dados em prompts alinhado ao DPO.

**No-go** até corrigir ou aceitar risco documentado:

- Expor ai-service à internet sem autenticação forte ou sem controlo de rede.
- Deploy com `ENVIRONMENT=development` em produção para o AI Service (token opcional).

---

## 7. Inventário de testes (segurança)

- **Unitários:** vários `*.spec.ts` verificam `tenantId` em chamadas Prisma (ex.: `alerts.service.spec.ts`, `disposition-feedback.service.spec.ts`, `audit-log.interceptor.spec.ts`).
- **Lacuna sugerida:** testes **E2E** ou integração que provem **impossibilidade de leitura cross-tenant** via API (IDs de outro tenant → 404/403) para rotas críticas (`/patients`, `/messages`, etc.).

---

## 8. Plano strict (Tasks 1–9 — subagentes)

Ordem sugerida para execução futura por especialistas:

1. **seguranca-compliance** — Matriz LGPD e superfície global  
2. **backend-nestjs** — API, guards, Prisma, erros  
3. **frontend-nextjs** — cliente, cookies, middleware  
4. **database-engineer** — schema, índices, raw SQL  
5. **ai-service** — LLM, logs, token, CORS  
6. **devops** — CI/CD, compose, segredos  
7. **whatsapp-integration** — webhooks, canal  
8. **test-generator** — gaps de testes de segurança  
9. **documentation** — consolidar (este documento evolui como linha de base)

---

## 9. Próximos passos (pós-relatório)

1. Priorizar F-01, F-02, F-03, F-05 com dono de produto/segurança.  
2. Workshop **DPO + engenharia**: bases legais, RIPD, retenção, transferência internacional LLM.  
3. Opcional: pen-test focado em **multi-tenant** e **webhooks**.  
4. Reavaliar após implementações — nova revisão de relatório (versão incrementada).

---

## 10. Referências de ficheiros (auditoria)

- `backend/src/main.ts` — CORS, Helmet, `validateEnv`, filtros globais  
- `backend/src/app.module.ts` — `ThrottleGuard`, `JwtAuthGuard`, `AuditLogInterceptor`  
- `backend/src/auth/guards/roles.guard.ts` — comportamento quando não há `@Roles()`  
- `backend/src/audit-log/audit-log.interceptor.ts` — sanitização e audit VIEW  
- `backend/src/channel-gateway/channel-gateway.controller.ts` — webhook WhatsApp  
- `frontend/src/middleware.ts` — validação JWT de rota  
- `ai-service/src/auth.py` — `BACKEND_SERVICE_TOKEN`  
- `.github/workflows/ci.yml` — pipelines e audits com `continue-on-error`

---

*Documento gerado na fase 1 (auditoria leitura). Alterações de código devem seguir priorização explícita após este relatório.*
