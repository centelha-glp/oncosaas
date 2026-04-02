---
name: backend
description: Aciona o agente backend-nestjs para tarefas gerais de backend NestJS, controllers, services, guards e Prisma
---

# Skill: /backend

## Descrição

Aciona o agente `backend-nestjs` para tarefas de desenvolvimento no backend NestJS. Para criar um módulo completo do zero, use `/novo-modulo-backend`. Para migrations, use `/migrar-prisma`.

## Uso

```
/backend [tarefa ou contexto]
```

### Exemplos

- `/backend adicionar endpoint de exportação de pacientes` — novo endpoint em módulo existente
- `/backend corrigir bug no alertas.service.ts` — diagnóstico e correção
- `/backend adicionar guard de roles no controller de relatórios` — aplicar guard stack
- `/backend revisar DTOs do módulo de medicamentos` — revisão de validação
- `/backend implementar paginação em /patients` — adicionar paginação com take/skip
- `/backend` — analisa o estado do backend e sugere melhorias

## O que faz

1. Lê os arquivos relevantes em `backend/src/`
2. Implementa seguindo padrões obrigatórios do projeto:
   - `tenantId` em toda query Prisma
   - Guard stack: `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)`
   - `ParseUUIDPipe` em parâmetros `:id`
   - NestJS `Logger` (nunca `console.log`)
   - DTOs com `class-validator`
3. Aciona `/gerar-testes` para testes do código produzido
4. Aciona `seguranca-compliance` antes do commit

## Regras invariantes

- `tenantId` NUNCA omitido de queries `findMany`, `update`, `delete`
- `@CurrentUser()` de `'../auth/decorators/current-user.decorator'`
- `@Roles()` de `'../auth/decorators/roles.decorator'`
- Services NUNCA acessam `request` — recebem `tenantId` como parâmetro

## Referências

- Rules: `.cursor/rules/backend.mdc`
- Módulo exemplo: `backend/src/patients/`
- AppModule: `backend/src/app.module.ts`
