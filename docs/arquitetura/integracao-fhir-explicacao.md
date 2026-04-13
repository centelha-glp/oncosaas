# Como Funciona a Integração FHIR - Explicação Completa

## 📋 Visão Geral

A integração FHIR permite sincronização **bidirecional** entre nossa plataforma e sistemas EHR/PMS (Electronic Health Records / Practice Management Systems) usando o padrão **FHIR R4**.

## 🏗️ Arquitetura

```
┌─────────────────┐
│  Agente WhatsApp│
│  (coleta dados)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Observations    │
│ Service         │
│ (cria observação)│
└────────┬────────┘
         │
         ├─► Salva no banco (syncedToEHR = false)
         │
         ▼
┌─────────────────┐
│ FHIR Sync       │
│ Service         │
│ (push automático)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ FHIR Client     │
│ (HTTP REST)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ EHR System      │
│ (FHIR Server)   │
└─────────────────┘
```

## 🔄 Fluxos de Sincronização

### 1. Push Automático (Plataforma → EHR)

**Quando acontece:**

- Uma observação é criada pelo agente WhatsApp
- Ou manualmente via API

**Como funciona:**

```
1. ObservationsService.create()
   ↓
2. Salva observação no banco (syncedToEHR = false)
   ↓
3. Chama syncToEHRIfEnabled() (assíncrono, não bloqueia)
   ↓
4. Verifica se integração está habilitada
   ↓
5. Se sim e syncFrequency = 'realtime':
   ↓
6. FHIRTransformerService.toFHIRObservation()
   - Converte Observation interna → FHIR Observation Resource
   ↓
7. FHIRClientService.createObservation()
   - POST /Observation para EHR
   ↓
8. Recebe fhirResourceId do EHR
   ↓
9. Atualiza observação:
   - fhirResourceId = "123"
   - syncedToEHR = true
   - syncedAt = agora
```

**Exemplo de transformação:**

**Observation Interna:**

```typescript
{
  id: "obs-123",
  patientId: "patient-456",
  code: "72514-3",  // LOINC: Pain severity
  display: "Pain severity",
  valueQuantity: 7,
  unit: "/10",
  effectiveDateTime: "2024-01-15T10:30:00Z"
}
```

**FHIR Observation Resource:**

```json
{
  "resourceType": "Observation",
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "72514-3",
        "display": "Pain severity"
      }
    ]
  },
  "subject": {
    "reference": "Patient/patient-456"
  },
  "effectiveDateTime": "2024-01-15T10:30:00Z",
  "valueQuantity": {
    "value": 7,
    "unit": "/10",
    "system": "http://unitsofmeasure.org"
  }
}
```

### 2. Pull Automático (EHR → Plataforma)

**Quando acontece:**

- Cron job executa a cada 6 horas
- Ou manualmente via endpoint `/fhir/patients/:id/pull`

**Como funciona:**

```
1. FHIRSchedulerService.pullObservationsFromEHR()
   ↓
2. Busca pacientes com ehrPatientId
   ↓
3. Para cada paciente:
   ↓
4. FHIRClientService.searchObservations()
   - GET /Observation?patient={ehrPatientId}
   ↓
5. Recebe Bundle com observações do EHR
   ↓
6. Para cada observação:
   - Verifica se já existe (por fhirResourceId)
   - Se não existe:
     ↓
7. FHIRTransformerService.fromFHIRObservation()
   - Converte FHIR Observation → Observation interna
   ↓
8. Cria observação no banco
```

### 3. Sincronização em Lote

**Quando acontece:**

- Cron job executa a cada hora
- Ou manualmente via endpoint `/fhir/observations/sync-all`

**Como funciona:**

```
1. Busca observações com syncedToEHR = false
   ↓
2. Processa em lote (até 50 por execução)
   ↓
3. Para cada observação:
   - Tenta sincronizar com EHR
   - Se sucesso: marca como sincronizada
   - Se falha: mantém como não sincronizada (retry depois)
```

## 🔐 Autenticação

### OAuth 2.0 (Preferencial)

```typescript
// Configuração
{
  type: 'oauth2',
  clientId: 'xxx',
  clientSecret: 'yyy',
  tokenUrl: 'https://ehr.com/oauth/token'
}

// Fluxo
1. Cliente faz POST para tokenUrl com client_credentials
2. Recebe access_token
3. Usa token em Authorization: Bearer {token}
4. Token expira → refresh automático
```

### Basic Auth

```typescript
// Configuração
{
  type: 'basic',
  username: 'user',
  password: 'pass'
}

// Fluxo
1. Codifica username:password em base64
2. Usa em Authorization: Basic {base64}
```

### API Key

```typescript
// Configuração
{
  type: 'apikey',
  apiKey: 'xxx',
  apiKeyHeader: 'X-API-Key'  // opcional
}

// Fluxo
1. Adiciona header X-API-Key: xxx
```

## 📊 Componentes Principais

### 1. FHIRAuthService

- Gerencia autenticação (OAuth2, Basic, API Key)
- Cache de tokens (evita requisições desnecessárias)
- Refresh automático de tokens OAuth2

