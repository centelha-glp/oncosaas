# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Start with Turbopack (port 3000)
npm run dev:https        # Start with HTTPS (for OAuth/webhook testing)
npm run build            # Production build
npm run start            # Serve production build

# Code quality
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check (no write)
npm run type-check       # TypeScript check (no emit)

# Tests (Vitest + React Testing Library)
npm test                 # Run all tests once
npm run test:watch       # Watch mode
npm run test:cov         # Run with coverage
```

When making changes, prefer validating with:

```bash
npm run type-check
npm run lint
npm test
npm run build
```

Do not claim code is correct unless it has been validated by the relevant commands or you explicitly state what remains unverified.

## Testing

Tests use **Vitest** + **React Testing Library**. Config lives in `vitest.config.ts`. Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom`).

### What to test

- **Unit tests** — pure utility functions in `src/lib/utils/` and pure classes in `src/lib/api/` need no mocking. Write straightforward input/output tests.
- **Component smoke tests** — test that UI primitives render, fire events, and forward refs correctly. For pure UI components (`src/components/ui/`) no providers are needed.
- **Hook tests** — use `renderHook` + a real `QueryClient` provider. Mock `apiClient` at the module level with `vi.mock('@/lib/api/client')`.

### What NOT to test

- Full page components with multiple data dependencies — integration-test territory; not in scope yet.
- Socket.io events — tested manually via the running backend.

### Patterns

```ts
// Mock apiClient in hook/component tests
vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), /* … */ },
}));

// Wrap hooks that use React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const { result } = renderHook(() => usePatients(), { wrapper });
```

### File locations

Place test files adjacent to the code they test:
- `src/lib/utils/__tests__/priority.test.ts`
- `src/components/ui/__tests__/button.test.tsx`
- `src/hooks/__tests__/useAlerts.test.ts`

### ESLint and React Compiler rules

