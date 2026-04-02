---
name: seguranca
description: Aciona o agente seguranca-compliance para revisão de segurança, LGPD/HIPAA, isolamento multi-tenant e audit trail
---

# Skill: /seguranca

## Descrição

Aciona o agente `seguranca-compliance` para revisão obrigatória de segurança, compliance LGPD/HIPAA e isolamento multi-tenant. **OBRIGATÓRIO** após criar ou modificar qualquer controller, service, DTO ou guard no backend.

## Uso

```
/seguranca [arquivo ou contexto]
```

### Exemplos

- `/seguranca` — revisa todos os arquivos backend modificados
- `/seguranca backend/src/patients/patients.service.ts` — revisão específica
- `/seguranca novo endpoint /reports` — revisão antes do commit
- `/seguranca verificar isolamento de tenant no módulo de alertas` — auditoria pontual

## O que faz

1. Lê os arquivos do backend modificados
2. Verifica isolamento multi-tenant (toda query com `tenantId`)
3. Verifica que campos sensíveis nunca aparecem em responses (`password`, `mfaSecret`, `cpf`, `apiKeys`)
4. Confirma guard stack completo nos controllers
5. Verifica que `tenantId` nunca vem de body/query params (somente do JWT)
6. Verifica uso correto de `encryptSensitiveData` para `cpf`, `phone`, tokens
7. Revisa audit trail para operações de PHI
8. Aprova ou rejeita com itens de correção

## Workflow obrigatório pré-commit (backend)

```
código alterado
    → /gerar-testes
    → /seguranca         ← SEMPRE antes do commit em backend
    → github-organizer
```

## Checklist de revisão

- [ ] `tenantId` em toda query `findMany`, `update`, `delete`
- [ ] `tenantId` vem SOMENTE do JWT (`@CurrentUser()`)
- [ ] Guard stack: `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)`
- [ ] Campos sensíveis ausentes de responses e logs
- [ ] `cpf`/`phone` criptografados com `encryptSensitiveData`
- [ ] Nenhum `console.log` com dados de paciente
- [ ] `ParseUUIDPipe` em todos os params `:id`
- [ ] Novos endpoints `@Public()` revisados e justificados

## Referências

- Rules: `.cursor/rules/security.mdc`
- Guards: `backend/src/auth/guards/`
- Encryption: `backend/src/whatsapp-connections/utils/encryption.util.ts`
- Audit log: `backend/src/audit-log/`
