# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev            # Hot-reload dev server on :3002
npm run start:dev:https      # With SSL (USE_HTTPS=true)

# Tests
npm test                     # Run all tests
npm run test:watch           # Watch mode
npm run test:cov             # With coverage (outputs to coverage/)
npm run test:e2e             # E2E tests

# Run a single test file
npx jest src/auth/auth.service.spec.ts
# Run tests matching a name pattern
npx jest --testNamePattern "should lock account"

# Database
npm run prisma:migrate       # Apply migrations (dev)
npm run prisma:seed          # Seed test data
npm run prisma:studio        # Prisma GUI editor

# Build & code quality
npm run build                # Compile TypeScript to dist/
npm run lint                 # ESLint check
npm run lint:fix             # ESLint auto-fix
npm run type-check           # tsc --noEmit
```

When making changes, prefer validating with:

```bash
npm run type-check
npm run lint
npm test
npm run build
```

Run `npm run test:e2e` when changing API behavior, auth flows, guards, WebSocket behavior, or integration paths.

Do not claim code is correct unless it has been validated by the relevant commands or you explicitly state what remains unverified.

## How to work in this repo

### Before changing code
- Read the relevant service, its controller, its DTOs, and any guards applied to the controller
- Trace `tenantId` from the JWT claim through the controller param to **every** Prisma `where` clause — including `update()` and `delete()` calls
- Identify whether the change affects auth, tenant isolation, data integrity, or LGPD-sensitive flows
- Preserve existing architecture unless there is a clear, justified improvement
- Prefer small, targeted diffs over speculative rewrites

### When proposing changes
- Explain the root cause, not just the symptom
- Align with existing NestJS, Prisma, and validation patterns already used in the repo
- Avoid introducing new dependencies or abstractions unless clearly justified
- Call out migration risk, data integrity risk, and security risk where relevant

### When performing a technical assessment
- Identify architecture strengths and weaknesses
- Distinguish correctness, security, data integrity, and maintainability risks
- Separate findings into Critical, High, Nice-to-Have, and Future Feature tasks
- Propose a phased execution plan before implementation
- Prefer evidence from the codebase over assumptions

## Architecture

NestJS 11 + Prisma 6 + Redis (ioredis) + Socket.io. The codebase follows a strict layered request flow:

```
ThrottleGuard → JwtAuthGuard → TenantGuard → RolesGuard
  → ValidationPipe → Controller → Service → Prisma
    → AuditLogInterceptor (async, global on mutations)
    → LoggingInterceptor (global, correlation ID)
```

### Module structure

Each feature is a self-contained NestJS module (`*.module.ts`) with a controller, service, and `dto/` subdirectory. The module declares what it provides and exports to other modules.

Circular dependencies (e.g. `patients` ↔ `oncology-navigation`) are resolved with `forwardRef()`. Treat `forwardRef()` as a warning sign worth reviewing during assessments; use it only where necessary.

#### Rules
- Keep controllers thin: route, validate, extract `@CurrentUser()`, delegate to service
- Keep business logic in services
- Avoid leaking domain logic across module boundaries
- Prefer existing module patterns over new cross-cutting abstractions

### Global middleware stack

Configured in `app.module.ts` and `main.ts`:

| Layer | Scope | Notes |
|-------|-------|-------|
| `ThrottleGuard` | Global | Redis primary, in-memory fallback. 100 req/min default, 10 req/min on auth routes |
| `JwtAuthGuard` | Global | `@Public()` bypasses. Re-fetches user from DB on every request |
| `AuditLogInterceptor` | Global | POST/PUT/PATCH/DELETE only, async via `setImmediate`, tenant-scoped |
| `LoggingInterceptor` | Global | Correlation ID via `x-request-id` header |
| `PrismaExceptionFilter` | Global | Maps Prisma errors to HTTP codes, never leaks DB details |
| `HttpExceptionFilter` | Global | Catches all NestJS HTTP exceptions |
| `ValidationPipe` | Global | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |

`TenantGuard` and `RolesGuard` are **per-controller**, not global. Every protected controller must declare `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)`.

### Multi-tenancy — critical invariant

Every database query **must** include `tenantId` in the `where` clause — **including `update()` and `delete()` calls**, not only `findFirst`/`findMany`. A preceding existence check does not make the subsequent write safe because the two operations are non-atomic.

```typescript
// Controller: always extract tenantId from JWT, never from request body
@Patch(':id')
update(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdatePatientDto,
  @CurrentUser() user: User,
) {
  return this.patientsService.update(id, dto, user.tenantId);
}