The project uses `eslint-config-next` which bundles the React Compiler ESLint plugin. Two rules to be aware of:
- `react-compiler`: Warns/errors when `setState` is called synchronously inside an effect body. Prefer "setState during render" (React's derived-state pattern) or move state updates to event handlers.
- `react-hooks/exhaustive-deps`: Stable refs (`useRef`) do not belong in dependency arrays despite what the rule suggests — suppress with `// eslint-disable-next-line react-hooks/exhaustive-deps` and a comment explaining why.
- `jsx-a11y/role-has-required-aria-props`: Elements with `role="option"` must have `aria-selected`.

## How to work in this repo

### Before changing code
- inspect the relevant files end-to-end
- trace the data flow across API client, hooks, components, and store boundaries
- understand whether the code is server state, auth state, or local UI state
- prefer minimal, targeted diffs over broad refactors
- preserve existing architecture unless there is a clear, justified improvement

### When proposing changes
- explain the root cause, not just the symptom
- align with existing patterns already used in the repo
- avoid introducing new libraries or abstractions unless clearly necessary
- call out tradeoffs, migration risk, and follow-up work where relevant

### When performing a technical assessment
- identify architecture strengths and weaknesses
- separate issues by severity and urgency
- distinguish critical fixes from high-priority improvements, nice-to-haves, and future features
- propose a phased plan before implementation
- prefer evidence from the codebase over assumptions

## Architecture

Next.js 15 App Router with TypeScript. The codebase has a strict three-layer data flow:

```API → hooks → components```

### Layer 1: API clients (src/lib/api/)

`client.ts` is the core Axios singleton (`apiClient`). It handles:
- JWT injection via Authorization header
- Multi-tenant isolation via X-Tenant-Id header on every request
- Silent token refresh on 401 with serialized retry queue (prevents duplicate refresh calls)
- Session presence cookie (session_active) for middleware route protection
- All domain API modules (`patients.ts, alerts.ts, messages.ts, ...`) must use this client and return typed responses.

#### Rules
- Do not bypass apiClient for authenticated backend requests
- Do not send tenant-scoped requests without X-Tenant-Id
- Keep domain API modules typed and focused
- Centralize auth/header/refresh behavior in `client.ts`, not duplicated in hooks or components

### Layer 2: React Query hooks (src/hooks/)
- All server state lives in React Query. Standard patterns:
- useQuery for reads with typed query keys like ['patients', patientId]
- useMutation with queryClient.invalidateQueries in onSuccess
- optimistic updates in useMessages.ts (mutate cache in onMutate, revert in onError)
- default stale time: 60s global, overridden per-hook when needed

#### Rules
- React Query is the source of truth for server state
- Do not copy React Query data into Zustand or local component state unless there is a strong reason
- Prefer query invalidation or targeted cache updates over ad hoc refetch logic
- Use optimistic updates only when rollback behavior is safe and explicit
- Keep query keys consistent and predictable

### Layer 3: Components (src/components/)
- components/ui/ — Radix UI wrappers with Tailwind (Button, Dialog, Card, etc.)
- components/dashboard/ — Dashboard panels split into oncologist/, nurse/, shared/
- components/patients/ — Patient CRUD forms and list views
- components/shared/ — NavigationBar and other global components

#### Rules
- Components should primarily render UI and delegate data access to hooks
- Avoid fetching directly inside leaf components if a repo hook pattern already exists
- Keep presentation and orchestration concerns reasonably separated
- Prefer composing existing UI primitives before creating new inconsistent ones

## Next.js guidance
This is a Next.js App Router codebase.

### Server vs Client components
- Prefer Server Components by default when interactivity is not required
- Use "use client" only when needed for:
    - browser APIs
    - event handlers
    - local interactive state
    - refs/effects
    - client-only libraries

#### Rules
- Keep client boundaries narrow
- Do not mark large trees as client components unnecessarily
- Avoid moving logic client-side if it can remain server-rendered without harming UX

### Authentication
Zustand store (src/stores/auth-store.ts) is the single source of auth truth:
- Tokens stored in localStorage; tenant ID propagated to apiClient on login
- On init, auto-attempts silent refresh if access token is expired
- src/middleware.ts checks the session_active cookie to gate protected routes; redirects to `/login?redirect=<PATHNAME>` when missing

#### Rules
- Zustand is for auth/session state, not general server state
- Keep token lifecycle logic centralized
- Be careful with hydration and browser-only storage access
- Any auth changes must preserve tenant propagation and refresh behavior


### Real-time (WebSocket)
`u`seSocket.ts is the base Socket.io hook. Specialized hooks (`useMessagesSocket, useAlertsSocket, useDashboardSocket`) wrap it and mutate React Query cache on incoming events. WebSocket URL auto-detects `ws://` vs `wss://` from page protocol.

#### Rules
- Real-time events should update React Query cache or trigger controlled invalidation
- Always clean up listeners/subscriptions
- Avoid duplicate socket subscriptions across rerenders
- Be careful with stale closures in event handlers
- Keep socket event handling idempotent where possible

### State management
#### Rules
- Use the smallest appropriate state scope:
- React Query → server state
- Zustand → auth/session state
- Component state → local UI state
- Derived values → compute during render when possible
- Use reducers when local state transitions become complex or event-driven.

Avoid

- duplicating server state in local state
- copying props into state without a clear reason
- storing derived values that can be computed
- syncing state through unnecessary effects
- using Zustand as a catch-all global store

### Effects, DOM updates, and callbacks
#### Effects
- Use effects only for synchronization with external systems
- Keep effects focused and single-purpose
- Always clean up subscriptions, event listeners, timers, and observers
- Do not suppress hook dependency warnings without a clear reason

#### DOM updates
- Prefer declarative React updates over direct DOM mutation
- Use refs for focus, measurement, or third-party integration
- Avoid unnecessary useLayoutEffect
- Do not manually mutate DOM nodes that React owns

#### Callbacks and stale closures
- Do not use useCallback everywhere by default
- Use stable callbacks where identity matters
- Watch for stale closures in:
    - socket listeners
    - event listeners
    - timers
    - debounced/throttled handlers
    - async callbacks inside hooks
- If a callback needs the latest values without constantly resubscribing, prefer a well-structured ref or effect pattern.

### Route structure
When assessing the app, review route boundaries, layout composition, auth protection, loading/error states, and whether route ownership is clear.
```
app/
├── (auth)/          # login, register, forgot/reset password
├── (public)/        # landing, privacy, terms
├── dashboard/       # nurse view (default), /oncologist, /users
├── patients/        # list + [id]/ detail + [id]/edit
├── chat/            # WhatsApp conversation UI
├── oncology-navigation/
├── integrations/
└── observability/
```

### Validation
Zod schemas live in src/lib/validations/. Forms use React Hook Form + @hookform/resolvers/zod.

#### Rules
- Keep validation close to the boundary where data enters the system
- Reuse schemas where appropriate, but do not force artificial coupling
- Preserve typed form inputs/outputs
- Avoid duplicating validation rules in multiple layers unless required

### Styling
- Tailwind with custom medical color tokens defined in tailwind.config.ts:
    - `medical.blue, medical.green` — branding
    - `priority.critical/high/medium/low` — alert severity colors
- CSS variable-based theming via Radix UI

#### Rules
- Reuse design tokens and existing UI primitives
- Preserve accessibility, color contrast, and focus visibility
- Avoid one-off styling patterns when a reusable component/token exists

### Multi-tenancy
Every backend request must carry `X-Tenant-Id`. The apiClient reads this from its internal state (set during login). Never bypass this — all data is tenant-scoped.

#### Rules
- Treat tenant isolation as a critical invariant
- Flag any code path that could send cross-tenant or tenant-less requests
- Be extra cautious with caching, websocket updates, auth restoration, and route transitions

### Key environment variables
```
Variable	            Purpose
NEXT_PUBLIC_API_URL	    Backend REST API base URL
NEXT_PUBLIC_WS_URL	    WebSocket server URL
```
See .env.example at the repo root for the full list.

When assessing configuration:
- verify env usage is centralized and typed where possible
- check for server/client exposure mistakes
- check for missing defaults, dead vars, and inconsistent naming