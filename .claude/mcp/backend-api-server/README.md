# MCP Server: Backend API (ONCONAV REST)

## Descrição
MCP Server para interagir com a API REST do backend ONCONAV durante desenvolvimento, permitindo testar endpoints e debugar fluxos.

## Configuração

### Base URL
```
http://localhost:3002/api/v1
```

### Credenciais de Teste (após seed)
| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@hospitalteste.com | senha123 |
| ONCOLOGIST | oncologista@hospitalteste.com | senha123 |
| NURSE | enfermeira@hospitalteste.com | senha123 |
| COORDINATOR | coordenador@hospitalteste.com | senha123 |

### Configuração MCP (usando fetch server)
```json
{
  "mcpServers": {
    "onconav-api": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"],
      "description": "ONCONAV Backend API access"
    }
  }
}
```

## Endpoints Principais

### Auth
- `POST /auth/login` — Login (retorna JWT)
- `POST /auth/refresh` — Refresh token

### Patients
- `GET /patients` — Listar pacientes
- `GET /patients/:id` — Detalhes do paciente
- `POST /patients` — Criar paciente
- `PUT /patients/:id` — Atualizar paciente

### Alerts
- `GET /alerts` — Listar alertas
- `PUT /alerts/:id/acknowledge` — Reconhecer alerta
- `PUT /alerts/:id/resolve` — Resolver alerta

### Agent
- `POST /agent/process` — Processar mensagem do agente
- `GET /agent/conversations` — Listar conversas
- `GET /agent/conversations/:id/messages` — Mensagens de uma conversa

### Dashboard
- `GET /dashboard/metrics` — Métricas do dashboard
- `GET /dashboard/critical-steps` — Etapas críticas

### Navigation
- `GET /oncology-navigation/patient/:patientId/steps` — Etapas de navegação
- `PUT /oncology-navigation/steps/:id/status` — Atualizar status da etapa

## Fluxo de Autenticação
```bash
# 1. Login
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospitalteste.com","password":"senha123"}'

# 2. Usar o token retornado
curl http://localhost:3002/api/v1/patients \
  -H "Authorization: Bearer <token>"
```
