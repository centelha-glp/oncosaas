# Plano Técnico: Agentes de Navegação Oncológica

## 1. Requisitos Consolidados

| Requisito        | Decisão                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| Canais           | WhatsApp (principal) + SMS fallback + Vapi/ElevenLabs (voz) + Chat nativo |
| Monitoramento    | Sintomas + Adesão ao tratamento + Triagem de urgência                     |
| Autonomia        | Semi-autônomo (protocolos, decisões críticas → aprovação humana)          |
| LLM              | Configurável por tenant (Claude / GPT-4)                                  |
| Tipos de câncer  | Colorretal, bexiga, renal, próstata                                       |
| Questionários    | PRO-CTCAE e ESAS em formato conversacional + aprofundamento livre         |
| Frequência       | Configurável por etapa + ajustada por nível de risco                      |
| Contexto clínico | Completo (diagnósticos, tratamentos, exames, alertas, navegação)          |
| MVP              | Arquitetura extensível + WhatsApp como primeiro canal                     |

---

## 2. Novos Modelos no Prisma Schema

### 2.1 Conversation — Agrupa mensagens em sessões

```prisma
model Conversation {
  id        String @id @default(uuid())
  tenantId  String
  patientId String

  // Canal de comunicação
  channel   ChannelType @default(WHATSAPP)

  // Estado da conversa
  status    ConversationStatus @default(ACTIVE)

  // Quem está respondendo
  handledBy HandledBy @default(AGENT)
  assumedByUserId String?   // userId que assumiu (se NURSING)
  assumedAt       DateTime?

  // Contexto do agente
  agentState Json? // Estado persistente do agente (extracted facts, current topic, etc.)

  // Questionário em andamento (se houver)
  activeQuestionnaireId String?
  questionnaireProgress Json? // { currentQuestion: int, answers: {} }

  // Metadados
  lastMessageAt DateTime?
  messageCount  Int @default(0)

  // Relacionamentos
  tenant    Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  patient   Patient   @relation(fields: [patientId], references: [id], onDelete: Cascade)
  messages  Message[]
  decisions AgentDecisionLog[]
  scheduledActions ScheduledAction[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
  @@index([patientId])
  @@index([status])
  @@index([lastMessageAt])
  @@map("conversations")
}

enum ChannelType {
  WHATSAPP
  SMS
  VOICE
  WEB_CHAT
}

enum ConversationStatus {
  ACTIVE       // Em andamento
  WAITING      // Aguardando resposta do paciente
  ESCALATED    // Escalada para enfermagem
  CLOSED       // Encerrada
}

enum HandledBy {
  AGENT    // IA respondendo
  NURSING  // Enfermagem assumiu
  HYBRID   // IA + enfermagem
}
```

### 2.2 AgentConfig — Configuração do agente por tenant

```prisma
model AgentConfig {
  id       String @id @default(uuid())
  tenantId String @unique

  // Provedor LLM
  llmProvider      String @default("anthropic") // "anthropic" | "openai"
  llmModel         String @default("claude-sonnet-4-6")
  llmFallbackProvider String? // Fallback se o principal falhar
  llmFallbackModel    String?

  // Chaves de API (criptografadas)
  anthropicApiKey  String? // Criptografado via encryption.util
  openaiApiKey     String? // Criptografado via encryption.util

  // Voz (Vapi)
  vapiApiKey        String?
  vapiAssistantId   String?
  elevenLabsApiKey  String?
  elevenLabsVoiceId String?

  // SMS (Twilio)
  twilioAccountSid  String?
  twilioAuthToken   String?
  twilioPhoneNumber String?

  // Comportamento do agente
  agentLanguage    String @default("pt-BR")
  maxAutoReplies   Int    @default(10) // Máx respostas automáticas por conversa antes de escalar
  escalationRules  Json?  // Regras customizadas de escalação
  greeting         String? // Mensagem de saudação customizada

  // Check-in scheduling
  defaultCheckInFrequency Json? // { "TREATMENT": "daily", "FOLLOW_UP": "weekly" }
  riskBasedAdjustment     Boolean @default(true)

  // Relacionamentos
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("agent_configs")
}
```

### 2.3 AgentDecisionLog — Audit trail de decisões