### 2. FHIRClientService

- Cliente HTTP para FHIR REST API
- Métodos: getPatient, createObservation, searchObservations
- Tratamento de erros e retry automático

### 3. FHIRTransformerService

- Transforma dados entre formato interno e FHIR
- `toFHIRPatient()`: Patient interno → FHIR Patient
- `toFHIRObservation()`: Observation interna → FHIR Observation
- `fromFHIRPatient()`: FHIR Patient → Patient interno
- `fromFHIRObservation()`: FHIR Observation → Observation interna

### 4. FHIRSyncService

- Lógica de sincronização
- `syncObservationToEHR()`: Push de observação
- `syncPatientToEHR()`: Push de paciente
- `pullObservationsFromEHR()`: Pull de observações
- `syncUnsyncedObservations()`: Sincronização em lote

### 5. FHIRConfigService

- Gerencia configuração por tenant
- Por enquanto mockado (retorna null)
- Futuro: buscar do banco de dados

### 6. FHIRSchedulerService

- Cron jobs de sincronização
- `@Cron(CronExpression.EVERY_HOUR)`: Sincronização em lote
- `@Cron(CronExpression.EVERY_6_HOURS)`: Pull periódico

## 🎯 Endpoints Disponíveis

### Sincronização Manual

**POST `/api/v1/fhir/observations/:id/sync`**

- Sincronizar observação específica

**POST `/api/v1/fhir/patients/:id/sync`**

- Sincronizar paciente específico

**POST `/api/v1/fhir/observations/sync-all`**

- Sincronizar todas não sincronizadas (até 100)

**POST `/api/v1/fhir/patients/:id/pull`**

- Fazer pull de observações do EHR

## 🔍 Estado Atual

### ✅ Implementado

1. **Cliente FHIR completo**
   - GET/POST/PUT para Patient e Observation
   - Autenticação OAuth2, Basic, API Key
   - Tratamento de erros

2. **Transformação de dados**
   - Internal ↔ FHIR (Patient e Observation)
   - Mapeamento de códigos LOINC

3. **Sincronização automática**
   - Push automático ao criar observação (se realtime)
   - Pull periódico (cron job)
   - Sincronização em lote (cron job)

4. **Integração com ObservationsService**
   - Hook automático após criar observação
   - Não bloqueia criação se sincronização falhar

### ⏳ Pendente

1. **Configuração no banco de dados**
   - Criar tabela `FHIRIntegrationConfig`
   - Interface de configuração por tenant

2. **Retry com exponential backoff**
   - Implementar retry logic mais robusta
   - Dead letter queue para falhas persistentes

3. **Métricas e monitoramento**
   - Contador de sincronizações bem-sucedidas/falhas
   - Dashboard de status de integração

## 🚀 Como Usar

### 1. Habilitar Integração (Desenvolvimento)

Editar `backend/src/integrations/fhir/services/fhir-config.service.ts`:

```typescript
const config: FHIRIntegrationConfig = {
  tenantId,
  enabled: true,
  baseUrl: process.env.FHIR_BASE_URL,
  auth: {
    type: 'oauth2',
    clientId: process.env.FHIR_CLIENT_ID,
    clientSecret: process.env.FHIR_CLIENT_SECRET,
    tokenUrl: process.env.FHIR_TOKEN_URL,
  },
  syncDirection: 'bidirectional',
  syncFrequency: 'realtime',
};
```

### 2. Criar Observação (Push Automático)

```typescript
// Criar observação normalmente
POST /api/v1/observations
{
  "patientId": "patient-123",
  "code": "72514-3",
  "display": "Pain severity",
  "valueQuantity": 7,
  "unit": "/10",
  "effectiveDateTime": "2024-01-15T10:30:00Z"
}

// Se integração habilitada e realtime:
// → Automaticamente sincroniza com EHR
// → Retorna observação com fhirResourceId
```

### 3. Sincronização Manual

```typescript
// Sincronizar observação específica
POST / api / v1 / fhir / observations / { id } / sync;

// Fazer pull de observações
POST / api / v1 / fhir / patients / { id } / pull;
```

## 📝 Logs e Debugging

Todos os serviços usam Logger do NestJS:

```typescript
// Sucesso
this.logger.log(`Observação ${id} sincronizada com EHR`);

// Erro
this.logger.error(`Erro ao sincronizar observação ${id}`, error);

// Aviso
this.logger.warn(`Integração não habilitada para tenant ${tenantId}`);
```

## 🔒 Segurança

- ✅ HTTPS obrigatório (TLS 1.3)
- ✅ Tokens OAuth2 com refresh automático
- ✅ Cache de tokens seguro (em memória)
- ✅ Validação de tenantId em todas as operações
- ✅ Logs de auditoria (quem, quando, o quê)

## 📚 Referências

- [FHIR R4 Specification](https://www.hl7.org/fhir/)
- [LOINC Codes](https://loinc.org/)
- [Documentação de Integração](./integracao-hl7-fhir.md)
