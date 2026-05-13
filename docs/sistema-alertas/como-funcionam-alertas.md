# Sistema de Alertas - Como Funciona

## 📋 Visão Geral

O sistema de alertas é uma funcionalidade crítica que monitora pacientes oncológicos e gera notificações automáticas quando detecta situações que requerem atenção da equipe médica/enfermagem.

---

## 🎯 Tipos de Alertas

### 1. **CRITICAL_SYMPTOM** - Sintoma Crítico Detectado

- **Quando é criado**: Agente de IA detecta sintomas críticos em mensagens WhatsApp
- **Severidade**: Geralmente `CRITICAL`
- **Exemplos**: Febre alta, dispneia, sangramento, dor intensa (≥8/10), vômitos persistentes

### 2. **NO_RESPONSE** - Paciente Não Respondeu

- **Quando é criado**: Paciente não respondeu há ≥3 dias
- **Severidade**: `MEDIUM` ou `HIGH`
- **Contexto**: Última interação registrada

### 3. **DELAYED_APPOINTMENT** - Atraso em Consulta/Exame

- **Quando é criado**: Consulta ou exame agendado não foi realizado no prazo
- **Severidade**: `HIGH` ou `MEDIUM`
- **Contexto**: Data agendada, tipo de consulta/exame

### 4. **SCORE_CHANGE** - Mudança Significativa no Score

- **Quando é criado**: Score de priorização mudou significativamente (ex: de LOW para HIGH)
- **Severidade**: `MEDIUM` ou `HIGH`
- **Contexto**: Score anterior, score novo, motivo da mudança

### 5. **SYMPTOM_WORSENING** - Piora Súbita de Sintomas

- **Quando é criado**: Sintomas pioraram rapidamente entre mensagens
- **Severidade**: `HIGH` ou `CRITICAL`
- **Contexto**: Sintomas anteriores vs atuais

### 6. **NAVIGATION_DELAY** - Atraso em Etapa da Navegação Oncológica

- **Quando é criado**: Etapa obrigatória da jornada oncológica está atrasada
- **Severidade**: `HIGH` ou `CRITICAL` (depende da etapa)
- **Contexto**: `stepId`, `stepKey`, `journeyStage`, `dueDate`, `daysOverdue`
- **Exemplos**: Colonoscopia não realizada, biópsia atrasada, cirurgia não agendada

### 7. **MISSING_EXAM** - Exame Necessário Não Realizado

- **Quando é criado**: Exame necessário para diagnóstico/tratamento não foi realizado
- **Severidade**: `HIGH` ou `MEDIUM`
- **Contexto**: Tipo de exame, prazo esperado

### 8. **STAGING_INCOMPLETE** - Estadiamento Incompleto

- **Quando é criado**: Estadiamento (TNM) não foi completado
- **Severidade**: `HIGH`
- **Contexto**: Etapas faltantes do estadiamento

### 9. **TREATMENT_DELAY** - Atraso no Início do Tratamento

- **Quando é criado**: Tratamento deveria ter iniciado mas não iniciou
- **Severidade**: `CRITICAL` ou `HIGH`
- **Contexto**: Tipo de tratamento, data esperada de início

### 10. **FOLLOW_UP_OVERDUE** - Seguimento Atrasado

- **Quando é criado**: Consulta de seguimento está atrasada
- **Severidade**: `MEDIUM` ou `HIGH`
- **Contexto**: Última consulta, próxima esperada

### 11. **PALLIATIVE_SYMPTOM_WORSENING** - Piora de Sintomas em Paciente Paliativo

- **Quando é criado**: Paciente em tratamento paliativo apresenta piora de sintomas (dor, náusea, dispneia, fadiga, ansiedade, etc.)
- **Severidade**: `HIGH` ou `CRITICAL` (depende da gravidade)
- **Contexto**: Lista de sintomas que pioraram, intensidade, necessidade de ajuste de medicação
- **Método de criação**: `alertsService.createPalliativeSymptomWorseningAlert()`
- **Exemplos**: Dor aumentou de 4/10 para 8/10, dispneia piorou, náuseas persistentes

### 12. **PALLIATIVE_MEDICATION_ADJUSTMENT** - Necessidade de Ajuste de Medicação em Paciente Paliativo