```prisma
model AgentDecisionLog {
  id             String @id @default(uuid())
  tenantId       String
  conversationId String
  patientId      String

  // Decisão
  decisionType  AgentDecisionType
  reasoning     String   // Explicação da decisão
  confidence    Float?   // 0-1 confiança na decisão
  inputData     Json     // Dados que informaram a decisão
  outputAction  Json     // Ação tomada

  // Aprovação humana (para decisões que precisam)
  requiresApproval Boolean  @default(false)
  approvedBy       String?  // userId
  approvedAt       DateTime?
  rejected         Boolean  @default(false)
  rejectionReason  String?

  // Relacionamentos
  tenant       Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([tenantId])
  @@index([conversationId])
  @@index([decisionType])
  @@index([requiresApproval])
  @@map("agent_decision_logs")
}

enum AgentDecisionType {
  SYMPTOM_DETECTED       // Detectou sintoma
  CRITICAL_ESCALATION    // Escalou caso crítico
  QUESTIONNAIRE_STARTED  // Iniciou questionário
  QUESTIONNAIRE_SCORED   // Pontuou questionário
  CHECK_IN_SCHEDULED     // Agendou check-in
  PRIORITY_UPDATED       // Atualizou prioridade
  HANDOFF_TO_NURSING     // Transferiu para enfermagem
  ALERT_CREATED          // Criou alerta
  RESPONSE_GENERATED     // Gerou resposta (rotina)
}
```

### 2.4 ScheduledAction — Check-ins e lembretes agendados

```prisma
model ScheduledAction {
  id             String @id @default(uuid())
  tenantId       String
  patientId      String
  conversationId String?

  // Tipo de ação
  actionType     ScheduledActionType
  channel        ChannelType @default(WHATSAPP)

  // Agendamento
  scheduledAt    DateTime
  executedAt     DateTime?
  status         ScheduledActionStatus @default(PENDING)

  // Conteúdo
  payload        Json // { message, questionnaireId, protocol, etc. }

  // Recorrência
  isRecurring    Boolean @default(false)
  recurrenceRule String? // cron expression ou "daily", "weekly", etc.
  nextOccurrence DateTime?

  // Metadados
  retryCount     Int @default(0)
  maxRetries     Int @default(3)
  lastError      String?

  // Relacionamentos
  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversation Conversation? @relation(fields: [conversationId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
  @@index([patientId])
  @@index([scheduledAt])
  @@index([status])
  @@map("scheduled_actions")
}

enum ScheduledActionType {
  CHECK_IN             // Check-in de rotina
  QUESTIONNAIRE        // Aplicar questionário
  MEDICATION_REMINDER  // Lembrete de medicamento
  APPOINTMENT_REMINDER // Lembrete de consulta/exame
  FOLLOW_UP            // Acompanhamento pós-consulta
  VOICE_CALL           // Ligação automatizada via Vapi
}

enum ScheduledActionStatus {
  PENDING    // Aguardando execução
  EXECUTING  // Em execução
  COMPLETED  // Executada com sucesso
  FAILED     // Falhou
  CANCELLED  // Cancelada
  SKIPPED    // Pulada (paciente já respondeu)
}
```

### 2.5 ClinicalProtocol — Protocolos por tipo de câncer

```prisma
model ClinicalProtocol {
  id       String @id @default(uuid())
  tenantId String

  // Identificação
  cancerType   String // "colorectal", "bladder", "renal", "prostate"
  name         String // "Protocolo Colorretal Padrão"
  version      String @default("1.0")
  isActive     Boolean @default(true)

  // Definição do protocolo (JSON)
  // Contém: etapas por journeyStage, timing, dependências, questionários
  definition   Json

  // Check-in rules por etapa do tratamento
  checkInRules Json // { "TREATMENT": { "frequency": "daily", "questionnaire": "ESAS" }, ... }

  // Sintomas críticos específicos do tipo de câncer
  criticalSymptoms Json // [{ keyword, severity, action }]

  // Relacionamentos
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, cancerType, version])
  @@index([tenantId])
  @@index([cancerType])
  @@map("clinical_protocols")
}
```

### 2.6 Alterações nos modelos existentes

```prisma
// Adicionar ao model Message:
  conversationRef Conversation? @relation(fields: [conversationId], references: [id])
  channel         ChannelType   @default(WHATSAPP) // Novo campo

// Adicionar ao model Patient:
  conversations Conversation[]

// Adicionar ao model Tenant:
  agentConfig       AgentConfig?
  conversations     Conversation[]
  agentDecisionLogs AgentDecisionLog[]
  scheduledActions  ScheduledAction[]
  clinicalProtocols ClinicalProtocol[]

// Adicionar ao model QuestionnaireResponse:
  conversationId String?
  scores         Json? // Scores calculados automaticamente
```

---

## 3. Módulos Backend (NestJS)

### 3.1 `channel-gateway/` — Gateway Unificado de Canais

