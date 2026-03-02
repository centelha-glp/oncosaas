# MCP Server: PostgreSQL/Prisma (READ-ONLY)

## Descrição
MCP Server que dá acesso READ-ONLY ao banco PostgreSQL do ONCONAV para debugging e consulta de dados durante o desenvolvimento.

## Configuração

### Conexão
```
Host: localhost
Port: 5433 (Docker) ou 5432 (local)
Database: ONCONAV_development
User: ONCONAV
Password: ONCONAV_dev
```

### Instalação
```bash
# Usar o MCP server PostgreSQL oficial
npx @modelcontextprotocol/server-postgres "postgresql://ONCONAV:ONCONAV_dev@localhost:5433/ONCONAV_development"
```

### Configuração no Claude Code (`~/.claude.json` ou projeto `.claude/mcp.json`)
```json
{
  "mcpServers": {
    "onconav-postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://ONCONAV:ONCONAV_dev@localhost:5433/ONCONAV_development"
      ]
    }
  }
}
```

## Tools Disponíveis

| Tool | Descrição |
|------|-----------|
| `query` | Executa query SQL READ-ONLY |

## Restrições de Segurança

1. **READ-ONLY**: Apenas SELECT, EXPLAIN, DESCRIBE. NUNCA INSERT/UPDATE/DELETE.
2. **Filtro tenantId**: Sempre incluir `WHERE "tenantId" = '<id>'` em queries de negócio
3. **Campos sensíveis**: Nunca selecionar `password`, `cpf` (raw), `mfaSecret`, `*ApiKey`, `oauthAccessToken`
4. **Query segura**: Usar LIMIT para evitar dumps grandes

## Exemplos de Uso

```sql
-- Listar tabelas
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Contar pacientes por tenant
SELECT "tenantId", count(*) FROM patients GROUP BY "tenantId";

-- Ver schema de uma tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'patients';

-- Consultar paciente (COM tenantId!)
SELECT id, name, "cancerType", "priorityScore", "currentStage"
FROM patients
WHERE "tenantId" = '<tenant-id>'
LIMIT 10;

-- Alertas pendentes
SELECT id, type, severity, status, "patientId"
FROM alerts
WHERE "tenantId" = '<tenant-id>' AND status = 'PENDING';
```

## Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `tenants` | Hospitais/clínicas |
| `users` | Usuários do sistema |
| `patients` | Pacientes oncológicos |
| `cancer_diagnoses` | Diagnósticos de câncer |
| `treatments` | Tratamentos |
| `navigation_steps` | Etapas de navegação |
| `conversations` | Conversas do agente |
| `messages` | Mensagens WhatsApp |
| `alerts` | Alertas do sistema |
| `observations` | Observações clínicas |
| `scheduled_actions` | Ações agendadas |
| `questionnaire_responses` | Respostas de questionários |
| `agent_configs` | Configuração do agente por tenant |
| `clinical_protocols` | Protocolos clínicos |
| `audit_logs` | Logs de auditoria LGPD |