// Service: tenantId in EVERY Prisma call — reads AND writes
async update(id: string, dto: UpdatePatientDto, tenantId: string) {
  return this.prisma.patient.update({
    where: { id, tenantId }, // ← both required; never where: { id } alone
    data: dto,
  });
}
```

#### Rules
- Never write `where: { id }` alone on `update()` or `delete()` — always include `tenantId`
- Never trust tenant identifiers from the client body, query params, or path — use auth context only
- Every read/write/delete query must be tenant-scoped unless data is explicitly global
- Be careful with `findUnique`: do not use it for tenant-scoped access unless the unique constraint itself is tenant-safe
- Review WebSocket room joins, background alerts, and scheduled side effects for tenant leakage risk
- Write cross-tenant access tests for every service that touches patient data

### Auth & guards

**JWT payload structure:**
```typescript
interface JwtPayload {
  sub: string;    // userId
  email: string;
  tenantId: string;
  role: string;
}
```

`JwtStrategy.validate()` re-fetches the user from the database on every request — deleted users and role changes take effect immediately without token rotation.

**Token lifecycle:**
- Access token: 24h JWT, stateless
- Refresh token: 7d, stored in Redis as `rt:<token> → userId` (one-time use, rotated on each refresh)
- Account lockout: 5 failed attempts → 15-min lock at `auth:locked:<email>`, using atomic `MULTI/EXEC`
- Password reset: `prt:<token> → userId`, 1h TTL, one-time use

**Guard order per protected controller:**
1. `JwtAuthGuard` — validates Bearer token, attaches `req.user`
2. `TenantGuard` — asserts `req.user.tenantId` exists
3. `RolesGuard` — checks `@Roles()` decorator; permits all if no decorator present

**Public endpoints** use `@Public()`. These must be explicitly listed and reviewed — the default is protected.

#### Rules
- Preserve the guard order; never weaken auth or tenant enforcement for convenience
- Keep token parsing, refresh, and lockout behavior centralized in `AuthService`
- Ensure role checks happen after authenticated user context is established
- Review refresh-token storage, invalidation, and replay risk during assessments

### WebSocket gateways

Gateways live in `src/gateways/` with two namespaces: `/alerts` and `/messages`.

**Connection auth flow:**
1. Extract JWT from `handshake.auth.token` or `Authorization: Bearer` header
2. Verify with `jwtService.verify()` using `JWT_SECRET`
3. In production (`NODE_ENV=production`), reject the connection if `JWT_SECRET` is not configured — never fall back to a hardcoded secret
4. `client.join(`tenant:${tenantId}`)` and `client.join(`user:${userId}`)`

**Patient-room subscriptions** (`subscribe_patient_alerts`, `subscribe_patient_messages`) must verify the patient belongs to the tenant via a DB lookup before joining the room. Client-supplied `patientId` is untrusted:

```typescript
// Required pattern — both gateways
const patient = await this.prisma.patient.findFirst({
  where: { id: data.patientId, tenantId: client.tenantId },
});
if (!patient) return { error: 'Forbidden' };
client.join(`patient:${data.patientId}:tenant:${client.tenantId}`);
```

#### Rules
- Both gateways must reject connections in production if `JWT_SECRET` is absent
- Patient subscriptions require a DB ownership check — never trust client-supplied IDs
- All emitted events should carry a stable `eventId` (UUID) so clients can deduplicate on reconnect
- All socket joins and broadcasts must preserve tenant isolation
- Keep event handling idempotent; avoid duplicate emits from reconnect races

### Alerts

`src/alerts/` auto-generates alerts from: critical symptoms in WhatsApp messages, overdue `NavigationStep` records, no-response from check-ins, treatment delays.

**Lifecycle:** `PENDING → ACKNOWLEDGED → RESOLVED | DISMISSED`

**Alert creation requires a deduplication check:**
```typescript
const existing = await this.prisma.alert.findFirst({
  where: { patientId, type, tenantId, status: { in: ['PENDING', 'ACKNOWLEDGED'] } },
});
if (existing) return existing; // never create a duplicate open alert
```

**Status transitions use a conditional update to prevent race conditions:**
```typescript
// alerts.service.ts uses this pattern for all status-changing updates
const { count } = await this.prisma.alert.updateMany({
  where: { id, tenantId, status: existingAlert.status }, // atomic precondition
  data: updateData,
});
if (count === 0) throw new ConflictException('Alert status was modified concurrently.');
```

#### Rules
- Never create an alert without checking for an existing open alert of the same type for the same patient
- Status transitions must be validated for direction — `RESOLVED → ACKNOWLEDGED` is not a valid transition
- Alert update and delete operations must include `tenantId` in the WHERE clause (same as all writes)
- Background alert generation must not produce race conditions or duplicate alerts on retry
- Be careful that socket emits happen after the write is confirmed, not before

### Prisma patterns

```typescript
// Inject PrismaService via constructor
constructor(private readonly prisma: PrismaService) {}