```
backend/src/channel-gateway/
├── channel-gateway.module.ts
├── channel-gateway.service.ts        # Interface unificada send/receive
├── channel-gateway.controller.ts     # Endpoints de webhook
├── dto/
│   ├── incoming-message.dto.ts       # Mensagem normalizada (qualquer canal)
│   └── outgoing-message.dto.ts       # Mensagem para enviar
├── channels/
│   ├── whatsapp.channel.ts           # Enviar/receber WhatsApp
│   ├── sms.channel.ts                # Enviar/receber SMS (Twilio)
│   ├── voice.channel.ts              # Iniciar/receber ligação (Vapi)
│   └── web-chat.channel.ts           # Chat nativo (WebSocket)
└── interfaces/
    └── channel.interface.ts          # Interface base para canais
```

**Endpoints:**

- `POST /channel-gateway/webhook/whatsapp` — Webhook WhatsApp (público)
- `GET  /channel-gateway/webhook/whatsapp` — Verificação de webhook (challenge)
- `POST /channel-gateway/webhook/sms` — Webhook SMS Twilio
- `POST /channel-gateway/webhook/voice` — Webhook Vapi
- `POST /channel-gateway/send` — Enviar mensagem (interno)

**Fluxo de recebimento (WhatsApp):**

```
1. Meta envia webhook → controller valida assinatura
2. Extrai mensagem do payload Meta
3. Normaliza para IncomingMessageDto { patientPhone, content, channel, mediaUrl? }
4. Busca Patient pelo phoneHash
5. Busca/cria Conversation ativa
6. Salva Message no banco
7. Emite WebSocket event "newMessage"
8. Envia para Agent Orchestrator (via HTTP para ai-service)
9. Recebe resposta do agente
10. Envia resposta ao paciente via canal
11. Salva Message de resposta
```

### 3.2 `agent/` — Orquestrador de Agente (Backend)

```
backend/src/agent/
├── agent.module.ts
├── agent.controller.ts               # Endpoints de agente
├── agent.service.ts                  # Orquestra chamadas ao ai-service
├── agent-scheduler.service.ts        # Cron jobs para check-ins agendados
├── decision-gate.service.ts          # Lógica semi-autônoma
├── conversation.service.ts           # CRUD de conversas + estado
├── dto/
│   ├── agent-response.dto.ts
│   ├── conversation.dto.ts
│   └── schedule-action.dto.ts
└── interfaces/
    └── agent-decision.interface.ts
```

**agent.service.ts — Fluxo principal:**

```typescript
async processIncomingMessage(dto: IncomingMessageDto): Promise<AgentResponseDto> {
  // 1. Buscar/criar conversa
  const conversation = await this.conversationService.getOrCreate(dto.patientId, dto.channel);

  // 2. Verificar se conversa está com enfermagem
  if (conversation.handledBy === 'NURSING') {
    return { action: 'FORWARD_TO_NURSING', response: null };
  }

  // 3. Montar contexto clínico completo do paciente
  const clinicalContext = await this.buildClinicalContext(dto.patientId);

  // 4. Buscar protocolo do tipo de câncer
  const protocol = await this.getActiveProtocol(clinicalContext.cancerType);

  // 5. Buscar histórico recente da conversa
  const history = await this.conversationService.getRecentHistory(conversation.id, 20);

  // 6. Chamar ai-service
  const aiResponse = await this.callAIService({
    message: dto.content,
    patientId: dto.patientId,
    clinicalContext,
    protocol,
    conversationHistory: history,
    agentState: conversation.agentState,
    agentConfig: await this.getAgentConfig(dto.tenantId),
  });

  // 7. Decision Gate — verificar se ações precisam de aprovação
  const decisions = await this.decisionGate.evaluate(aiResponse);

  // 8. Executar ações automáticas
  for (const decision of decisions.autoApproved) {
    await this.executeDecision(decision);
  }

  // 9. Criar alertas para decisões que precisam de aprovação
  for (const decision of decisions.needsApproval) {
    await this.createApprovalRequest(decision);
  }

  // 10. Atualizar estado da conversa
  await this.conversationService.updateState(conversation.id, aiResponse.newState);

  // 11. Logar decisão
  await this.logDecision(conversation.id, aiResponse);

  return aiResponse;
}
```

**decision-gate.service.ts — Regras semi-autônomas:**