- **Quando é criado**: Paciente paliativo necessita ajuste de medicação para controle de sintomas
- **Severidade**: `MEDIUM` ou `HIGH`
- **Contexto**: Medicação atual, motivo do ajuste (sintoma não controlado, efeito colateral, dose inadequada)
- **Método de criação**: `alertsService.createPalliativeMedicationAdjustmentAlert()`
- **Exemplos**: Analgésico não está controlando dor, necessidade de aumentar dose de antiemético, ajuste de ansiolítico

### 13. **PALLIATIVE_FAMILY_SUPPORT** - Necessidade de Suporte Familiar em Paciente Paliativo

- **Quando é criado**: Identificada necessidade de suporte familiar/psicossocial para paciente paliativo ou seus cuidadores
- **Severidade**: `MEDIUM` ou `HIGH`
- **Contexto**: Motivo da necessidade (sobrecarga do cuidador, conflitos familiares, recursos insuficientes, necessidade de orientação)
- **Método de criação**: `alertsService.createPalliativeFamilySupportAlert()`
- **Exemplos**: Cuidador sobrecarregado, família precisa de orientação sobre cuidados, necessidade de recursos adicionais

### 14. **PALLIATIVE_PSYCHOSOCIAL** - Necessidade de Avaliação Psicossocial em Paciente Paliativo

- **Quando é criado**: Paciente paliativo necessita avaliação psicossocial (ansiedade, depressão, adaptação, questões espirituais)
- **Severidade**: `MEDIUM` ou `HIGH`
- **Contexto**: Motivo da necessidade (sintomas psicológicos, questões espirituais, necessidade de apoio emocional)
- **Método de criação**: `alertsService.createPalliativePsychosocialAlert()`
- **Exemplos**: Ansiedade aumentada, sinais de depressão, questões espirituais não abordadas, necessidade de apoio emocional

---

## 🔴 Níveis de Severidade

### **CRITICAL** (Crítico)

- Requer atenção imediata
- Notificação WebSocket especial (`critical_alert`)
- Exibido em painel destacado no dashboard
- Exemplos: Sintomas críticos, atraso em tratamento, etapas críticas atrasadas

### **HIGH** (Alto)

- Requer atenção prioritária
- Exibido no topo da lista de alertas
- Exemplos: Etapas importantes atrasadas, piora de sintomas

### **MEDIUM** (Médio)

- Requer atenção, mas não urgente
- Exemplos: Atrasos menores, mudanças de score

### **LOW** (Baixo)

- Informativo
- Exemplos: Atrasos não críticos, mudanças menores

---

## 🔄 Ciclo de Vida do Alerta

### Estados (Status)

1. **PENDING** (Pendente)
   - Estado inicial quando alerta é criado
   - Aguardando ação da equipe

2. **ACKNOWLEDGED** (Reconhecido)
   - Equipe visualizou e reconheceu o alerta
   - Registra `acknowledgedBy` e `acknowledgedAt`
   - Ainda requer resolução

3. **RESOLVED** (Resolvido)
   - Problema foi resolvido
   - Registra `resolvedBy` e `resolvedAt`
   - Alerta não aparece mais nas listas de pendentes

4. **DISMISSED** (Descartado)
   - Alerta foi descartado (falso positivo, não aplicável)
   - Registra `dismissedAt`
   - Não requer resolução

### Fluxo de Estados

```
CRIADO → PENDING → ACKNOWLEDGED → RESOLVED
              ↓
         DISMISSED
```

---

## 🚀 Como os Alertas São Criados

### ⚠️ Ordem de Operações: Banco de Dados PRIMEIRO, WebSocket DEPOIS

**Fluxo crítico**: Os alertas são **primeiro registrados no banco de dados** e **depois emitidos via WebSocket**.

**Por quê?**

- Garante persistência mesmo se WebSocket falhar
- O objeto `alert` criado (com ID gerado) é usado para emitir eventos
- Frontend pode fazer refetch se perder evento WebSocket
- Auditoria completa (todos os alertas ficam registrados)

**Código** (`alerts.service.ts`):

```typescript
async create(createAlertDto, tenantId) {
  // 1. Validar paciente
  const patient = await this.prisma.patient.findFirst(...);

  // 2. CRIAR NO BANCO PRIMEIRO
  const alert = await this.prisma.alert.create({
    data: { ...createAlertDto, tenantId, status: 'PENDING' }
  });

  // 3. DEPOIS emitir eventos WebSocket
  if (alert.severity === 'CRITICAL') {
    this.alertsGateway.emitCriticalAlert(tenantId, alert);
  }
  this.alertsGateway.emitNewAlert(tenantId, alert);
  this.alertsGateway.emitOpenAlertsCount(tenantId, count);

  return alert;
}
```

