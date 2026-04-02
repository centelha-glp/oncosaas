---
name: perf
description: Aciona o agente performance para bundle size, N+1 Prisma, cache Redis, Core Web Vitals e profiling de endpoints lentos
---

# Skill: /perf

## Descrição

Aciona o agente `performance` para diagnóstico e otimização de performance: bundle size Next.js, queries N+1, estratégias de cache Redis, Core Web Vitals e profiling de endpoints lentos.

## Uso

```
/perf [tarefa ou contexto]
```

### Exemplos

- `/perf analisar bundle size do frontend` — diagnóstico de JavaScript excessivo
- `/perf query lenta no dashboard de enfermagem` — N+1 ou índice faltando
- `/perf otimizar cache Redis para rate limiting` — estratégia de cache
- `/perf endpoint /patients lento em produção` — profiling + sugestão de fix
- `/perf` — auditoria geral de performance nas camadas modificadas

## O que faz

1. Lê os arquivos modificados e identifica padrões de baixa performance
2. Detecta queries N+1 (Prisma sem `include`, loop com findFirst)
3. Analisa uso de `take` em arrays aninhados (risco de OOM)
4. Verifica `staleTime` e invalidação cirúrgica de React Query
5. Identifica server components marcados `"use client"` desnecessariamente
6. Verifica counters Redis com `GET+SET` em vez de `increment()` atômico
7. Propõe optimizações concretas com antes/depois

## Regras críticas (invariantes)

- `take` obrigatório em todo array aninhado — nunca `include` sem limite
- Aggregations no banco (Prisma `groupBy`, `_count`) — nunca em memória
- `staleTime` explícito em todo hook React Query
- `"use client"` apenas quando estritamente necessário
- Contadores Redis sempre com `increment()` — nunca GET + SET separados
- Nunca cachear decisões clínicas de triage (clinical_rules, disposição)
- Paginação obrigatória em todo endpoint de listagem (cap 100 itens)

## Limites sugeridos por contexto

| Contexto | Limite |
|----------|--------|
| Alertas por paciente | `take: 10–50` |
| Mensagens por conversa | `take: 20–50` |
| Histórico de status | `take: 10` |
| Sync FHIR em lote | `take: 50` |
| Lista de pacientes | `take: 20` + paginação |

## Referências

- Rules: `.cursor/rules/performance.mdc`
- Backend services: `backend/src/`
- Frontend hooks: `frontend/src/hooks/`
- React Query: `staleTime` e invalidação em `frontend/src/hooks/`
- Redis: `backend/src/auth/auth.service.ts` (padrão de contadores atômicos)
