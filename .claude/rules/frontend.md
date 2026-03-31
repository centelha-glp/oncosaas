# Frontend Rules — Next.js 15 / React Query / Zustand / ONCONAV

Regras baseadas no código real em `frontend/src/`. Refletem os padrões observados no codebase.

---

## 1. Arquitetura em Três Camadas

O fluxo de dados segue uma hierarquia estrita:

```
API Client (src/lib/api/) → Hooks (src/hooks/) → Components (src/components/)
```

Nunca pular camadas: componentes não chamam `apiClient` diretamente; hooks não renderizam UI.

---

## 2. Layer 1 — API Client (`src/lib/api/`)

### apiClient — singleton Axios

`src/lib/api/client.ts` expõe o singleton `apiClient`. Comportamentos embutidos:
- **JWT injection**: header `Authorization: Bearer <token>` em toda requisição autenticada
- **Multi-tenancy**: header `X-Tenant-Id` em toda requisição, lido do estado interno do cliente
- **Silent token refresh**: em 401, tenta refresh com o `refresh_token` serializado (fila de retry para evitar chamadas duplicadas). Se o refresh falhar, chama `clearAuth()` e redireciona para `/login`
- **Cookies de sessão**: `auth_token` e `session_active` são mantidos via `document.cookie` para que o middleware Next.js possa validar a sessão server-side
- Tokens armazenados em `localStorage`: `auth_token`, `refresh_token`, `tenant_id`, `user`

### Regras do API Client

- **Nunca bypassar `apiClient`** para requisições autenticadas ao backend
- **Nunca enviar requisição tenant-scoped sem `X-Tenant-Id`** — o cliente injeta automaticamente se `tenantId` estiver setado
- Centralizar comportamento de auth/header/refresh em `client.ts`, não duplicar em hooks ou componentes
- Todo módulo de API de domínio (`patients.ts`, `alerts.ts`, etc.) deve usar `apiClient` e retornar tipos explícitos

### Módulos de API de domínio

```typescript
// src/lib/api/patients.ts — padrão de módulo de API
import { apiClient } from './client';
import { Patient, CreatePatientDto } from './types';

export const patientsApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<Patient[]>('/patients', { params }),
  findOne: (id: string) =>
    apiClient.get<Patient>(`/patients/${id}`),
  create: (dto: CreatePatientDto) =>
    apiClient.post<Patient>('/patients', dto),
  update: (id: string, dto: Partial<CreatePatientDto>) =>
    apiClient.patch<Patient>(`/patients/${id}`, dto),
  remove: (id: string) =>
    apiClient.delete<void>(`/patients/${id}`),
};
```

---

## 3. Layer 2 — React Query Hooks (`src/hooks/`)

### Padrões de query

```typescript
// useQuery — leitura
export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: () => patientsApi.findAll(),
    staleTime: 60_000, // padrão global 60s
  });
}

// useMutation — mutação com invalidação
export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePatientDto) => patientsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
```

### Query keys

Usar arrays tipados e previsíveis:
- Lista: `['patients']`
- Item: `['patients', patientId]`
- Sub-recurso: `['patients', patientId, 'alerts']`
- Com filtros: `['patients', { status, search }]`

### Optimistic updates

Usar apenas em `useMessages.ts` e quando o rollback é seguro e explícito:

```typescript
onMutate: async (newMessage) => {
  await queryClient.cancelQueries({ queryKey: ['messages'] });
  const previous = queryClient.getQueryData(['messages']);
  queryClient.setQueryData(['messages'], (old) => [...old, newMessage]);
  return { previous };
},
onError: (_, __, context) => {
  queryClient.setQueryData(['messages'], context.previous);
},
```

### Regras de React Query

- React Query é a fonte de verdade para server state
- **Nunca copiar dados do React Query para Zustand ou estado local** sem razão forte
- Preferir invalidação de query ou atualização de cache direcionada sobre refetch ad hoc
- Usar optimistic updates somente quando rollback é explícito

---

## 4. Layer 3 — Componentes (`src/components/`)

### Estrutura de componentes

