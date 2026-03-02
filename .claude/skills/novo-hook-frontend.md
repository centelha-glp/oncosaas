# Skill: /novo-hook-frontend

## Descrição
Cria um novo hook React Query + API client para uma entidade no frontend.

## Uso
```
/novo-hook-frontend <entidade>
```

Exemplo: `/novo-hook-frontend interventions`

## O que faz

### 1. API Client
Cria `frontend/src/lib/api/<entidade>.ts`:

```typescript
import { apiClient } from './client';

export interface <Entidade> {
  id: string;
  tenantId: string;
  // ... campos da entidade
  createdAt: string;
  updatedAt: string;
}

export const <entidade>Api = {
  getAll: () => apiClient.get<<Entidade>[]>('/api/v1/<entidade>').then(r => r.data),
  getById: (id: string) => apiClient.get<<Entidade>>(`/api/v1/<entidade>/${id}`).then(r => r.data),
  create: (data: Partial<<Entidade>>) => apiClient.post<<Entidade>>('/api/v1/<entidade>', data).then(r => r.data),
  update: (id: string, data: Partial<<Entidade>>) => apiClient.put<<Entidade>>(`/api/v1/<entidade>/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/api/v1/<entidade>/${id}`).then(r => r.data),
};
```

### 2. Hook React Query
Cria `frontend/src/hooks/use<Entidade>.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { <entidade>Api } from '@/lib/api/<entidade>';

export function use<Entidade>() {
  return useQuery({
    queryKey: ['<entidade>'],
    queryFn: <entidade>Api.getAll,
  });
}

export function use<Entidade>Detail(id: string) {
  return useQuery({
    queryKey: ['<entidade>', id],
    queryFn: () => <entidade>Api.getById(id),
    enabled: !!id,
  });
}

export function useCreate<Entidade>() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: <entidade>Api.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['<entidade>'] }),
  });
}
```

## Referências
- API client base: `frontend/src/lib/api/client.ts`
- Hook existente: `frontend/src/hooks/usePatients.ts`
- React Query config: `frontend/src/app/providers.tsx`