### 1. **Criação Automática pelo Agente de IA**

**Quando**: Processamento de mensagens WhatsApp

**Lógica**:

- Agente detecta sintomas críticos usando palavras-chave ou LLM
- Se detectar sintoma crítico → cria alerta `CRITICAL_SYMPTOM`
- Marca mensagem com `alertTriggered = true`

**📍 Onde o Agente Está Implementado**:

O agente pode estar implementado em:

- **n8n** (workflow automation) - **Atual**
- **AI Service Python** (FastAPI) - Alternativa

---

#### **Opção A: Agente no n8n (Atual)**

**Como criar alerta**: SQL direto no PostgreSQL ou via API REST

**📚 Documentação completa**: Ver [`docs/sistema-alertas/n8n-criar-alerta-postgres.md`](./n8n-criar-alerta-postgres.md)

**Query SQL**:

```sql
INSERT INTO alerts (
  id, "tenantId", "patientId", type, severity, message, context, status, "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  $1::uuid,  -- tenantId
  $2::uuid,  -- patientId
  'CRITICAL_SYMPTOM'::"AlertType",
  'CRITICAL'::"AlertSeverity",
  $3::text,  -- message
  $4::jsonb, -- context
  'PENDING'::"AlertStatus",
  NOW(),
  NOW()
) RETURNING *;
```

**⚠️ IMPORTANTE**: Criar direto no PostgreSQL **NÃO emite WebSocket automaticamente**. Veja seção "WebSocket" na documentação.

**Alternativa (Recomendado)**: Usar API REST mesmo no n8n:

```
[HTTP Request] POST /api/v1/alerts
```

---

#### **Opção B: Agente no AI Service Python**

**Como criar alerta**: Via API REST do backend

**📚 Documentação completa**: Ver [`docs/sistema-alertas/agente-ia-criar-alerta.md`](./agente-ia-criar-alerta.md)

**Endpoint**: `POST http://localhost:3002/api/v1/alerts`

**Código**: o fluxo produtivo passa pelo **`AgentOrchestrator`** (`ai-service/src/agent/orchestrator.py`). O backend Nest expõe **`POST /api/v1/agent/process`**, que encaminha ao AI Service (FastAPI, mesma rota versionada) — é o único endpoint conversacional. Alertas críticos são compilados no orquestrador e persistidos pelo backend quando aplicável (ver `agente-ia-criar-alerta.md`).

**Fluxo**:

1. Agente detecta sintomas críticos
2. Agente faz `POST /api/v1/alerts` para o backend
3. Backend valida e cria registro no banco
4. Backend emite eventos WebSocket
5. Frontend recebe notificação em tempo real

### 2. **Criação Automática pelo Scheduler de Navegação**

**Quando**: Verificação diária às 6h (e a cada hora em desenvolvimento)

**Lógica** (`oncology-navigation.scheduler.ts`):

- Executa `checkOverdueSteps()` para todos os tenants
- Verifica etapas com `dueDate` passado e `isCompleted = false`
- Cria alerta `NAVIGATION_DELAY` se etapa está atrasada

**Código** (`oncology-navigation.service.ts`):

```typescript
private async checkAndCreateAlertForStep(step, tenantId) {
  // Verifica se etapa está atrasada
  if (stepDueDate < today && !step.isCompleted) {
    // Verifica se já existe alerta pendente
    const existingAlert = await this.findExistingAlert(step);

    if (!existingAlert) {
      // Cria novo alerta
      await this.alertsService.create({
        patientId: step.patientId,
        type: 'NAVIGATION_DELAY',
        severity: this.getSeverityForStep(step),
        message: `Etapa atrasada: ${step.stepName} (${daysOverdue} dias)`,
        context: { stepId, stepKey, journeyStage, dueDate, daysOverdue }
      }, tenantId);
    }
  }
}
```

### 3. **Criação Manual via API**

**Quando**: Sistema ou usuário admin cria alerta manualmente

**Endpoint**: `POST /api/v1/alerts`

**Permissões**: `ADMIN` ou `COORDINATOR`

**Exemplo**:

