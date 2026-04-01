---
name: squad-plataforma
description: Squad Plataforma — engenharia core full-stack do ONCONAV
---

# Squad Plataforma

Equipe responsável pelo desenvolvimento full-stack do ONCONAV: backend NestJS, frontend Next.js, banco de dados e UX.

## Teammates

### backend-nestjs
Papel: NestJS, Prisma, módulos, controllers, services e DTOs.
Responsabilidades:
- Criar e manter módulos NestJS com isolamento multi-tenant
- Implementar DTOs com class-validator e `ParseUUIDPipe`
- Garantir `tenantId` em todas as queries Prisma
- Implementar guards, interceptors e filtros de exceção

### frontend-nextjs
Papel: Next.js 14, React, componentes, hooks React Query e Zustand.
Responsabilidades:
- Criar páginas e componentes com App Router
- Implementar hooks React Query para data fetching
- Manter stores Zustand para estado cliente
- Validar formulários com Zod

### database-engineer
Papel: schema Prisma, migrations, queries e índices PostgreSQL.
Responsabilidades:
- Garantir `tenantId` + `@@index([tenantId])` em todo modelo multi-tenant
- Criar migrations seguras (sem perda de dados)
- Otimizar queries N+1 com `include`/`select`
- Adicionar índices compostos para queries críticas

### ux-accessibility
Papel: WCAG 2.1 AA, UX para profissionais de saúde sob pressão.
Responsabilidades:
- Garantir contraste 4.5:1 para texto normal, 3:1 para texto grande
- Usar cor + ícone + texto para urgência clínica (nunca cor isolada)
- Implementar 4 estados obrigatórios de UI: loading, success, error, empty
- Testar com leitores de tela (NVDA/VoiceOver)

## Coordenação

1. **database-engineer** define o schema e cria a migration
2. **backend-nestjs** implementa o módulo e expõe os endpoints
3. **frontend-nextjs** consome a API e implementa a UI
4. **ux-accessibility** revisa e ajusta a experiência do usuário

## Quando acionar este squad

- Desenvolver feature end-to-end (DB → API → UI)
- Criar novo módulo NestJS
- Otimizar queries lentas
- Revisar acessibilidade de componentes
- Implementar novo fluxo no dashboard de enfermagem
