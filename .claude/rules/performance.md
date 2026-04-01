# performance — Rules & Patterns

Rules derivadas dos padrões reais de performance observados no ONCONAV. Aplica-se a otimizações em `backend/src/`, `frontend/src/` e `ai-service/`.

---

## 1. Backend — Queries Prisma

### Proibição de N+1

**Nunca** buscar entidades em loop. Usar `include` direcionado:

```typescript
// ERRADO — N+1
const patients = await this.prisma.patient.findMany({ where: { tenantId } });
for (const p of patients) {
  p.alerts = await this.prisma.alert.findMany({ where: { patientId: p.id } });
}

// CORRETO — uma query
const patients = await this.prisma.patient.findMany({
  where: { tenantId },
  include: {
    alerts: { take: 10, orderBy: { createdAt: 'desc' } },
  },
});
```

### `take` obrigatório em arrays aninhados

Toda relação `include` que resulta em array **deve** ter `take` explícito:

| Contexto | Limite sugerido |
|----------|----------------|
| Alertas por paciente | `take: 10–50` |
| Mensagens por conversa | `take: 20–50` |
| Histórico de status | `take: 10` |
| Sync FHIR em lote | `take: 50` |
| Bulk scheduling | `take: 50` |

Nunca incluir arrays sem limite em endpoints de listagem — risco de OOM.

### `select` em vez de `include` para listagens

Quando o endpoint retorna listas grandes, usar `select` para projetar apenas os campos necessários:

```typescript
// Listagem de pacientes — somente campos exibidos no dashboard
const patients = await this.prisma.patient.findMany({
  where: { tenantId },
  select: {
    id: true,
    name: true,
    priorityCategory: true,
    currentStage: true,
    lastMessageAt: true,
  },
});
```

### Aggregations no banco, não em memória

Usar `groupBy` e `_count` do Prisma para cálculos de dashboard:

```typescript
// CORRETO — aggregation no PostgreSQL
const countsByCategory = await this.prisma.patient.groupBy({
  by: ['priorityCategory'],
  where: { tenantId },
  _count: { _all: true },
});

// ERRADO — aggregation em memória
const patients = await this.prisma.patient.findMany({ where: { tenantId } });
const counts = patients.reduce(...); // não fazer isso
```

### Paginação obrigatória

Todo endpoint de listagem pública deve suportar paginação:

```typescript
async findAll(tenantId: string, page = 1, limit = 20) {
  const take = Math.min(limit, 100); // cap em 100
  const skip = (page - 1) * take;
  return this.prisma.patient.findMany({
    where: { tenantId },
    take,
    skip,
    orderBy: { createdAt: 'desc' },
  });
}
```

---

## 2. Backend — Cache Redis

### O que cachear com Redis

| Dado | TTL sugerido | Chave |
|------|-------------|-------|
| Contadores de login failed | 15 min (lockout) | `auth:failed:<email>` |
| Token de reset de senha | 1 hora | `prt:<token>` |
| Refresh token | 7 dias | `rt:<token>` |
| Rate limit por IP | 1 min (janela) | `rl:<ip>:<path>` |

### Contadores atômicos

Usar `MULTI/EXEC` (via `redisService.increment()`) para incrementar contadores — nunca `GET` + `SET` separados:

```typescript
// CORRETO — atômico
await this.redisService.increment(`auth:failed:${email}`, 1, 900); // TTL 15min

// ERRADO — race condition
const count = await this.redisService.get(`auth:failed:${email}`);
await this.redisService.set(`auth:failed:${email}`, count + 1);
```

### O que NÃO cachear

- Dados clínicos dinâmicos de pacientes (consultar banco sempre)
- Listas de pacientes (React Query é suficiente)
- Resultados de triage (nunca cachear decisão clínica)

---

## 3. Frontend — React Query

### `staleTime` por tipo de dado

| Dado | `staleTime` | `refetchInterval` |
|------|------------|-------------------|
| Métricas de dashboard | 2 min | 2 min (auto-refetch) |
| Estatísticas de dashboard | 5 min | — |
| Lista de pacientes | 5 min | — |
| Detalhes de paciente | 1 min | — |
| Configurações de tenant | 10 min | — |
| Dados estáticos (protocolos) | 30 min | — |

```typescript
useQuery({
  queryKey: ['dashboard', 'metrics', params],
  queryFn: () => dashboardApi.getMetrics(params),
  staleTime: 2 * 60 * 1000,
  refetchInterval: 2 * 60 * 1000,
});
```

