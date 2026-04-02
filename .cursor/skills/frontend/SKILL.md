---
name: frontend
description: Aciona o agente frontend-nextjs para tarefas de frontend Next.js, componentes React, hooks React Query e Zustand
---

# Skill: /frontend

## Descrição

Aciona o agente `frontend-nextjs` para tarefas de desenvolvimento no frontend Next.js.

## Uso

```
/frontend [tarefa ou contexto]
```

### Exemplos

- `/frontend criar componente de card de paciente` — novo componente com Tailwind + Radix UI
- `/frontend hook para buscar alertas por tenant` — React Query hook seguindo o padrão
- `/frontend adicionar filtro de prioridade na lista de pacientes` — feature em página existente
- `/frontend corrigir estado de loading no dashboard de enfermagem` — bug de UX
- `/frontend` — analisa o estado do frontend e sugere melhorias

## O que faz

1. Lê os arquivos relevantes em `frontend/src/`
2. Implementa seguindo a arquitetura em 3 camadas:
   - `API Client` (`src/lib/api/`) → `Hooks` (`src/hooks/`) → `Components` (`src/components/`)
3. React Query para server state, Zustand apenas para auth
4. Server Components por padrão; `"use client"` apenas quando necessário
5. Design tokens `priority.*` para cores clínicas (nunca hardcodar)
6. `staleTime` explícito em todo `useQuery`

## Regras invariantes

- Nunca bypassar `apiClient` para requests autenticados
- `X-Tenant-Id` propagado automaticamente pelo `apiClient`
- Nunca copiar server state do React Query para Zustand
- `localStorage` só com `typeof window !== 'undefined'`

## Referências

- Rules: `.cursor/rules/frontend.mdc`
- API client: `frontend/src/lib/api/client.ts`
- Hooks: `frontend/src/hooks/`
- Stores: `frontend/src/stores/auth-store.ts`
