---
name: migrar-prisma
description: Cria e executa migrations Prisma para alterações no schema do banco
---

# Skill: /migrar-prisma

## Descrição

Executa o pipeline completo de migração Prisma com validação e tratamento de erros.

## Uso

```
/migrar-prisma <nome-da-migracao>
```

Exemplo: `/migrar-prisma add-reports-table`

## Pipeline de Execução

### Passo 1: Validar Schema

```bash
cd backend && npx prisma validate
```

Se falhar: **parar e mostrar erros**

### Passo 2: Formatar Schema

```bash
cd backend && npx prisma format
```

### Passo 3: Criar Migração

```bash
cd backend && npx prisma migrate dev --name <nome-da-migracao>
```

### Passo 4: Gerar Client

```bash
cd backend && npx prisma generate
```

### Passo 5: Verificar

```bash
cd backend && npx prisma migrate status
```

## Tratamento de Erros Comuns

| Erro                        | Solução                                             |
| --------------------------- | --------------------------------------------------- |
| `Shadow database`           | Verificar que user ONCONAV tem permissão CREATEDB   |
| `Drift detected`            | Executar `prisma migrate resolve` ou reset          |
| `Migration already applied` | Verificar `_prisma_migrations` table                |
| `Foreign key violation`     | Ajustar ordem das migrations ou adicionar ON DELETE |

## Referências

- Schema: `backend/prisma/schema.prisma`
- Migrations: `backend/prisma/migrations/`