// Reads — always tenant-scoped
const patient = await this.prisma.patient.findFirst({
  where: { id, tenantId },
  include: { cancerDiagnoses: true },
});

// Writes — tenantId in WHERE on update/delete too
await this.prisma.patient.update({
  where: { id, tenantId },
  data: dto,
});

// Multi-step writes — use transactions
await this.prisma.$transaction(async (tx) => {
  const patient = await tx.patient.create({ data: { ...dto, tenantId } });
  await tx.patientJourney.create({ data: { patientId: patient.id, tenantId } });
});
```

After modifying `prisma/schema.prisma`, run `npm run prisma:migrate` then `npx prisma generate`.

#### Rules
- Use `PrismaService` as the standard data access layer — no raw SQL unless clearly necessary and security-reviewed
- Every tenant-scoped query must include `tenantId` explicitly, including `update()` and `delete()`
- Use transactions for multi-step writes that must succeed or fail atomically
- Keep `include`/`select` intentional — avoid unbounded includes; always add a `take` limit to any nested `findMany`
- Be cautious with bulk updates and deletes

### Data protection (LGPD)

- CPF and phone numbers are encrypted at the application layer before storage
- Phone is additionally SHA-256 hashed (`phoneHash`) for indexed lookups without decryption
- `AuditLogInterceptor` records all HTTP mutations globally (async via `setImmediate`)
- Auth events (login, password reset, token refresh) must be audited explicitly in `AuthService` — the interceptor does not cover them
- Audit logs must be retained for 5 years

#### Rules
- Treat encrypted fields, hashes, and audit behavior as critical compliance boundaries
- Never log raw sensitive data (CPF, phone, tokens, encryption keys)
- Review whether sensitive fields can leak through DTOs, logs, exceptions, WebSocket payloads, or test fixtures
- The audit log sanitizer strips only 4 field names and does not recurse — extend it when adding new sensitive fields
- Flag any mutation path that can bypass audit logging
- For LGPD-critical mutations (PHI updates, deletes), prefer synchronous audit writes over `setImmediate`

### DTOs & validation

All request bodies must use class-validator decorated DTOs. The global `ValidationPipe` rejects undeclared properties. All route params that are UUIDs must use `ParseUUIDPipe`.

```typescript
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) { ... }