```
components/
├── ui/           # Wrappers Radix UI + Tailwind (Button, Dialog, Card, etc.)
├── dashboard/    # Painéis do dashboard divididos em:
│   ├── oncologist/
│   ├── nurse/
│   └── shared/
├── patients/     # Formulários CRUD e listagens de pacientes
└── shared/       # NavigationBar e componentes globais
```

### Regras de componentes

- Componentes renderizam UI e delegam acesso a dados para hooks
- **Não buscar dados diretamente em leaf components** se já existe um hook no repositório
- Separar presentação e orquestração
- Compor primitivos UI existentes antes de criar novos

### Server vs Client Components

- **Preferir Server Components** por padrão quando interatividade não é necessária
- Usar `"use client"` apenas quando necessário: APIs do browser, event handlers, estado local interativo, refs/effects, bibliotecas client-only
- Manter client boundaries estreitas — não marcar árvores inteiras como client desnecessariamente

---

## 5. Zustand — Estado de Autenticação

### auth-store

`src/stores/auth-store.ts` — única fonte de verdade para auth/sessão:

```typescript
// State shape
{
  user: User | null,
  token: string | null,
  isAuthenticated: boolean,
  isInitializing: boolean,
}

// Actions: login(), logout(), registerInstitution(), setUser(), setToken(), initialize()
```

**Inicialização:** `initialize()` deve ser chamado uma vez no layout raiz. Verifica token em `localStorage`, tenta refresh silencioso se expirado.

**Sincronização com apiClient:** `apiClient.onTokenRefreshed()` é registrado a nível de módulo para sincronizar o token após refresh silencioso — nunca registrar dentro de hooks/componentes (acumularia listeners).

### Regras de Zustand

- Zustand é para auth/sessão — **não usar como store global genérico**
- Server state fica no React Query, UI state local fica no `useState`
- Cuidado com hidratação: `localStorage` só existe no browser — sempre verificar `typeof window !== 'undefined'`
- Toda mudança de auth deve preservar a propagação do `tenantId` para o `apiClient`

---

## 6. Middleware e Roteamento

### Proteção de rotas

`src/middleware.ts` verifica o cookie `session_active` para proteger rotas autenticadas. Redireciona para `/login?redirect=<PATHNAME>` quando ausente.

### Estrutura de rotas (App Router)

```
app/
├── (auth)/          # login, register, forgot/reset password — públicas
├── (public)/        # landing, privacy, terms — públicas
├── dashboard/       # view enfermagem (default), /oncologist, /users
├── patients/        # list + [id]/ detail + [id]/edit
├── chat/            # UI de conversa WhatsApp
├── oncology-navigation/
├── integrations/
└── observability/
```

---

## 7. WebSocket — Hooks de Tempo Real

`src/hooks/useSocket.ts` é o hook base Socket.io. Hooks especializados:
- `useMessagesSocket` — mensagens WhatsApp
- `useAlertsSocket` — alertas clínicos
- `useDashboardSocket` — métricas em tempo real

Padrão: eventos WebSocket atualizam o cache React Query ou disparam invalidação controlada.

### Regras de WebSocket

- Eventos em tempo real devem atualizar cache React Query — nunca estado local paralelo
- Sempre limpar listeners/subscriptions no cleanup do useEffect
- **Evitar duplicate subscriptions** em rerenders
- Cuidado com stale closures em event handlers — usar ref pattern quando necessário
- Manter handlers idempotentes (reconexões podem reenviar eventos)

---

## 8. Validação — Zod + React Hook Form

```typescript
// src/lib/validations/patient.ts
import { z } from 'zod';

export const createPatientSchema = z.object({
  name: z.string().min(2).max(255),
  birthDate: z.string().datetime(),
  cancerType: z.enum(['bladder', ...]),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
```