```typescript
await alertsApi.create({
  patientId: 'patient-id',
  type: 'CRITICAL_SYMPTOM',
  severity: 'CRITICAL',
  message: 'Paciente relatou febre alta',
  context: { conversationId: '...', symptom: 'febre' },
});
```

### 4. **Criação de Alertas Paliativos**

**Quando**: Paciente em tratamento paliativo (`status: PALLIATIVE_CARE`) apresenta necessidades específicas

**Métodos auxiliares** no `AlertsService`:

#### **Piora de Sintomas**

```typescript
await alertsService.createPalliativeSymptomWorseningAlert(
  patientId,
  tenantId,
  ['dor', 'náusea', 'dispneia'], // Lista de sintomas
  'HIGH' // Severidade
);
```

**Quando usar**: Paciente paliativo relata piora de sintomas (dor aumentou, náuseas persistentes, dispneia piorou, etc.)

#### **Ajuste de Medicação**

```typescript
await alertsService.createPalliativeMedicationAdjustmentAlert(
  patientId,
  tenantId,
  'Morfina', // Medicação
  'Dor não controlada com dose atual', // Motivo
  'MEDIUM' // Severidade
);
```

**Quando usar**: Necessidade de ajustar medicação para controle de sintomas (aumentar dose, trocar medicação, adicionar adjuvante)

#### **Suporte Familiar**

```typescript
await alertsService.createPalliativeFamilySupportAlert(
  patientId,
  tenantId,
  'Cuidador sobrecarregado - necessidade de orientação', // Motivo
  'MEDIUM' // Severidade
);
```

**Quando usar**: Identificada necessidade de suporte familiar (sobrecarga do cuidador, conflitos, recursos insuficientes)

#### **Avaliação Psicossocial**

```typescript
await alertsService.createPalliativePsychosocialAlert(
  patientId,
  tenantId,
  'Ansiedade aumentada - necessidade de avaliação psicológica', // Motivo
  'HIGH' // Severidade
);
```

**Quando usar**: Necessidade de avaliação psicossocial (ansiedade, depressão, questões espirituais, apoio emocional)

**Integração com Navegação Oncológica**:

- Quando paciente em `PALLIATIVE_CARE` tem etapas de navegação específicas (ex: "Avaliação de Sintomas", "Revisão de Medicação")
- Etapas atrasadas podem gerar alertas `NAVIGATION_DELAY` com severidade ajustada para contexto paliativo
- Sistema pode detectar automaticamente piora de sintomas através de mensagens WhatsApp e gerar alertas paliativos

---

## 📡 Notificações em Tempo Real (WebSocket)

### ⚠️ Ordem de Operações: Banco de Dados → WebSocket

**Sequência exata**:

```
1. Validação (verificar paciente existe)
   ↓
2. CRIAR REGISTRO NO BANCO DE DADOS
   ↓ (alert criado com ID gerado)
3. EMITIR EVENTOS WEBSOCKET
   ↓
4. Retornar alert criado
```

**Por que essa ordem?**

1. **Persistência garantida**: Se WebSocket falhar, alerta ainda está salvo
2. **ID gerado**: Banco gera UUID que é usado nos eventos WebSocket
3. **Recuperação**: Frontend pode fazer refetch se perder evento
4. **Auditoria**: Todos os alertas ficam registrados para histórico

**Código real** (`alerts.service.ts:71-117`):

```89:116:backend/src/alerts/alerts.service.ts
    const alert = await this.prisma.alert.create({
      data: {
        ...createAlertDto,
        tenantId, // SEMPRE incluir tenantId
        status: 'PENDING', // Status inicial sempre PENDING (conforme schema)
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    // Emitir evento WebSocket para notificar clientes conectados
    if (alert.severity === 'CRITICAL') {
      this.alertsGateway.emitCriticalAlert(tenantId, alert);
    }
    this.alertsGateway.emitNewAlert(tenantId, alert);
    this.alertsGateway.emitOpenAlertsCount(
      tenantId,
      await this.getOpenAlertsCount(tenantId)
    );

    return alert;
```

**⚠️ Importante**: Se o WebSocket falhar após criar no banco, o alerta ainda existe e pode ser recuperado via API. O frontend faz refetch periódico para garantir sincronização.

### Gateway de Alertas

**Namespace**: `/alerts`

**Autenticação**: JWT obrigatório no handshake

**Rooms**:

- `tenant:${tenantId}` - Todos os usuários do tenant
- `user:${userId}` - Usuário específico
- `patient:${patientId}:tenant:${tenantId}` - Alertas de paciente específico

