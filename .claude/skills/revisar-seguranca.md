# Skill: /revisar-seguranca

## Descrição

Executa auditoria de segurança e compliance LGPD no módulo ou projeto inteiro.

## Uso

```
/revisar-seguranca [modulo]
```

Exemplos:

- `/revisar-seguranca` — Audita todo o projeto
- `/revisar-seguranca patients` — Audita apenas o módulo patients

## Checklist de Verificação

### 1. Isolamento Multi-Tenant

- [ ] Todas as queries Prisma incluem `tenantId` no where
- [ ] Controllers usam `@UseGuards(TenantGuard)`
- [ ] Services recebem `tenantId` como parâmetro (não acessam request)
- [ ] Não existe acesso cross-tenant

### 2. Criptografia LGPD

- [ ] CPF é criptografado via `encryption.util` antes de salvar
- [ ] Telefone é criptografado via `encryption.util`
- [ ] phoneHash é SHA-256 do telefone normalizado (para busca)
- [ ] API keys (OpenAI, Anthropic, WhatsApp) são criptografadas
- [ ] ENCRYPTION_KEY está definida no .env

### 3. DTOs e Responses

- [ ] DTOs de response NÃO expõem: password, mfaSecret, cpf (raw), apiKeys
- [ ] Campos sensíveis usam @Exclude() ou são omitidos
- [ ] Paginação implementada para evitar data dumps

### 4. Autenticação e Autorização

- [ ] Controllers usam `@UseGuards(JwtAuthGuard)`
- [ ] Endpoints sensíveis usam `@Roles()` decorator
- [ ] ParseUUIDPipe em todos os parâmetros :id
- [ ] Rate limiting aplicado (100 req/min geral, 10 req/min auth)

### 5. Audit Trail

- [ ] AuditLogInterceptor aplicado em mutations
- [ ] Campos sensíveis sanitizados no log (password, tokens)
- [ ] Logs incluem userId, tenantId, action, timestamp

### 6. Segurança de Input

- [ ] DTOs usam class-validator para validação
- [ ] Inputs SQL são parametrizados (via Prisma, nunca raw SQL)
- [ ] Uploads de arquivo validam tipo e tamanho

## Saída

Gera relatório com:

- Módulos verificados
- Violações encontradas (CRITICAL / WARNING / INFO)
- Sugestões de correção
- Score de compliance (0-100%)

## Referências

- Guards: `backend/src/auth/guards/`
- AuditLog: `backend/src/audit-log/`
- Encryption: `backend/src/common/utils/encryption.util.ts`
- Schema: `backend/prisma/schema.prisma` (campos marcados com LGPD)
