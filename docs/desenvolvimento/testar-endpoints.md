# Como Testar os Endpoints da API

> **Contratos entre serviços:** antes de integrar, leia o mapa canônico em [`../api/contratos-api.md`](../api/contratos-api.md) (Nest `3002/api/v1` vs AI Service `8001` e OpenAPI em `http://localhost:8001/docs`).

## Endpoints críticos (Nest — `http://localhost:3002/api/v1`)

| Área | Métodos / rotas (resumo) | Detalhe abaixo |
|------|---------------------------|----------------|
| Sessão | `POST /auth/login`, `POST /auth/register` | [Autenticação](#-autenticação) |
| Pacientes | `GET/POST /patients`, `GET /patients/:id` | [Pacientes](#-pacientes) |
| Mensagens | `GET /messages`, contagem não assumidas | [Mensagens](#-mensagens) |
| Alertas | `GET/POST /alerts` | [Alertas](#-alertas) |
| FHIR | `GET/POST/PUT /fhir/config`, `POST /fhir/...` | [FHIR](#fhir-integração) |
| Auditoria / ML | `GET /audit-logs`, `GET /disposition-feedback/export` | [Auditoria e export ML](#-auditoria-e-export-ml-papéis-restritos) |

Para outras rotas (navegação oncológica, agente, WhatsApp), consulte os controllers em `backend/src/**` e o índice em [`../api/contratos-api.md`](../api/contratos-api.md). Índice FHIR: [`../fhir/README.md`](../fhir/README.md).

## 🔐 Autenticação

### 1. Login

**Endpoint**: `POST http://localhost:3002/api/v1/auth/login`

**Body (JSON)**:

```json
{
  "email": "admin@hospitalteste.com",
  "password": "senha123"
}
```

**Resposta esperada (JSON):** objeto `user` (sem `access_token` no corpo). O JWT de acesso vem no header **`Set-Cookie`** (`access_token`, HttpOnly).

```json
{
  "user": {
    "id": "...",
    "email": "admin@hospitalteste.com",
    "name": "Admin User",
    "role": "ADMIN",
    "tenantId": "...",
    "tenant": {
      "id": "...",
      "name": "Hospital Teste"
    }
  }
}
```

Para chamadas seguintes com **curl**, use `-c`/`-b` com um arquivo de cookies após o login, ou `Authorization: Bearer <jwt>` com o valor do cookie `access_token`.

### 2. Register

**Endpoint**: `POST http://localhost:3002/api/v1/auth/register`

**Body (JSON)**:

```json
{
  "email": "novo@hospitalteste.com",
  "password": "senha123",
  "name": "Novo Usuário",
  "role": "NURSE",
  "tenantId": "tenant-id-aqui"
}
```

---

## 👥 Pacientes

### Listar Pacientes

**Endpoint**: `GET http://localhost:3002/api/v1/patients`

**Headers**:

```
Authorization: Bearer {access_token}
X-Tenant-Id: {tenant-id}
```

**Resposta esperada**:

```json
{
  "data": [
    {
      "id": "...",
      "name": "Ana Paula Costa",
      "cancerType": "breast",
      "stage": "IIIA",
      "status": "IN_TREATMENT",
      "priority": "HIGH",
      "priorityScore": 75
    }
  ]
}
```

### Obter Paciente por ID

**Endpoint**: `GET http://localhost:3002/api/v1/patients/{id}`

**Headers**: Mesmos do listar

---

## 💬 Mensagens

### Listar Mensagens

**Endpoint**: `GET http://localhost:3002/api/v1/messages`

**Headers**: Mesmos do pacientes

**Query Parameters**:

- `patientId` (opcional): Filtrar por paciente
- `status` (opcional): `PENDING`, `PROCESSED`, `ERROR`

### Contar Mensagens Não Assumidas

**Endpoint**: `GET http://localhost:3002/api/v1/messages/unassumed/count`

---

## 🚨 Alertas

### Listar Alertas

**Endpoint**: `GET http://localhost:3002/api/v1/alerts`

**Headers**: Mesmos do pacientes

**Query Parameters**:

- `status` (opcional): `ACTIVE`, `RESOLVED`, `DISMISSED`
- `severity` (opcional): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `patientId` (opcional): Filtrar por paciente

### Criar Alerta

**Endpoint**: `POST http://localhost:3002/api/v1/alerts`

**Body (JSON)**:

```json
{
  "patientId": "patient-id",
  "type": "SYMPTOM",
  "severity": "HIGH",
  "title": "Febre alta",
  "description": "Paciente relatou febre de 39°C",
  "source": "WHATSAPP"
}
```

---

## FHIR (integração)

Requer integração FHIR **habilitada** para o tenant (`enabled: true` na configuração). Documentação conceitual: [`../fhir/README.md`](../fhir/README.md).

**Headers** (igual aos demais endpoints autenticados):

```
Authorization: Bearer {access_token}
X-Tenant-Id: {tenant-id}
```

### Configuração (`/fhir/config`) — apenas **ADMIN**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/fhir/config` | Lê configuração do tenant (credenciais mascaradas na resposta) |
| POST | `/api/v1/fhir/config` | Cria ou substitui configuração (upsert) |
| PUT | `/api/v1/fhir/config` | Atualiza configuração existente |

### Sincronização (`/fhir/*`) — papéis: ADMIN, ONCOLOGIST, DOCTOR, NURSE_CHIEF, NURSE, COORDINATOR

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/fhir/observations/{observationId}/sync` | Envia uma observação ao EHR |
| POST | `/api/v1/fhir/patients/{patientId}/sync` | Envia/atualiza paciente no EHR |
| POST | `/api/v1/fhir/observations/sync-all` | Sincroniza lote (limite interno 50) |
| POST | `/api/v1/fhir/patients/{patientId}/pull` | Puxa observações do EHR para o paciente |

Se a integração não estiver habilitada, o serviço responde com erro indicando que o FHIR não está ativo para o tenant.

### Exemplos com cURL

Substitua `OBSERVATION_UUID`, `PATIENT_UUID`, `TENANT_UUID` e o token.

**Ler config (ADMIN):**

```bash
curl -s -X GET "http://localhost:3002/api/v1/fhir/config" \
  -H "Authorization: Bearer {access_token}" \
  -H "X-Tenant-Id: {tenant-id}"
```

**Sincronizar uma observação:**

```bash
curl -s -X POST "http://localhost:3002/api/v1/fhir/observations/OBSERVATION_UUID/sync" \
  -H "Authorization: Bearer {access_token}" \
  -H "X-Tenant-Id: {tenant-id}"
```

**Pull de observações do EHR para um paciente:**

```bash
curl -s -X POST "http://localhost:3002/api/v1/fhir/patients/PATIENT_UUID/pull" \
  -H "Authorization: Bearer {access_token}" \
  -H "X-Tenant-Id: {tenant-id}"
```

---

## 📋 Auditoria e export ML (papéis restritos)

### Logs de auditoria

- **GET** `http://localhost:3002/api/v1/audit-logs` e **GET** `.../audit-logs/summary`
- **Autenticação:** JWT com papel **ADMIN** ou **COORDINATOR** (além do tenant válido).
- Outros papéis recebem **403**.

### Export de feedback de disposição (treino ML)

- **GET** `http://localhost:3002/api/v1/disposition-feedback/export`
- **Autenticação:** JWT **ADMIN**; export é **sempre** limitado ao tenant do token (não há export multi-tenant por query string).

---

## 🧪 Usuários de Teste (Seed Data)

Após executar `npm run prisma:seed`, você terá:

| Email                           | Senha      | Role        |
| ------------------------------- | ---------- | ----------- |
| `admin@hospitalteste.com`       | `senha123` | ADMIN       |
| `oncologista@hospitalteste.com` | `senha123` | ONCOLOGIST  |
| `enfermeira@hospitalteste.com`  | `senha123` | NURSE       |
| `coordenador@hospitalteste.com` | `senha123` | COORDINATOR |

**⚠️ IMPORTANTE**: Todos os usuários de teste usam a mesma senha: `senha123`

**Tenant ID**: Use o ID do tenant criado no seed (verificar no Prisma Studio)

---

## 📝 Exemplo com cURL

### Login:

```bash
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hospitalteste.com",
    "password": "senha123"
  }'
```

### Listar Pacientes:

```bash
curl -X GET http://localhost:3002/api/v1/patients \
  -H "Authorization: Bearer {access_token}" \
  -H "X-Tenant-Id: {tenant-id}"
```

---

## 🛠️ Ferramentas Recomendadas

- **Postman**: Importar collection de endpoints
- **Insomnia**: Similar ao Postman
- **Thunder Client** (VSCode): Extensão para testar APIs diretamente no editor
- **cURL**: Linha de comando

---

## AI Service (FastAPI — porta `8001`)

Este guia foca no **Nest** (`3002`). O AI Service expõe **`/api/v1/...`** em `http://localhost:8001`, com **OpenAPI interativo** em **`http://localhost:8001/docs`** (testar `agent/process`, priorização, etc.). Contrato e separação de responsabilidades: [`../api/contratos-api.md`](../api/contratos-api.md). Variáveis: [`../../ai-service/README.md`](../../ai-service/README.md).

---

## ⚠️ Erros Comuns

### 401 Unauthorized

- Verificar se o token JWT está correto
- Verificar se o token não expirou (24h por padrão)

### 403 Forbidden

- Verificar se o `X-Tenant-Id` está correto
- Verificar se o usuário tem permissão (role) para a ação

### 404 Not Found

- Verificar se o método HTTP está correto (GET vs POST)
- Verificar se a URL está correta (`/api/v1/...`)
- Verificar se o servidor está rodando (`npm run start:dev`)

### 500 Internal Server Error

- Verificar logs do servidor
- Verificar se o banco de dados está rodando (`docker-compose up -d`)
- Verificar se as migrations foram aplicadas (`npm run prisma:migrate`)