### Eventos Emitidos

#### 1. **critical_alert**

- **Quando**: Alerta crítico é criado
- **Payload**: Objeto `Alert` completo
- **Ação no Frontend**: Notificação do navegador + atualização imediata

#### 2. **new_alert**

- **Quando**: Qualquer alerta é criado
- **Payload**: Objeto `Alert` completo
- **Ação no Frontend**: Atualizar lista de alertas

#### 3. **alert_updated**

- **Quando**: Status do alerta muda (ACKNOWLEDGED, RESOLVED, etc.)
- **Payload**: Objeto `Alert` atualizado
- **Ação no Frontend**: Atualizar alerta específico na lista

#### 4. **open_alerts_count**

- **Quando**: Contagem de alertas abertos muda
- **Payload**: `{ count: number }`
- **Ação no Frontend**: Atualizar badge/contador

### Código Frontend (`useAlertsSocket.ts`):

```typescript
socket.on('critical_alert', (alert: Alert) => {
  setAlerts((prev) => [alert, ...prev]);

  // Notificação do navegador
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Alerta Crítico', {
      body: alert.message,
      icon: '/favicon.ico',
    });
  }
});
```

---

## 🎨 Interface do Usuário

### Componentes Principais

#### 1. **AlertsPanel** (`alerts-panel.tsx`)

- Lista todos os alertas pendentes
- Filtro por severidade
- Ações: Reconhecer, Resolver
- Ordenação: Severidade (CRITICAL primeiro) → Data (mais recente)

#### 2. **CriticalAlertsPanel** (`critical-alerts-panel.tsx`)

- Painel destacado no topo do dashboard
- Mostra apenas alertas `CRITICAL` ou `HIGH`
- Expandido por padrão
- Máximo 3 alertas visíveis (com indicador "+X mais")

#### 3. **AlertDetails** (`alert-details.tsx`)

- Detalhes completos do alerta
- Informações do paciente
- Contexto (JSON)
- Histórico de ações

### Ações Disponíveis

#### **Reconhecer** (`acknowledge`)

- Muda status para `ACKNOWLEDGED`
- Registra `acknowledgedBy` e `acknowledgedAt`
- Endpoint: `PATCH /api/v1/alerts/:id/acknowledge`

#### **Resolver** (`resolve`)

- Muda status para `RESOLVED`
- Registra `resolvedBy` e `resolvedAt`
- Endpoint: `PATCH /api/v1/alerts/:id/resolve`

#### **Descartar** (`dismiss`)

- Muda status para `DISMISSED`
- Registra `dismissedAt`
- Endpoint: `PATCH /api/v1/alerts/:id/dismiss`

---

## 📊 Métricas e Estatísticas

### Contadores Disponíveis

#### **Total de Alertas Abertos**

- Endpoint: `GET /api/v1/alerts/open/count`
- Retorna: `{ count: number }`
- Usado em: Badge no dashboard, KPIs

#### **Alertas Críticos**

- Endpoint: `GET /api/v1/alerts/critical/count`
- Retorna: `{ count: number }`
- Usado em: Painel crítico, alertas prioritários

### Queries Úteis

**Alertas Pendentes por Severidade**:

```sql
SELECT severity, COUNT(*) as count
FROM alerts
WHERE tenantId = $1 AND status = 'PENDING'
GROUP BY severity
ORDER BY severity DESC;
```

**Tempo Médio de Resolução**:

```sql
SELECT AVG(EXTRACT(EPOCH FROM (resolvedAt - createdAt))) / 3600 as avg_hours
FROM alerts
WHERE tenantId = $1
  AND status = 'RESOLVED'
  AND resolvedAt IS NOT NULL;
```

**Alertas por Tipo**:

```sql
SELECT type, COUNT(*) as count
FROM alerts
WHERE tenantId = $1 AND status = 'PENDING'
GROUP BY type
ORDER BY count DESC;
```

---

## 🔍 Detalhamento por Tipo de Alerta

### CRITICAL_SYMPTOM

**Criação**:

1. Paciente envia mensagem via WhatsApp
2. Agente de IA processa mensagem
3. Detecta sintomas críticos (palavras-chave ou LLM)
4. Backend cria alerta via `POST /api/v1/alerts`
5. WebSocket emite `critical_alert` para todos do tenant