```typescript
// Ações que o agente pode tomar sozinho:
const AUTO_APPROVED = [
  'RESPOND_TO_QUESTION', // Responder perguntas gerais
  'APPLY_QUESTIONNAIRE', // Aplicar questionário
  'SCHEDULE_CHECK_IN', // Agendar check-in
  'SEND_REMINDER', // Enviar lembrete
  'RECORD_SYMPTOM', // Registrar sintoma reportado
  'CREATE_LOW_ALERT', // Criar alerta de baixa severidade
  'UPDATE_NAVIGATION_STEP', // Atualizar etapa de navegação (marcar como concluída)
];

// Ações que precisam de aprovação humana:
const NEEDS_APPROVAL = [
  'CRITICAL_ESCALATION', // Escalar caso crítico
  'CHANGE_TREATMENT_STATUS', // Alterar status de tratamento
  'CREATE_HIGH_CRITICAL_ALERT', // Alerta HIGH ou CRITICAL
  'RECOMMEND_APPOINTMENT', // Recomendar consulta urgente
  'HANDOFF_TO_SPECIALIST', // Encaminhar para especialista
];
```

**agent-scheduler.service.ts — Cron jobs:**

```typescript
// A cada minuto: verificar ScheduledActions pendentes
@Cron('* * * * *')
async executeScheduledActions() {
  const due = await this.findDueActions();
  for (const action of due) {
    switch (action.actionType) {
      case 'CHECK_IN':
        await this.executeCheckIn(action);
        break;
      case 'QUESTIONNAIRE':
        await this.executeQuestionnaire(action);
        break;
      case 'VOICE_CALL':
        await this.executeVoiceCall(action);
        break;
      // ...
    }
  }
}
```

### 3.3 `clinical-protocols/` — Motor de Protocolos

```
backend/src/clinical-protocols/
├── clinical-protocols.module.ts
├── clinical-protocols.service.ts
├── clinical-protocols.controller.ts
├── dto/
│   └── protocol.dto.ts
└── templates/
    ├── colorectal.protocol.ts   # Protocolo colorretal
    ├── bladder.protocol.ts      # Protocolo bexiga
    ├── renal.protocol.ts        # Protocolo renal
    └── prostate.protocol.ts     # Protocolo próstata
```

**Exemplo de template de protocolo (`colorectal.protocol.ts`):**

```typescript
export const COLORECTAL_PROTOCOL = {
  cancerType: 'colorectal',
  name: 'Protocolo de Navegação - Câncer Colorretal',

  journeyStages: {
    SCREENING: {
      steps: [
        {
          key: 'initial_assessment',
          name: 'Avaliação Inicial',
          daysToComplete: 7,
        },
        {
          key: 'fecal_occult_blood',
          name: 'Pesquisa de Sangue Oculto',
          daysToComplete: 14,
        },
        {
          key: 'colonoscopy_referral',
          name: 'Encaminhamento Colonoscopia',
          daysToComplete: 30,
        },
      ],
    },
    DIAGNOSIS: {
      steps: [
        { key: 'colonoscopy', name: 'Colonoscopia', daysToComplete: 30 },
        {
          key: 'biopsy',
          name: 'Biópsia',
          daysToComplete: 14,
          dependsOn: 'colonoscopy',
        },
        {
          key: 'pathology_report',
          name: 'Laudo Anatomopatológico',
          daysToComplete: 21,
          dependsOn: 'biopsy',
        },
        { key: 'staging_ct', name: 'TC de Estadiamento', daysToComplete: 21 },
        { key: 'cea_baseline', name: 'CEA Basal', daysToComplete: 7 },
        {
          key: 'staging_complete',
          name: 'Estadiamento Completo',
          dependsOn: ['pathology_report', 'staging_ct', 'cea_baseline'],
        },
      ],
    },
    TREATMENT: {
      steps: [
        {
          key: 'mdt_discussion',
          name: 'Discussão Multidisciplinar',
          daysToComplete: 14,
        },
        {
          key: 'treatment_plan',
          name: 'Plano de Tratamento',
          daysToComplete: 7,
          dependsOn: 'mdt_discussion',
        },
        {
          key: 'surgery',
          name: 'Cirurgia',
          daysToComplete: 30,
          conditional: 'if surgical candidate',
        },
        {
          key: 'chemotherapy',
          name: 'Quimioterapia',
          conditional: 'if indicated',
        },
        {
          key: 'radiotherapy',
          name: 'Radioterapia',
          conditional: 'if indicated',
        },
      ],
    },
    FOLLOW_UP: {
      steps: [
        {
          key: 'post_surgery_review',
          name: 'Revisão Pós-Cirúrgica',
          daysAfterTreatmentStart: 30,
        },
        {
          key: 'follow_up_cea',
          name: 'CEA de Seguimento',
          recurring: 'every 3 months for 2 years',
        },
        {
          key: 'follow_up_ct',
          name: 'TC de Seguimento',
          recurring: 'every 6 months for 2 years',
        },
        {
          key: 'follow_up_colonoscopy',
          name: 'Colonoscopia de Seguimento',
          recurring: 'at 1 year',
        },
      ],
    },
  },

  checkInRules: {
    SCREENING: { frequency: 'weekly', questionnaire: null },
    DIAGNOSIS: { frequency: 'twice_weekly', questionnaire: null },
    TREATMENT: { frequency: 'daily', questionnaire: 'ESAS' },
    FOLLOW_UP: { frequency: 'weekly', questionnaire: 'PRO_CTCAE' },
  },

  criticalSymptoms: [
    {
      keyword: 'sangramento retal',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    {
      keyword: 'obstrução intestinal',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    {
      keyword: 'febre neutropênica',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    { keyword: 'diarreia severa', severity: 'HIGH', action: 'ALERT_NURSING' },
    { keyword: 'mucosite', severity: 'HIGH', action: 'ALERT_NURSING' },
    { keyword: 'neuropatia', severity: 'MEDIUM', action: 'RECORD_AND_MONITOR' },
  ],

  riskAdjustment: {
    // Aumentar frequência de check-in se:
    increaseFrequency: [
      { condition: 'priorityCategory === "CRITICAL"', multiplier: 2 },
      { condition: 'lastSymptomSeverity >= 7', multiplier: 1.5 },
      { condition: 'missedCheckIns >= 2', multiplier: 1.5 },
    ],
  },
};
```

