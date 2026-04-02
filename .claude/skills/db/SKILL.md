---
name: db
description: Aciona o agente database-engineer para otimizar queries Prisma, revisar schema, índices e performance de banco. Para migrations use /migrar-prisma
---

# Skill: /db

## Descrição

Aciona o agente `database-engineer` para tarefas de banco de dados: otimização de queries, revisão de schema, índices e performance. Para criar e executar migrations, use `/migrar-prisma`.

## Uso

```
/db [tarefa ou contexto]
```

### Exemplos

- `/db otimizar query de listagem de pacientes` — diagnóstico e correção de N+1
- `/db adicionar índice para busca por phoneHash` — análise de índice necessário
- `/db revisar schema do modelo NavigationStep` — revisão de convenções
- `/db query lenta no dashboard de enfermagem` — profiling e otimização
- `/db modelar novo domínio de notificações` — design de novos models Prisma

## O que faz

1. Lê o schema em `backend/prisma/schema.prisma`
2. Analisa queries Prisma para padrões N+1, falta de `take`, falta de `tenantId`
3. Propõe índices necessários baseado nos padrões de acesso
4. Verifica conformidade com convenções de nomenclatura (PascalCase, snake_case via `@@map`)
5. Garante que campos sensíveis (`cpf`, `phone`) têm criptografia e `phoneHash`
6. Propõe otimizações com `select` vs `include` quando aplicável

## Regras invariantes

- Todo model com dados clínicos DEVE ter `tenantId String`
- Índice obrigatório em `tenantId` em todos os models clínicos
- Nunca renomear coluna diretamente — usar `@map` para preservar dados
- Nunca editar migration já aplicada — criar nova

## Referências

- Rules: `.claude/rules/database.md`
- Schema: `backend/prisma/schema.prisma`
- Migrations: `backend/prisma/migrations/`