**Contexto** (`context` JSON):

```json
{
  "conversationId": "uuid",
  "messageId": "uuid",
  "symptom": "febre",
  "severity": "high",
  "extractedData": { "temperature": 39.5 }
}
```

**Ação Esperada**:

- Enfermagem contata paciente imediatamente
- Avalia necessidade de atendimento urgente
- Registra intervenção

---

### NAVIGATION_DELAY

**Criação**:

1. Scheduler executa diariamente às 6h
2. Verifica todas as etapas com `dueDate` passado
3. Se etapa não está completa → cria alerta
4. Evita duplicatas (verifica se já existe alerta pendente)

**Contexto** (`context` JSON):

```json
{
  "stepId": "uuid",
  "stepKey": "colonoscopy",
  "journeyStage": "DIAGNOSIS",
  "dueDate": "2024-11-10T00:00:00Z",
  "daysOverdue": 3,
  "cancerType": "colorectal"
}
```

**Severidade**:

- **CRITICAL**: Etapas críticas (ex: cirurgia, início de tratamento)
- **HIGH**: Etapas importantes (ex: biópsia, estadiamento)
- **MEDIUM**: Etapas de rotina

**Ação Esperada**:

- Coordenador verifica motivo do atraso
- Agenda etapa se necessário
- Atualiza `NavigationStep` quando concluída

---

### NO_RESPONSE

**Criação** (planejado):

1. Job verifica `lastInteraction` de cada paciente
2. Se `lastInteraction` > 3 dias → cria alerta
3. Verifica se já existe alerta pendente

**Contexto**:

```json
{
  "lastInteraction": "2024-11-10T10:00:00Z",
  "daysSinceLastInteraction": 4,
  "lastMessageType": "OUTBOUND"
}
```

**Ação Esperada**:

- Enfermagem tenta contato
- Verifica se paciente está bem
- Atualiza `lastInteraction` quando paciente responde

---

## 🔐 Segurança e Permissões

### Permissões por Ação

| Ação                     | Roles Permitidos                      |
| ------------------------ | ------------------------------------- |
| **Listar alertas**       | ADMIN, ONCOLOGIST, NURSE, COORDINATOR |
| **Ver alertas críticos** | ADMIN, ONCOLOGIST, NURSE, COORDINATOR |
| **Criar alerta**         | ADMIN, COORDINATOR (sistema/AI)       |
| **Reconhecer**           | ADMIN, ONCOLOGIST, NURSE, COORDINATOR |
| **Resolver**             | ADMIN, ONCOLOGIST, NURSE, COORDINATOR |
| **Descartar**            | ADMIN, ONCOLOGIST, COORDINATOR        |

### Isolamento Multi-Tenant

**⚠️ CRÍTICO**: Todas as queries incluem `tenantId`:

```typescript
// ✅ CORRETO
const alerts = await prisma.alert.findMany({
  where: { tenantId, status: 'PENDING' },
});

// ❌ ERRADO - Sem tenantId!
const alerts = await prisma.alert.findMany({
  where: { status: 'PENDING' },
});
```

---

## 📈 Performance e Otimizações

### Índices no Banco de Dados

**Tabela `alerts`**:

- `tenantId` - Isolamento multi-tenant
- `patientId` - Busca por paciente
- `status` - Filtro por status
- `severity, createdAt` - Ordenação (composto)

### Cache e Atualização

**Frontend**:

- React Query com `staleTime: 1 minuto`
- Atualização via WebSocket (tempo real)
- Refetch automático a cada 30s para contadores

**Backend**:

- WebSocket emite apenas para tenant específico
- Evita duplicação de alertas (verifica existência antes de criar)

---

## 🧪 Testes e Validação

### Cenários de Teste

1. **Criação de Alerta Crítico**:
   - Agente detecta sintoma crítico
   - Alerta é criado com severidade `CRITICAL`
   - WebSocket emite `critical_alert`
   - Frontend recebe e exibe notificação

2. **Alerta de Etapa Atrasada**:
   - Scheduler verifica etapas
   - Etapa com `dueDate` passado
   - Alerta `NAVIGATION_DELAY` é criado
   - Não cria duplicata se já existe

3. **Reconhecimento e Resolução**:
   - Usuário reconhece alerta
   - Status muda para `ACKNOWLEDGED`
   - Usuário resolve alerta
   - Status muda para `RESOLVED`
   - Alerta não aparece mais em pendentes

