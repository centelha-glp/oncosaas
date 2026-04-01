# architect — Rules & Patterns

Rules derivadas da arquitetura real do ONCONAV: `backend/src/app.module.ts`, estrutura de módulos, padrões cross-layer e decisões de design observadas no código.

---

## 1. Camadas da Aplicação

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + TypeScript) — porta 3000    │
│  App Router, React Query, Zustand, Tailwind         │
├─────────────────────────────────────────────────────┤
│  Backend (NestJS + TypeScript) — porta 3002         │
│  REST API + WebSocket, Prisma ORM, Redis, RabbitMQ  │
├─────────────────────────────────────────────────────┤
│  AI Service (FastAPI + Python) — porta 8001         │
│  Agente conversacional, LightGBM, RAG, FHIR sync   │
├─────────────────────────────────────────────────────┤
│  PostgreSQL 15 | Redis 7 | RabbitMQ 3               │
└─────────────────────────────────────────────────────┘
```

Comunicação entre camadas:
- Frontend → Backend: REST (`/api/v1/`) + WebSocket (Socket.io)
- Backend → AI Service: HTTP interno (`http://ai-service:8001`)
- Backend → PostgreSQL: Prisma ORM
- Backend → Redis: ThrottleGuard + cache de tokens
- AI Service → Backend: não chama diretamente (apenas retorna `actions`)

---

## 2. Backend — 33 Módulos Ativos

### Provedores globais (APP_GUARD / APP_INTERCEPTOR)

Registrados em `app.module.ts` — nunca registrar novamente a nível de controller:

| Provider | Classe | Escopo |
|----------|--------|--------|
| `APP_GUARD` | `ThrottleGuard` | Rate limiting por IP via Redis |
| `APP_GUARD` | `JwtAuthGuard` | JWT auth global (skipa `@Public()`) |
| `APP_INTERCEPTOR` | `AuditLogInterceptor` | Audit log em POST/PATCH/PUT/DELETE |

### Módulos globais

| Módulo | Por quê global |
|--------|---------------|
| `RedisModule` | Usado por múltiplos módulos (auth, throttle) sem necessidade de import explícito |
| `PrismaModule` | Disponível globalmente via import explícito em cada módulo que precisa |

### Padrão de dependência circular

Usar `forwardRef()` apenas quando dependência circular é inevitável. Existente no projeto:

```typescript
// PatientsModule usa OncologyNavigationService
// OncologyNavigationModule usa PatientsService
PatientsModule.imports.push(forwardRef(() => OncologyNavigationModule));
OncologyNavigationModule.imports.push(forwardRef(() => PatientsModule));
```

Antes de usar `forwardRef()`, investigar se o design pode ser refatorado para eliminar a circular.

---

## 3. Como Adicionar Novo Módulo

Sequência obrigatória:

```
1. Criar estrutura de arquivos
   backend/src/<nome>/
   ├── <nome>.module.ts
   ├── <nome>.controller.ts
   ├── <nome>.service.ts
   ├── dto/
   │   ├── create-<nome>.dto.ts
   │   └── update-<nome>.dto.ts
   └── <nome>.service.spec.ts

2. Module: importar PrismaModule, exportar Service
3. Controller: aplicar guard stack @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
4. Service: injetar PrismaService, logger = new Logger(ClassName.name)
5. Registrar em app.module.ts (imports array)
6. Verificar se precisa ser exportado para outros módulos
```

---

## 4. Contratos entre Camadas

### Backend → AI Service

O backend envia contexto clínico e recebe resposta + actions:

```typescript
// POST http://ai-service:8001/api/v1/agent/process
{
  message: string,
  patient_id: string,
  tenant_id: string,
  clinical_context: { patient, treatments, medications, comorbidities, ... },
  protocol: string | null,
  conversation_history: Message[],
  agent_state: object,
  agent_config: { llm_provider, model, ... }
}

// Response
{
  response: string,
  actions: Action[],      ← executados pelo backend, nunca pelo ai-service
  symptom_analysis: {...},
  new_state: object,
  decisions: {...}
}
```

**Invariante:** `actions` são apenas declarações de intenção — o backend NestJS é o único que executa ações (atualizações de banco, envio de mensagens). O ai-service nunca chama o backend.

### Frontend → Backend

- Autenticação: `Authorization: Bearer <token>` + `X-Tenant-Id: <tenantId>` em todo request.
- WebSocket: JWT no handshake (`auth.token`), rooms isoladas por tenant.
- Erros: formato padronizado `{ statusCode, timestamp, path, method, message }`.