---

## 4. AI Service (Python FastAPI)

### 4.1 Nova Estrutura de Arquivos

```
ai-service/
├── main.py
├── src/
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── orchestrator.py          # Orquestrador principal (NOVO)
│   │   ├── llm_provider.py          # Abstração multi-LLM (NOVO)
│   │   ├── context_builder.py       # RAG — monta contexto clínico (NOVO)
│   │   ├── symptom_analyzer.py      # Análise avançada de sintomas (NOVO)
│   │   ├── questionnaire_engine.py  # Motor de questionários conversacionais (NOVO)
│   │   ├── protocol_engine.py       # Aplica regras do protocolo clínico (NOVO)
│   │   ├── whatsapp_agent.py        # Existente (será refatorado)
│   │   └── prompts/
│   │       ├── system_prompt.py     # Templates de system prompt (NOVO)
│   │       ├── questionnaire_prompts.py # Prompts para questionários (NOVO)
│   │       └── symptom_prompts.py   # Prompts para análise de sintomas (NOVO)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── priority_model.py        # Existente
│   │   └── schemas.py               # Pydantic models para request/response (NOVO)
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py                # Existente (será expandido)
│   └── services/
│       └── backend_client.py        # Existente (será expandido)
```

### 4.2 orchestrator.py — Núcleo do Agente

```python
class AgentOrchestrator:
    """
    Orquestrador principal do agente de navegação oncológica.
    Recebe mensagem + contexto → retorna resposta + ações.
    """

    async def process(self, request: AgentRequest) -> AgentResponse:
        # 1. Analisar intenção da mensagem
        intent = await self.analyze_intent(request.message, request.conversation_history)

        # 2. Verificar se estamos no meio de um questionário
        if request.agent_state.get('active_questionnaire'):
            return await self.questionnaire_engine.process_answer(request)

        # 3. Analisar sintomas
        symptom_analysis = await self.symptom_analyzer.analyze(
            message=request.message,
            clinical_context=request.clinical_context,
            cancer_type=request.clinical_context.get('cancer_type'),
        )

        # 4. Construir contexto RAG
        rag_context = self.context_builder.build(
            clinical_context=request.clinical_context,
            protocol=request.protocol,
            symptom_analysis=symptom_analysis,
            conversation_history=request.conversation_history,
        )

        # 5. Verificar regras do protocolo
        protocol_actions = self.protocol_engine.evaluate(
            cancer_type=request.clinical_context.get('cancer_type'),
            journey_stage=request.clinical_context.get('current_stage'),
            symptom_analysis=symptom_analysis,
            agent_state=request.agent_state,
        )

        # 6. Gerar resposta via LLM
        response = await self.llm_provider.generate(
            system_prompt=self.build_system_prompt(request, rag_context, protocol_actions),
            messages=request.conversation_history + [{"role": "user", "content": request.message}],
            config=request.agent_config,
        )

        # 7. Montar ações a executar
        actions = self.compile_actions(symptom_analysis, protocol_actions, intent)

        # 8. Atualizar estado do agente
        new_state = self.update_state(request.agent_state, intent, symptom_analysis)

        return AgentResponse(
            response=response,
            actions=actions,
            symptom_analysis=symptom_analysis,
            new_state=new_state,
            decisions=[...],
        )
```

### 4.3 llm_provider.py — Abstração Multi-LLM