Usar com React Hook Form:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm<CreatePatientInput>({
  resolver: zodResolver(createPatientSchema),
});
```

**Regras de validação:**
- Schemas Zod ficam em `src/lib/validations/`
- Validação sempre na borda onde dados entram (formulários, imports)
- Não duplicar regras de validação em múltiplas camadas desnecessariamente

---

## 9. Estilização — Tailwind + Design Tokens Médicos

```typescript
// tailwind.config.ts — tokens customizados
colors: {
  medical: {
    blue: ...,   // branding primário
    green: ...,  // branding secundário
  },
  priority: {
    critical: ...,  // alertas críticos
    high: ...,      // alta prioridade
    medium: ...,    // média prioridade
    low: ...,       // baixa prioridade
  }
}
```

**Regras de estilização:**
- Reutilizar design tokens — nunca hardcodar cores de prioridade clínica
- Preservar acessibilidade: contraste de cores, visibilidade de foco
- Evitar padrões de estilo one-off quando existe primitivo/token reutilizável

---

## 10. Testes — Vitest + React Testing Library

```typescript
// Mock do apiClient em testes de hooks/componentes
vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// Wrapper React Query para hooks
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const { result } = renderHook(() => usePatients(), { wrapper });
```

### Localização dos testes

- `src/lib/utils/__tests__/*.test.ts` — utilitários puras
- `src/components/ui/__tests__/*.test.tsx` — primitivos UI
- `src/hooks/__tests__/*.test.ts` — hooks React Query
- `src/stores/__tests__/*.test.ts` — Zustand stores

### O que testar

- Funções utilitárias puras em `src/lib/utils/` — input/output direto
- Hooks: query keys, loading states, error states, mutação + invalidação
- Stores: transições de estado auth (login, logout, refresh)
- Smoke tests de componentes UI: render, eventos, forwarded refs

### O que NÃO testar

- Full page components com múltiplas dependências
- Eventos Socket.io — testados manualmente via backend rodando

### ESLint rules específicas

- `react-compiler`: evitar `setState` síncrono dentro de `useEffect`
- `react-hooks/exhaustive-deps`: refs estáveis (`useRef`) não pertencem a dependency arrays — suprimir com comentário explicativo
- `jsx-a11y/role-has-required-aria-props`: elementos com `role="option"` precisam de `aria-selected`

---

## 11. Variáveis de Ambiente

| Variável | Propósito |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL base da REST API do backend |
| `NEXT_PUBLIC_WS_URL` | URL do WebSocket |

- `NEXT_PUBLIC_*` são embarcadas em build time — não podem ser alteradas em runtime
- Centralizar acesso via `src/lib/utils/api-config.ts`
- Nunca acessar `process.env` diretamente em componentes — usar utilitários

---

## 12. Multi-tenancy no Frontend

Todo request ao backend carrega `X-Tenant-Id` via `apiClient`. O `tenantId` é propagado na sequência:

```
login() → authApi → apiClient.setTenantId(tenantId) → header X-Tenant-Id em toda requisição
```

**Regras:**
- Nunca bypassar esta propagação
- Em restauração de sessão (refresh/reload), garantir que `apiClient.setTenantId` é chamado antes de qualquer request
- Cuidado com ordem de inicialização: `initialize()` do auth store deve completar antes de qualquer fetch tenant-scoped

---

## 13. O Que NUNCA Fazer

- **Nunca `console.log` em código de produção.** Usar ferramentas de observabilidade (`src/hooks/useObservability.ts`).
- **Nunca bypassar `apiClient`** para requests autenticados.
- **Nunca copiar server state do React Query para Zustand** sem razão forte.
- **Nunca usar Zustand como store global** para server state — esse papel é do React Query.
- **Nunca marcar árvores grandes como `"use client"`** desnecessariamente.
- **Nunca acessar `localStorage` sem verificar `typeof window !== 'undefined'`** (SSR).
- **Nunca hardcodar cores de prioridade clínica** — usar tokens `priority.*`.
- **Nunca registrar `apiClient.onTokenRefreshed()` dentro de componentes/hooks** — registrar a nível de módulo.
- **Nunca emitir ou escutar eventos WebSocket sem cleanup** no `useEffect`.
- **Nunca criar validação Zod duplicada** para o mesmo schema em múltiplos arquivos.
