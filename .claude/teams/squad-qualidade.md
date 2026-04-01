---
name: squad-qualidade
description: Squad Qualidade — testes, segurança, performance e entrega do ONCONAV
---

# Squad Qualidade

Squad transversal responsável por garantir qualidade, segurança, performance e entrega organizada do ONCONAV. **Obrigatório antes de qualquer commit.**

## Teammates

### test-generator
Papel: geração e manutenção de testes unitários e E2E.
Responsabilidades:
- Analisar arquivos modificados e gerar/atualizar testes correspondentes
- Cobrir happy path, cenários de erro, isolamento multi-tenant e segurança
- Testes Jest para backend NestJS, Vitest para frontend Next.js
- Playwright para E2E críticos (fluxo de login, dashboard, alertas)

### seguranca-compliance
Papel: LGPD/HIPAA, isolamento multi-tenant e audit trail.
Responsabilidades:
- Validar que todo controller/service tem `tenantId` scope
- Verificar ausência de SQL injection, XSS, command injection
- Garantir criptografia de dados sensíveis (ENCRYPTION_KEY obrigatório)
- Revisar audit trail em operações com dados de pacientes

### performance
Papel: bundle size, N+1 queries, Redis cache e Core Web Vitals.
Responsabilidades:
- Detectar N+1 em queries Prisma (usar `include` em vez de loop)
- Verificar paginação (`take` + `skip`) em listagens
- Analisar bundle size Next.js e componentes sem `dynamic()`
- Validar uso de Redis para dados lidos frequentemente

### github-organizer
Papel: commits atômicos, PRs estruturadas e histórico limpo.
Responsabilidades:
- Organizar mudanças em commits lógicos e atômicos
- Criar PRs com título < 70 chars e body estruturado (Summary + Test plan)
- Nunca usar `--no-verify` ou pular hooks
- Garantir que arquivos sensíveis (.env) não sejam commitados

## Ordem obrigatória de execução

```
código alterado
  → test-generator      (gerar/atualizar testes)
  → seguranca-compliance (se backend: controllers, services, DTOs)
  → github-organizer    (organizar e commitar)
```

## Quando acionar este squad

- **Sempre** — antes de qualquer commit
- Após qualquer mudança em backend (controller, service, DTO, guard)
- Para revisar performance de endpoints lentos
- Para auditar segurança de um módulo
- Para organizar mudanças grandes em commits atômicos