```python
class LLMProvider:
    """Abstração para múltiplos provedores LLM, configurável por tenant."""

    async def generate(self, system_prompt, messages, config):
        provider = config.get('llm_provider', 'anthropic')
        model = config.get('llm_model', 'claude-sonnet-4-6')

        if provider == 'anthropic':
            return await self._call_anthropic(system_prompt, messages, model, config)
        elif provider == 'openai':
            return await self._call_openai(system_prompt, messages, model, config)
        else:
            raise ValueError(f"Provider não suportado: {provider}")

    # Suporta tool use / function calling para extração estruturada
    async def generate_with_tools(self, system_prompt, messages, tools, config):
        ...
```

### 4.4 context_builder.py — RAG de Contexto Clínico

```python
class ClinicalContextBuilder:
    """
    Monta contexto clínico completo para o prompt do agente.
    Recebe dados do backend e formata para o LLM.
    """

    def build(self, clinical_context, protocol, symptom_analysis, conversation_history):
        """Retorna string formatada para incluir no system prompt."""
        sections = []

        # Dados do paciente
        sections.append(self._format_patient_data(clinical_context))

        # Diagnósticos e biomarcadores
        sections.append(self._format_diagnoses(clinical_context.get('diagnoses', [])))

        # Tratamentos ativos
        sections.append(self._format_treatments(clinical_context.get('treatments', [])))

        # Etapas de navegação pendentes
        sections.append(self._format_navigation_steps(clinical_context.get('navigation_steps', [])))

        # Alertas recentes
        sections.append(self._format_recent_alerts(clinical_context.get('recent_alerts', [])))

        # Últimos questionários respondidos
        sections.append(self._format_questionnaire_history(clinical_context.get('questionnaire_responses', [])))

        # Observações clínicas recentes
        sections.append(self._format_observations(clinical_context.get('observations', [])))

        # Protocolo ativo
        sections.append(self._format_protocol_context(protocol))

        return '\n\n'.join(sections)
```

### 4.5 questionnaire_engine.py — Questionários Conversacionais

```python
class QuestionnaireEngine:
    """
    Aplica questionários clínicos (PRO-CTCAE, ESAS) em formato de conversa natural.
    O agente pergunta uma questão por vez, interpreta a resposta livre do paciente
    e extrai a resposta estruturada via LLM.
    """

    # PRO-CTCAE: Common Terminology Criteria for Adverse Events (patient-reported)
    PRO_CTCAE_ITEMS = {
        'nausea': {
            'frequency': 'Com que frequência você sentiu náusea na última semana?',
            'severity': 'Qual a intensidade da náusea quando ela aconteceu?',
            'scale': ['Nenhuma', 'Raramente', 'Ocasionalmente', 'Frequentemente', 'Quase constantemente'],
        },
        'pain': {
            'severity': 'Na última semana, qual foi a pior dor que você sentiu?',
            'interference': 'Quanto essa dor atrapalhou suas atividades do dia a dia?',
            'scale': ['Nada', 'Um pouco', 'Moderadamente', 'Bastante', 'Muito'],
        },
        'fatigue': {
            'severity': 'Qual o nível de cansaço que você sentiu na última semana?',
            'interference': 'Quanto esse cansaço atrapalhou suas atividades?',
            'scale': ['Nada', 'Um pouco', 'Moderadamente', 'Bastante', 'Muito'],
        },
        'diarrhea': { ... },
        'constipation': { ... },
        'appetite_loss': { ... },
        'dyspnea': { ... },
        'insomnia': { ... },
        'neuropathy': { ... },
        'mucositis': { ... },
    }

    # ESAS: Edmonton Symptom Assessment System
    ESAS_ITEMS = {
        'pain': 'De 0 a 10, como está sua dor agora? (0 = sem dor, 10 = pior dor possível)',
        'fatigue': 'De 0 a 10, como está seu cansaço?',
        'nausea': 'De 0 a 10, como está sua náusea?',
        'depression': 'De 0 a 10, como está seu humor? (0 = ótimo, 10 = muito deprimido)',
        'anxiety': 'De 0 a 10, como está sua ansiedade?',
        'drowsiness': 'De 0 a 10, como está sua sonolência?',
        'appetite': 'De 0 a 10, como está seu apetite? (0 = normal, 10 = sem apetite)',
        'wellbeing': 'De 0 a 10, como você está se sentindo no geral?',
        'dyspnea': 'De 0 a 10, como está sua falta de ar?',
    }

    async def start_questionnaire(self, questionnaire_type, patient_context, agent_state):
        """Inicia um questionário e retorna a primeira pergunta."""
        ...

    async def process_answer(self, request):
        """
        Recebe resposta livre do paciente, extrai valor estruturado via LLM,
        avança para próxima pergunta ou finaliza.
        """
        ...

    def score_responses(self, questionnaire_type, responses):
        """Calcula scores (ESAS total, PRO-CTCAE severity grades)."""
        ...

    def interpret_scores(self, questionnaire_type, scores):
        """Interpreta scores e sugere ações (alerta se score alto)."""
        ...
```