### Query keys hierárquicas

```typescript
['patients']                          // lista global
['patients', patientId]               // paciente específico
['patients', patientId, 'alerts']     // sub-recurso
['patients', { status, search }]      // lista com filtros
['dashboard', 'metrics', { period }]  // dashboard com parâmetros
```

### Invalidação cirúrgica

Após mutação, invalidar apenas as queries afetadas — nunca invalidar tudo:

```typescript
// CORRETO
queryClient.invalidateQueries({ queryKey: ['patients'] });
queryClient.invalidateQueries({ queryKey: ['patients', patientId] });

// ERRADO — invalida cache inteiro
queryClient.invalidateQueries();
```

### Otimistic updates — somente onde rollback é seguro

Usar apenas em `useMessages.ts` e casos com rollback explícito. Nunca em dados clínicos críticos.

---

## 4. Frontend — Bundle Size

### Code splitting automático (Next.js App Router)

O App Router já faz code splitting por rota. Não é necessário `React.lazy()` para páginas.

Usar `dynamic()` somente para componentes pesados carregados condicionalmente:

```typescript
// Para componentes de gráfico (Recharts/Chart.js — pesados)
const PatientChart = dynamic(() => import('@/components/charts/PatientChart'), {
  loading: () => <Skeleton />,
  ssr: false, // somente se o componente usar APIs do browser
});
```

### Server Components primeiro

Preferir Server Components (padrão no App Router) para reduzir JavaScript enviado ao cliente. Marcar `"use client"` apenas quando necessário:
- Event handlers (`onClick`, `onChange`)
- Hooks (`useState`, `useEffect`, `useQuery`)
- APIs do browser (`localStorage`, `window`)

Nunca marcar layouts ou páginas inteiras como `"use client"` se apenas um componente filho precisa.

### Imports nomeados em vez de default para bibliotecas grandes

```typescript
// CORRETO — tree-shaking funciona
import { format } from 'date-fns';
import { clsx } from 'clsx';

// ERRADO — importa tudo
import * as dateFns from 'date-fns';
```

---

## 5. AI Service — Performance

### Inicialização única de modelos

Modelos LightGBM e índice FAISS são carregados uma vez no startup como singletons:

```python
# priority_model.py — singleton global
priority_model = OncologyPriorityModel()
priority_model.load()  # carrega .joblib ou treina sintético

# knowledge_base.py — singleton global
knowledge_base = OncologyKnowledgeBase()
knowledge_base.initialize()  # carrega FAISS index
```

Nunca recarregar modelos por requisição — custo proibitivo.

### Fallback rápido sem LLM

Quando `llm_provider.has_any_llm_key()` retorna `False`, o pipeline não chama LLM e responde imediatamente com `_fallback_response()`. Layers 1 (clinical rules) e 3 (ML) continuam funcionando normalmente.

### `has_any_llm_key()` — não chamar em loops

Este método re-lê o `.env` a cada chamada. Nunca chamar dentro de loops de processamento — chamar uma vez por requisição.

---

## 6. Monitoramento de Performance

### Métricas a observar

| Métrica | Limite de alerta |
|---------|-----------------|
| Tempo de resposta API backend | > 500ms p95 |
| Tempo de resposta ai-service (triage) | > 3s p95 |
| Tamanho do bundle frontend | > 200KB (first load JS) |
| Queries Prisma lentas | > 100ms |
| Cache hit rate Redis (rate limiting) | < 80% |

### Ferramentas disponíveis

- Backend: `LoggingInterceptor` loga método, URL, status e duração por request
- Frontend: `useObservability.ts` hook para métricas customizadas
- AI Service: `AgentTracer` com spans por step do pipeline

---

## 7. O Que NUNCA Fazer

- **Nunca** fazer query `findMany` sem `tenantId` em endpoint público.
- **Nunca** incluir array aninhado sem `take` em endpoints de listagem.
- **Nunca** fazer aggregation em memória quando PostgreSQL pode fazer no banco.
- **Nunca** usar `GET` + `SET` separados para contadores no Redis.
- **Nunca** cachear decisões clínicas de triage.
- **Nunca** invalidar todo o cache React Query após uma mutação.
- **Nunca** usar `"use client"` em layouts completos — manter server components.
- **Nunca** recarregar modelos ML por requisição.
- **Nunca** chamar `has_any_llm_key()` dentro de um loop de mensagens.
- **Nunca** retornar lista sem paginação em endpoint de produção (risco de timeout e OOM).