---

## 🔄 Integração com Outros Módulos

### Mensagens WhatsApp

- Campo `alertTriggered` marca mensagem que gerou alerta
- Campo `criticalSymptomsDetected` lista sintomas detectados

### Navegação Oncológica

- Alertas criados quando etapas estão atrasadas
- Contexto inclui `stepId` para rastreabilidade
- Quando etapa é concluída, alerta pode ser resolvido automaticamente

### Priorização IA

- Mudanças de score podem gerar alerta `SCORE_CHANGE`
- Score alto pode indicar necessidade de atenção

### Dashboard

- Métricas de alertas (total, críticos, tempo médio de resolução)
- Gráficos de alertas por tipo/severidade
- KPIs de resposta da equipe

---

## 📝 Exemplos Práticos

### Exemplo 1: Alerta de Sintoma Crítico

**Cenário**: Paciente envia "Estou com febre alta e não consigo respirar direito"

**Fluxo**:

1. Mensagem chega via WhatsApp webhook
2. Agente de IA processa mensagem
3. Detecta: `febre` + `dispneia` (sintomas críticos)
4. Backend cria alerta:
   ```json
   {
     "patientId": "patient-uuid",
     "type": "CRITICAL_SYMPTOM",
     "severity": "CRITICAL",
     "message": "Paciente relatou febre alta e dispneia",
     "context": {
       "conversationId": "conv-uuid",
       "messageId": "msg-uuid",
       "symptoms": ["febre", "dispneia"]
     }
   }
   ```
5. WebSocket emite `critical_alert` para todos do tenant
6. Frontend recebe e exibe notificação
7. Enfermagem vê alerta no dashboard
8. Enfermagem reconhece → status `ACKNOWLEDGED`
9. Enfermagem contata paciente → resolve → status `RESOLVED`

---

### Exemplo 2: Alerta de Etapa Atrasada

**Cenário**: Paciente com câncer colorretal deveria ter feito colonoscopia há 3 dias

**Fluxo**:

1. Scheduler executa às 6h
2. Verifica etapa `colonoscopy` do paciente
3. `dueDate = 2024-11-10`, hoje = 2024-11-13
4. Etapa não está completa (`isCompleted = false`)
5. Verifica se já existe alerta pendente → não existe
6. Cria alerta:
   ```json
   {
     "patientId": "patient-uuid",
     "type": "NAVIGATION_DELAY",
     "severity": "HIGH",
     "message": "Etapa atrasada: Colonoscopia (3 dias de atraso)",
     "context": {
       "stepId": "step-uuid",
       "stepKey": "colonoscopy",
       "journeyStage": "DIAGNOSIS",
       "dueDate": "2024-11-10T00:00:00Z",
       "daysOverdue": 3
     }
   }
   ```
7. Coordenador vê alerta no dashboard
8. Coordenador agenda colonoscopia
9. Quando colonoscopia é realizada → etapa marcada como completa
10. Alerta pode ser resolvido automaticamente ou manualmente

---

## 🐛 Troubleshooting

### Alerta não aparece no frontend

- Verificar conexão WebSocket (`useAlertsSocket`)
- Verificar se está conectado na room correta (`tenant:${tenantId}`)
- Verificar filtros aplicados (severidade, status)
- Verificar permissões do usuário

### Alertas duplicados

- Verificar lógica de verificação de existência antes de criar
- Verificar se scheduler não está executando múltiplas vezes
- Verificar se não há múltiplos webhooks processando mesma mensagem

### WebSocket não emite eventos

- Verificar se `AlertsGateway` está registrado no módulo
- Verificar autenticação JWT no handshake
- Verificar logs do backend para erros

### Alertas não são criados automaticamente

- Verificar se scheduler está rodando (`@Cron`)
- Verificar logs do scheduler
- Verificar se agente de IA está detectando sintomas corretamente
- Verificar se backend está recebendo dados do agente

---

## 📚 Referências

- [Schema Prisma - Alert](../backend/prisma/schema.prisma)
- [AlertsService](../backend/src/alerts/alerts.service.ts)
- [AlertsGateway](../backend/src/gateways/alerts.gateway.ts)
- [OncologyNavigationService](../backend/src/oncology-navigation/oncology-navigation.service.ts)
- [Agent Orchestrator](../ai-service/src/agent/orchestrator.py)

---

**Última atualização**: 2024-11-13