### 4.6 Novos Endpoints da API

```python
# Expandir routes.py:

@router.post("/agent/process")
async def process_message(request: AgentProcessRequest) -> AgentProcessResponse:
    """Endpoint principal: processa mensagem e retorna resposta + ações."""

@router.post("/agent/build-context")
async def build_clinical_context(request: BuildContextRequest) -> ClinicalContextResponse:
    """Monta contexto clínico RAG para um paciente."""

@router.post("/agent/analyze-symptoms")
async def analyze_symptoms(request: SymptomAnalysisRequest) -> SymptomAnalysisResponse:
    """Analisa sintomas em uma mensagem."""

@router.post("/agent/score-questionnaire")
async def score_questionnaire(request: QuestionnaireScoreRequest) -> QuestionnaireScoreResponse:
    """Calcula e interpreta scores de questionário."""
```

---

## 5. Frontend — Melhorias no Chat

### 5.1 Novas features na interface de chat

```
frontend/src/
├── app/chat/
│   └── page.tsx                    # Melhorar com:
│                                   # - Indicador de "agente digitando..."
│                                   # - Badge de canal (WhatsApp/SMS/Voz/Chat)
│                                   # - Sintomas críticos destacados em vermelho
│                                   # - Questionário inline no chat
│                                   # - Painel de decisões do agente (explainability)
│
├── components/chat/                # NOVO diretório
│   ├── agent-status-badge.tsx      # Status do agente (ativo/escalado/enfermagem)
│   ├── symptom-highlight.tsx       # Destaca sintomas detectados nas mensagens
│   ├── questionnaire-inline.tsx    # Mostra questionário em andamento no chat
│   ├── decision-log-panel.tsx      # Painel com decisões do agente (transparência)
│   ├── navigation-steps-mini.tsx   # Mini painel com etapas de navegação do paciente
│   └── escalation-dialog.tsx       # Dialog para aprovar/rejeitar escalações
│
├── hooks/
│   ├── useConversations.ts         # NOVO — CRUD de conversas
│   ├── useAgentConfig.ts           # NOVO — Config do agente por tenant
│   └── useScheduledActions.ts      # NOVO — Ações agendadas
│
└── lib/api/
    ├── conversations.ts            # NOVO — API de conversas
    ├── agent-config.ts             # NOVO — API de config do agente
    └── scheduled-actions.ts        # NOVO — API de ações agendadas
```

---

## 6. Integração Vapi (Voz) — Fase 3

```
backend/src/channel-gateway/channels/voice.channel.ts

// Fluxo de ligação automatizada:
// 1. ScheduledAction com actionType=VOICE_CALL é executada
// 2. Backend chama Vapi API para iniciar ligação
// 3. Vapi conecta ao paciente e usa assistant configurado
// 4. Durante a chamada, Vapi envia transcrições via webhook
// 5. Backend processa transcrições como mensagens normais
// 6. Ao final, Vapi envia resumo da ligação
// 7. Backend salva resumo como Message + executa análise

// Configuração Vapi:
// - Assistant ID configurado no AgentConfig
// - System prompt do assistant = mesmo do agente WhatsApp
// - Voz via ElevenLabs (voice_id configurado no AgentConfig)
// - Idioma: pt-BR
```

---

## 7. Ordem de Implementação

### Sprint 1: Fundação (Schemas + Channel Gateway)

| #   | Tarefa                                           | Arquivos                                 |
| --- | ------------------------------------------------ | ---------------------------------------- |
| 1   | Adicionar novos models ao Prisma schema          | `backend/prisma/schema.prisma`           |
| 2   | Gerar e aplicar migration                        | `npx prisma migrate dev`                 |
| 3   | Criar módulo `channel-gateway`                   | `backend/src/channel-gateway/`           |
| 4   | Implementar webhook WhatsApp (receber + validar) | `whatsapp.channel.ts`                    |
| 5   | Implementar envio de mensagem WhatsApp           | `whatsapp.channel.ts`                    |
| 6   | Criar módulo `conversation`                      | `backend/src/agent/conversation.service` |

### Sprint 2: Agent Core (AI Service)