---

## 5. Decisões Arquiteturais Registradas

### Multi-tenancy por `tenantId` na query (Row-Level Security manual)

**Decisão:** `tenantId` em cada query Prisma, não schema-per-tenant.
**Motivo:** Flexibilidade de migração, simplicidade de backup/restore, custo operacional menor.
**Consequência:** Toda query DEVE incluir `tenantId` — omissão é bug crítico de isolamento.

### Triage clínica fora do fluxo LLM

**Decisão:** `clinical_rules.py` é step 2.5, executado antes do LLM, resultado não rebaixável.
**Motivo:** Segurança do paciente — LLMs podem alucinar; regras determinísticas são auditáveis.
**Consequência:** Pipeline tem ordem invariante; adicionar lógica probabilística em `clinical_rules.py` é proibido.

### Actions do agente IA executadas pelo backend

**Decisão:** ai-service retorna `actions` como lista; backend NestJS as executa.
**Motivo:** Centralizar autorização, audit trail e transações no backend tipado.
**Consequência:** ai-service não tem dependência de banco — pode ser substituído/escalado independentemente.

### Fire-and-forget para webhooks WhatsApp

**Decisão:** Webhook responde 200 OK imediatamente; processamento via `setImmediate()`.
**Motivo:** Meta exige resposta em 5 segundos; pipeline de triage pode levar mais que isso.
**Consequência:** Falhas de processamento não são retornadas ao Meta — logging e monitoramento obrigatórios.

### ARM64 para EC2

**Decisão:** EC2 Graviton (ARM64), imagens Docker buildadas para `linux/arm64`.
**Motivo:** ~20% melhor custo/performance que x86 equivalente.
**Consequência:** Todo build de imagem Docker deve especificar `--platform linux/arm64`.

---

## 6. Padrões Cross-Layer Obrigatórios

### Tenant isolation em todas as camadas

| Camada | Como |
|--------|------|
| Frontend | `apiClient` injeta `X-Tenant-Id` em todo request |
| Backend Controller | `@CurrentUser()` extrai `tenantId` do JWT |
| Backend Service | `tenantId` passado como parâmetro explícito |
| Prisma | `where: { ..., tenantId }` em toda query |
| WebSocket | Rooms `tenant:${tenantId}` com verificação DB |
| AI Service | `tenant_id` passado no request body e propagado |

### Erros tipados e tratados globalmente

- `HttpExceptionFilter` — captura `HttpException`, formata resposta padronizada
- `PrismaExceptionFilter` — mapeia erros Prisma → HTTP sem expor stack trace
- Nunca lançar exceções raw fora do padrão NestJS em services

### Sem chamadas diretas entre serviços via HTTP (exceto backend → ai-service)

- Frontend → Backend: único ponto de entrada da API
- Backend → AI Service: único ponto de integração com IA
- Nenhum serviço chama o banco do outro
- Comunicação assíncrona futura: RabbitMQ (já provisionado)

---

## 7. Quando Acionar o Arquiteto

O agente `architect` deve ser consultado antes de:

- Adicionar novo serviço ou processo (ex: worker separado, scheduler externo)
- Alterar a interface entre backend e ai-service
- Modificar o mecanismo de multi-tenancy
- Adicionar dependência de terceiros com impacto cross-layer
- Decisão sobre comunicação síncrona vs assíncrona para novo fluxo
- Refatoração que afeta 3 ou mais módulos simultaneamente
- Mudança de estratégia de deploy ou infraestrutura

---

## 8. O Que NUNCA Fazer sem Revisão Arquitetural

- **Nunca** fazer o ai-service chamar o banco de dados PostgreSQL diretamente.
- **Nunca** fazer o ai-service chamar endpoints do backend para executar actions.
- **Nunca** adicionar lógica de triage clínica no backend (somente ai-service).
- **Nunca** adicionar state global mutável compartilhado entre requests no backend (NestJS é stateless por design).
- **Nunca** criar dependência circular entre módulos sem `forwardRef()` e sem documentar o motivo.
- **Nunca** alterar a ordem de guards globais (`ThrottleGuard` → `JwtAuthGuard`).
- **Nunca** remover `AuditLogInterceptor` do escopo global.
- **Nunca** expor banco de dados diretamente ao frontend (sempre via API backend).