@Post(':patientId/alerts')
create(@Param('patientId', ParseUUIDPipe) patientId: string) { ... }
```

#### Rules
- Validate all external input at the boundary
- Use `ParseUUIDPipe` for every UUID path parameter without exception
- Avoid accepting loosely typed bodies and validating manually later
- Keep DTOs focused on transport/input validation, not domain behavior

### AI agent / LLM integration

`src/agent/` manages per-tenant `AgentConfig` records (provider, model). The AI service at `AI_SERVICE_URL` is called via `fetch` with a 120-second `AbortSignal`. On timeout, non-200 status, or parse failure, `callAIService` returns `null`.

```typescript
// Correct fallback pattern — always handle null
const aiResponse = await this.callAIService(payload);
if (!aiResponse) {
  await this.sendFallbackMessage(conversation); // never leave patient without reply
  return;
}
```

#### Rules
- Preserve tenant isolation for agent configuration and request routing — all clinical context queries include `tenantId`
- Always handle a `null` AI response explicitly; never let a null propagate silently through a workflow
- Do not shorten the 120s timeout without profiling the multi-agent pipeline — it is legitimately slow
- Be explicit about mock vs real AI behavior in tests

### Error handling & exceptions

#### Rules
- Prefer explicit, typed NestJS exceptions (`NotFoundException`, `ForbiddenException`, `ConflictException`, etc.) over generic thrown errors
- Never leak database error details, internal stack traces, or Prisma error codes to API consumers — `PrismaExceptionFilter` handles mapping
- Ensure exceptions inside transactions, async flows, gateways, and interceptors fail safely
- During assessments, look for swallowed errors, inconsistent exception mapping, and silent fallback behavior

### Config and environment variables

Do not access `process.env` directly in services or controllers — use `this.configService.get<string>('KEY')`. Do not mutate `process.env` at runtime.

Do not ship hardcoded fallback values for secrets (`JWT_SECRET`, `ENCRYPTION_KEY`, `META_APP_SECRET`). The service should refuse to start if required keys are absent.

Key variables:

| Variable | Purpose | Required in prod |
|----------|---------|-----------------|
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `JWT_SECRET` | JWT signing key | Yes |
| `ENCRYPTION_KEY` | AES-256 key for PHI | Yes |
| `REDIS_URL` | Redis connection | Yes |
| `AI_SERVICE_URL` | FastAPI AI service base URL | Yes |
| `FRONTEND_URL` | CORS allowed origin | Yes |
| `META_APP_ID` / `META_APP_SECRET` | WhatsApp Business API | If WhatsApp enabled |

#### Rules
- Keep env var usage centralized and typed via `ConfigService`
- Flag missing defaults, dead vars, and env-dependent branching that changes behavior unexpectedly
- Be careful with fallback values that mask broken configuration in production

### Redis key namespaces

| Prefix | Purpose | TTL |
|--------|---------|-----|
| `auth:failed:<email>` | Failed login attempt counter | 15 min |
| `auth:locked:<email>` | Account lockout flag | 15 min |
| `rt:<token>` | Refresh token → userId | 7 days |
| `prt:<token>` | Password reset token → userId | 1 hour |
| `throttle:<ip>:<route>` | Rate limit counter | 60 sec |

Use `redisService.increment()` (atomic `MULTI/EXEC`) for any counter with a race condition. Do not use plain `GET` + `SET` pairs for counters.

### Side effects, idempotency, and ordering

#### Rules
- Identify side effects triggered by writes: socket emits, alert creation, AI calls, audit logging, scheduled actions
- Perform the database write first, then emit WebSocket events — never emit before the write is confirmed
- Prefer idempotent behavior for retry-prone flows (scheduled check-ins, alert creation, FHIR sync)
- Flag race conditions and duplicate-processing risk in event-driven and cron-driven flows

### Observability

#### Rules
- Logs should help trace auth, tenant, alert, WebSocket, and AI flows without leaking secrets or regulated data
- Use NestJS `Logger` — never `console.log` in services or controllers
- Flag missing logging around critical workflows: login lockouts, refresh failures, alert generation failures, AI service errors
- Preserve audit logging separately from operational logging

## Testing

Tests live alongside source files as `*.spec.ts`. The global setup in `test/setup.ts` sets `NODE_ENV=test` and stubs required environment variables.

Coverage thresholds: 70% branches / functions / lines / statements.

### What to test

- **Service unit tests** — mock all Prisma calls and external services; test the business logic paths
- **Security tests** — every service touching tenant-scoped data must assert that a cross-tenant access attempt returns null or throws (not just tests with matching tenant IDs)
- **Auth flow tests** — test lockout, token rotation, and failure paths explicitly

### What NOT to test

- Prisma's own query builder behavior
- NestJS guard/interceptor wiring in unit tests (cover via e2e)

### Patterns

```typescript
const mockPrisma = {
  patient: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
};

beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      PatientsService,
      { provide: PrismaService, useValue: mockPrisma },
    ],
  }).compile();
  service = module.get(PatientsService);
  jest.clearAllMocks();
});

// Always include a cross-tenant isolation test
it('should not update a patient belonging to another tenant', async () => {
  mockPrisma.patient.update.mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '',
    }),
  );

  await expect(service.update('patient-id', dto, 'wrong-tenant-id')).rejects.toThrow();
});
```

#### Rules
- Prefer tests that validate business behavior and security invariants, not implementation details
- Add or update tests when changing auth, tenant isolation, DTO validation, alert logic, Prisma query paths, or AI fallback logic
- Use e2e tests when changing critical request flows, auth/guards, or integration-heavy behavior
- During assessments, evaluate whether current tests truly cover the highest-risk paths — especially cross-tenant access and concurrent state transitions

## Known issues (tracked for resolution)

These are confirmed issues identified during architectural assessment. Do not paper over them with workarounds — fix them properly in the correct phase.

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 1 | **Critical** | `update()` / `delete()` calls missing `tenantId` in `where` clause | `patients.service.ts`, `agent.service.ts`, `alerts.service.ts` | ✅ Fixed |
| 2 | **Critical** | WebSocket patient room subscription has no DB ownership check | `alerts.gateway.ts`, `messages.gateway.ts` | ✅ Fixed |
| 3 | **Critical** | `MessagesGateway` missing production guard when `JWT_SECRET` absent | `messages.gateway.ts` | ✅ Fixed |
| 4 | **High** | No alert deduplication — identical alerts created on concurrent triggers | `alerts.service.ts` | ✅ Fixed |
| 5 | **High** | Alert status transitions are non-atomic read-then-update (race condition) | `alerts.service.ts` | ✅ Fixed |
| 6 | **High** | Dashboard `getMetrics()` has N+1 and in-memory aggregation patterns | `dashboard.service.ts` | 🔲 Open (Phase 5) |
| 7 | **High** | Hardcoded dev DB credentials as fallback; `process.env` mutation in WhatsApp service | `database.config.ts`, `whatsapp-connections.service.ts` | ✅ Fixed |
| 8 | **High** | Audit log missing login events, password reset, and sensitive GET operations | `audit-log.interceptor.ts`, `auth.service.ts` | 🔲 Open (Phase 4) |
| 9 | **High** | No transactional email — `forgotPassword` silently did nothing in production | `auth.service.ts` | ✅ Fixed (throws 501 in prod) |
| 10 | **Nice-to-have** | Missing `ParseUUIDPipe` on `agent.controller.ts` `getPatientSummary` route | `agent.controller.ts` | ✅ Fixed |
| 11 | **Nice-to-have** | `findOne` in patients includes `alerts` with no `take` limit | `patients.service.ts` | ✅ Fixed |
| 12 | **Nice-to-have** | `getTenantClient()` in `PrismaService` is an unimplemented stub | `prisma.service.ts` | 🔲 Open |
| 13 | **Nice-to-have** | `recurrenceRule` field stored but never processed in scheduled actions | `scheduled-actions.service.ts` | 🔲 Open |
| 14 | **Nice-to-have** | `whatsapp-connections.service.ts` mutates `process.env` at runtime | `whatsapp-connections.service.ts` | ✅ Fixed |