| #   | Tarefa                              | Arquivos                       |
| --- | ----------------------------------- | ------------------------------ |
| 7   | Criar `llm_provider.py` (multi-LLM) | `ai-service/src/agent/`        |
| 8   | Criar `context_builder.py` (RAG)    | `ai-service/src/agent/`        |
| 9   | Criar `orchestrator.py`             | `ai-service/src/agent/`        |
| 10  | Criar `symptom_analyzer.py`         | `ai-service/src/agent/`        |
| 11  | Expandir API routes                 | `ai-service/src/api/routes.py` |
| 12  | Criar módulo `agent` no backend     | `backend/src/agent/`           |

### Sprint 3: Protocolos + Questionários

| #   | Tarefa                                            | Arquivos                          |
| --- | ------------------------------------------------- | --------------------------------- |
| 13  | Criar templates de protocolos (4 tipos de câncer) | `backend/src/clinical-protocols/` |
| 14  | Implementar `protocol_engine.py`                  | `ai-service/src/agent/`           |
| 15  | Implementar `questionnaire_engine.py`             | `ai-service/src/agent/`           |
| 16  | Criar `decision-gate.service.ts`                  | `backend/src/agent/`              |
| 17  | Criar `agent-scheduler.service.ts`                | `backend/src/agent/`              |

### Sprint 4: Frontend + Polish

| #   | Tarefa                                            | Arquivos                                       |
| --- | ------------------------------------------------- | ---------------------------------------------- |
| 18  | Componentes de chat (agent badge, symptoms, etc.) | `frontend/src/components/chat/`                |
| 19  | Hooks e APIs novas                                | `frontend/src/hooks/`, `frontend/src/lib/api/` |
| 20  | Atualizar página de chat                          | `frontend/src/app/chat/page.tsx`               |
| 21  | Seed de protocolos e config de agente             | `backend/prisma/seed.ts`                       |

### Sprint 5: Canais Adicionais (SMS + Voz)

| #   | Tarefa                             | Arquivos                     |
| --- | ---------------------------------- | ---------------------------- |
| 22  | Implementar canal SMS (Twilio)     | `sms.channel.ts`             |
| 23  | Implementar canal Voz (Vapi)       | `voice.channel.ts`           |
| 24  | Fallback automático WhatsApp → SMS | `channel-gateway.service.ts` |

---

## 8. Diagrama de Fluxo Completo

```
PACIENTE envia "Estou com muita dor e febre"
  │
  ▼
[WhatsApp Webhook] → valida assinatura Meta
  │
  ▼
[Channel Gateway] → normaliza mensagem
  │
  ▼
[Busca Patient] → encontra paciente pelo phoneHash
  │
  ▼
[Busca/Cria Conversation] → conversa ativa?
  │
  ▼
[Agent Service] → monta contexto clínico:
  │  - Paciente: João, colorretal, estágio III, FOLFOX ciclo 4/12
  │  - Tratamento: QT ativa, última sessão há 5 dias
  │  - Último ESAS: dor 3/10, náusea 5/10
  │  - Etapa atual: TREATMENT → "chemotherapy" em andamento
  │  - Alertas recentes: nenhum
  │
  ▼
[AI Service - Orchestrator]
  │
  ├─ symptom_analyzer: DETECTA "dor intensa" + "febre"
  │  → febre em paciente em QT = FEBRE NEUTROPÊNICA POTENCIAL
  │  → severidade: CRITICAL
  │
  ├─ protocol_engine: colorretal + TREATMENT
  │  → regra: "febre neutropênica" → ESCALATE_IMMEDIATELY
  │
  ├─ context_builder: RAG com dados clínicos completos
  │
  ├─ LLM (Claude): gera resposta empática + coleta mais dados
  │  "João, entendo que você está sentindo muita dor e com febre.
  │   Isso é importante. Você consegue medir sua temperatura agora?
  │   Se estiver acima de 38°C, por favor vá imediatamente ao
  │   pronto-socorro mais próximo."
  │
  ▼
[Decision Gate]
  │
  ├─ AUTO: registrar sintomas (dor + febre)
  ├─ AUTO: criar alerta CRITICAL (febre neutropênica potencial)
  ├─ NEEDS_APPROVAL: escalar para oncologista
  │
  ▼
[Executa ações automáticas]
  │
  ├─ Salva Observation (dor, febre)
  ├─ Cria Alert (CRITICAL, CRITICAL_SYMPTOM)
  ├─ Emite WebSocket → Dashboard enfermagem recebe alerta em tempo real
  ├─ Cria AgentDecisionLog (audit trail)
  ├─ Cria aprovação pendente para escalação
  │
  ▼
[Envia resposta ao paciente via WhatsApp]
  │
  ▼
[Dashboard mostra:]
  - 🔴 Alerta crítico: João Silva - Febre neutropênica potencial
  - Enfermeira pode: Assumir conversa | Aprovar escalação | Ver log de decisões
```
