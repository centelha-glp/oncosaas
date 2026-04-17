# ONCONAV — Especificação Técnica Completa

> **Status:** Em revisão  
> **Versão:** 1.0  
> **Última atualização:** 2026-04-16  
> **Autores:** Equipe ONCONAV (Produto/Engenharia)  
>
> **Escopo:** spec master (arquitetura, contratos e invariantes). Detalhes operacionais (setup, env, portas, comandos) vivem no `README.md` (raiz) e no índice `docs/README.md`.

---

> **Nota de canonicidade (importante):** este documento descreve **arquitetura, contratos e invariantes**. Para **stack/versões**, **portas**, **variáveis de ambiente** e **arranque rápido**, a fonte de verdade é o `README.md` na raiz do repositório (como indexado em `docs/README.md`).

> **Centelha ES (Fase 2):** materiais de submissão (Oportunidade/Solução/Diferenciais/Impacto/Equipe/Cronograma) ficam em `docs/centelha-espirito-santo/`.  
> **Índice:** `docs/centelha-espirito-santo/versao-formulario.md` • **Fase 2 (copiar/colar):** `docs/centelha-espirito-santo/preenchimento-fase2-centelha-es.md`.

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Modelo de Dados](#4-modelo-de-dados)
5. [Módulos do Backend](#5-módulos-do-backend)
6. [API REST — Endpoints](#6-api-rest--endpoints)
7. [Autenticação e Autorização](#7-autenticação-e-autorização)
8. [Multi-tenancy](#8-multi-tenancy)
9. [Frontend — Páginas e Componentes](#9-frontend--páginas-e-componentes)
10. [Serviço de IA (ai-service)](#10-serviço-de-ia-ai-service)
11. [Integração WhatsApp Business API](#11-integração-whatsapp-business-api)
12. [Integração HL7/FHIR](#12-integração-hl7fhir)
13. [Sistema de Alertas](#13-sistema-de-alertas)
14. [Dashboard de Enfermagem](#14-dashboard-de-enfermagem)
15. [Navegação Oncológica](#15-navegação-oncológica)
16. [Segurança e Compliance (LGPD)](#16-segurança-e-compliance-lgpd)
17. [WebSockets — Tempo Real](#17-websockets--tempo-real)
18. [Qualidade de Código e Testes](#18-qualidade-de-código-e-testes)
19. [Variáveis de Ambiente](#19-variáveis-de-ambiente)
20. [Roadmap de Produto](#20-roadmap-de-produto)

---

## 1. Visão Geral do Produto

### 1.1 Problema

Equipes de oncologia operam com dados fragmentados em múltiplos sistemas, comunicação manual (telefone/email) e sem visibilidade centralizada da jornada de cada paciente. Isso causa:

- Atrasos no diagnóstico e tratamento
- Dificuldade em identificar casos urgentes
- Sobrecarga administrativa da enfermagem
- Falta de dados contínuos entre consultas

### 1.2 Solução — ONCONAV

Plataforma SaaS multi-tenant que centraliza a navegação oncológica com:

> **Escopo do MVP (produto):** foco inicial em **câncer de bexiga**. Suporte a múltiplos tipos de câncer existe como **roadmap** e deve ser tratado como configuração/expansão posterior (não pressupor protocolos multi-câncer como “v1”).

| Pilar                       | Descrição                                                         |
| --------------------------- | ----------------------------------------------------------------- |
| **Agente IA no WhatsApp**   | Coleta contínua de sintomas e dados clínicos via conversa natural |
| **Priorização Inteligente** | Score 0-100 (XGBoost/LightGBM) para identificar casos críticos    |
| **Dashboard de Enfermagem** | Visão unificada de todos os pacientes com alertas em tempo real   |
| **Integração EHR/FHIR**     | Sincronização bidirecional com sistemas hospitalares              |

### 1.3 Personas

| Persona                      | Dores Principais                      | Como o ONCONAV ajuda             |
| ---------------------------- | ------------------------------------- | -------------------------------- |
| **Enfermeira Navegadora**    | Ligações excessivas, sem priorização  | Dashboard + alertas automáticos  |
| **Oncologista**              | Dados fragmentados, coordenação lenta | Timeline unificada + FHIR sync   |
| **Coordenador de Navegação** | Sem métricas de fluxo                 | Dashboard analítico + relatórios |
| **Gestor Hospitalar**        | Readmissões, capacidade ociosa        | Métricas de eficiência + ROI     |
| **Paciente**                 | Falta de suporte entre consultas      | Agente WhatsApp 24/7             |

### 1.4 Métricas de Sucesso (MVP)

- Taxa de resposta ao agente WhatsApp: ≥ 60 %
- Taxa de detecção de sintomas críticos: ≥ 90 %
- Tempo médio de resposta a alertas: < 2 horas
- Uptime: ≥ 99 %
- NPS da equipe de saúde: ≥ 50

---

## 2. Arquitetura do Sistema

### 2.1 Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                      │
│   [Navegador - Next.js]         [WhatsApp Business]                 │
└──────────────┬──────────────────────────┬───────────────────────────┘
               │ HTTPS                    │ Webhook HTTPS
               ▼                          ▼
┌─────────────────────────┐    ┌──────────────────────────────────────┐
│   Backend NestJS :3002  │◄───│  ai-service FastAPI :8001            │
│   API REST + WebSocket  │    │  - Agente conversacional (LLM)       │
│   JWT auth · Prisma     │    │  - Scoring (XGBoost/LightGBM)        │
│   Multi-tenant          │    │  - STT / RAG                         │
└────────────┬────────────┘    └──────────────────────────────────────┘
             │
     ┌───────┴──────────────────────────┐
     │                                  │
     ▼                                  ▼
┌─────────────┐  ┌────────┐  ┌──────────────────────────┐
│ PostgreSQL  │  │ Redis  │  │ RabbitMQ                 │
│ (dados)     │  │(cache  │  │ (fila de msgs WhatsApp,  │
│             │  │ sessão)│  │  eventos assíncronos)    │
└─────────────┘  └────────┘  └──────────────────────────┘
```

### 2.2 Portas de Serviço

| Serviço                  | Porta | Protocolo      |
| ------------------------ | ----- | -------------- |
| Frontend (Next.js)       | 3000  | HTTP/HTTPS     |
| Backend (NestJS)         | 3002  | HTTP/WebSocket |
| AI Service (FastAPI)     | 8001  | HTTP           |
| PostgreSQL               | 5432  | TCP            |
| Redis                    | 6379  | TCP            |
| RabbitMQ (AMQP)          | 5672  | TCP            |
| RabbitMQ (Management UI) | 15672 | HTTP           |

### 2.3 Padrões de Comunicação

| Padrão                | Uso                                        |
| --------------------- | ------------------------------------------ |
| REST HTTP             | Frontend ↔ Backend, Backend ↔ AI Service |
| WebSocket (Socket.io) | Alertas e atualizações em tempo real       |
| Webhook               | Recebimento de mensagens WhatsApp          |
| FHIR REST             | Integração com EHRs externos               |
| HL7 v2 MLLP           | Integração com sistemas legados            |

### 2.4 Contratos entre camadas (Frontend ↔ Backend ↔ AI Service)

> Esta seção fixa **invariantes** para eliminar ambiguidade entre camadas. Para detalhes operacionais de setup (stack/portas/env vars), ver `README.md`.

#### 2.4.1 Rotas, base URLs e versionamento

- **Backend (NestJS)**: rotas de produto expostas em **`/api/v1/*`**.
- **Frontend (Next.js)**: quando em modo relativo, chama **sempre** `'/api/v1/...'` (sem hardcode de host).
- **AI Service (FastAPI)**: rotas do agente e priorização expostas em **`/api/v1/*`** (exceção deliberada: health).

#### 2.4.2 Auth web (padrão) — cookies HttpOnly

- Backend emite `access_token` e `refresh_token` como **cookies HttpOnly**.
- Cliente web faz chamadas HTTP com **`withCredentials: true`**.
- **Padrão do dashboard**: não depender de `Authorization: Bearer`.

**Modo recomendado (API relativa / mesma origem via proxy)**:

- `NEXT_PUBLIC_USE_RELATIVE_API=true`
- `BACKEND_URL=<url do backend usada pelo proxy do Next>`
- Frontend chama `/api/v1/*` e o Next proxyia para `BACKEND_URL`, preservando cookies.

**Compatibilidade (não-browser)**:

- `Authorization: Bearer <jwt>` pode ser aceito para Postman/scripts/integrações (quando suportado).
- Mesmo assim, tenant/roles e checagens de pertencimento seguem idênticas.

#### 2.4.3 Tenant: header vs fonte de verdade

- `X-Tenant-Id` pode existir como header operacional.
- **Regra de ouro**: o `tenantId` efetivo para autorização/escopo vem da **sessão/token**; `X-Tenant-Id` nunca pode, sozinho, conceder acesso a outro tenant.
- Toda query/ação de domínio deve ser tenant-scoped e negar acesso em caso de mismatch.

#### 2.4.4 WebSocket (Socket.io) — ticket opaco (sem JWT exposto)

- Cliente chama `POST /api/v1/auth/socket-ticket` autenticado por cookie.
- Resposta: `{ "ticket": "<opaco, curto prazo/uso único>" }`.
- Cliente conecta no Socket.io enviando `auth: { ticket }`.
- Servidor resolve `ticket → userId/tenantId/role` (ex.: Redis) e conecta ao canal do tenant (ex.: room `tenant-${tenantId}`).
- **Proibição**: não enviar JWT em payload/handshake no cliente web.

#### 2.4.5 Contrato Backend → AI Service (agente)

- Endpoint canônico: `POST <AI_SERVICE_URL>/api/v1/agent/process`.
- Backend envia contexto já validado (tenant/paciente/estado/inputs).
- AI Service retorna **`actions[]`** (e conteúdo de resposta).
- **Execução é no Backend**: o backend valida permissões, executa actions, persiste e audita.
- AI Service não acessa o banco do backend nem executa mutações de domínio diretamente.

#### 2.4.6 Health / readiness (contrato infra — estável)

- **Backend:** `GET /api/v1/health` → HTTP 200 quando pronto.
- **AI Service:** `GET /health` → HTTP 200 quando pronto.

---

## 3. Stack Tecnológico

### 3.1 Frontend

| Item             | Escolha                             | Versão |
| ---------------- | ----------------------------------- | ------ |
| Framework        | Next.js (App Router)                | 15     |
| Linguagem        | TypeScript                          | 5.x    |
| Styling          | Tailwind CSS + shadcn/ui (Radix UI) | —      |
| State (servidor) | React Query (TanStack Query)        | v5     |
| State (cliente)  | Zustand                             | v4     |
| Formulários      | React Hook Form + Zod               | —      |
| Gráficos         | Recharts                            | —      |
| Auth client      | Sessão por cookies HttpOnly (backend) | —    |
| Linting          | ESLint (Next.js config)             | —      |
| Formatação       | Prettier                            | —      |

### 3.2 Backend

| Item          | Escolha                             | Versão |
| ------------- | ----------------------------------- | ------ |
| Framework     | NestJS                              | 11     |
| Linguagem     | TypeScript                          | 5.x    |
| ORM           | Prisma                              | 5.x    |
| Auth          | JWT (Passport.js) + bcrypt          | —      |
| Validação     | class-validator + class-transformer | —      |
| WebSocket     | Socket.io                           | —      |
| Agendamento   | @nestjs/schedule (cron)             | —      |
| Rate Limiting | @nestjs/throttler                   | —      |
| Linting       | ESLint + Prettier                   | —      |

### 3.3 AI Service

| Item       | Escolha                                      |
| ---------- | -------------------------------------------- |
| Framework  | FastAPI (Python 3.11+)                       |
| ML         | scikit-learn, XGBoost, LightGBM              |
| LLM        | OpenAI API (GPT-4) / Anthropic API (Claude)  |
| Embeddings | sentence-transformers                        |
| STT        | Google Cloud Speech-to-Text / AWS Transcribe |
| NLP        | spaCy, transformers (Hugging Face)           |

### 3.4 Infraestrutura

| Item            | Escolha                 |
| --------------- | ----------------------- |
| Banco de dados  | PostgreSQL 15+          |
| Cache           | Redis 7+                |
| Mensageria      | RabbitMQ 3.x            |
| Containerização | Docker + Docker Compose |
| CI/CD           | GitHub Actions          |

---

## 4. Modelo de Dados

### 4.1 Entidades Principais

#### Tenant

```prisma
model Tenant {
  id         String   @id @default(uuid())
  name       String
  schemaName String   @unique
  settings   Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

Representa um hospital/clínica cliente. Toda query de negócio filtra por `tenantId`.

#### User

```prisma
model User {
  id         String   @id @default(uuid())
  tenantId   String
  email      String
  name       String
  role       UserRole   // ADMIN | ONCOLOGIST | DOCTOR | NURSE_CHIEF | NURSE | COORDINATOR
  password   String     // bcrypt hash
  mfaEnabled Boolean  @default(false)
  mfaSecret  String?

  @@unique([tenantId, email])
}
```

#### Patient

Entidade central. Armazena dados clínicos, oncológicos, priorização e jornada.

Campos relevantes:

| Campo               | Tipo             | Descrição                                                  |
| ------------------- | ---------------- | ---------------------------------------------------------- |
| `cpf`               | String?          | CPF criptografado (AES-256, LGPD)                          |
| `phone`             | String           | WhatsApp, criptografado                                    |
| `phoneHash`         | String?          | SHA-256 do telefone normalizado para busca                 |
| `cancerType`        | String?          | Tipo de câncer                                             |
| `stage`             | String?          | TNM ou estágio clínico                                     |
| `performanceStatus` | Int?             | ECOG 0-4 ou Karnofsky 0-100                                |
| `currentStage`      | JourneyStage     | SCREENING / NAVIGATION / DIAGNOSIS / TREATMENT / FOLLOW_UP |
| `priorityScore`     | Int              | 0-100 (modelo de IA)                                       |
| `priorityCategory`  | PriorityCategory | CRITICAL / HIGH / MEDIUM / LOW                             |
| `priorityReason`    | String?          | Explicação legível do score                                |
| `comorbidities`     | Json?            | Array de `{ name, severity, controlled }`                  |
| `familyHistory`     | Json?            | Array de `{ relationship, cancerType, ageAtDiagnosis }`    |
| `ehrPatientId`      | String?          | ID no sistema EHR externo                                  |

#### CancerDiagnosis

Suporta múltiplos diagnósticos de câncer por paciente (ex.: segundo primário).

Campos: `cancerType`, `subtype`, `stage`, `tnmT/N/M`, `diagnosisDate`, `pathologyConfirmed`, `icdO3Code`.

#### Treatment

Registra ciclos de quimioterapia, radioterapia, imunoterapia, cirurgia, hormonioterapia.

Campos: `type` (TreatmentType enum), `protocol`, `startDate`, `endDate`, `currentCycle`, `totalCycles`, `status`, `sideEffects` (Json).

#### NavigationStep

Checklist de etapas por tipo de câncer e fase da jornada:

```prisma
model NavigationStep {
  stepKey      String        // ex: "colonoscopy", "biopsy", "surgery"
  cancerType   String        // ex: "colorectal", "breast"
  journeyStage JourneyStage  // SCREENING, DIAGNOSIS, TREATMENT, FOLLOW_UP
  status       StepStatus    // PENDING | IN_PROGRESS | COMPLETED | SKIPPED | BLOCKED | OVERDUE
  dueDate      DateTime?
  completedAt  DateTime?
  delayDays    Int?          // dias de atraso
}
```

#### Message

Mensagens trocadas com o paciente via WhatsApp (entrada e saída).

Campos: `direction` (INBOUND / OUTBOUND), `type` (TEXT / AUDIO / IMAGE / DOCUMENT / TEMPLATE), `content`, `audioUrl`, `transcription`, `isRead`, `whatsappMessageId`, `senderType` (PATIENT / AGENT / NURSE).

#### Alert

Alertas automáticos gerados pelo sistema:

| AlertType            | Trigger                                                   |
| -------------------- | --------------------------------------------------------- |
| `CRITICAL_SYMPTOM`   | Sintoma crítico detectado (dor ≥ 8, dispneia grave, etc.) |
| `NO_RESPONSE`        | Paciente sem resposta por > 48h                           |
| `PENDING_STEP`       | Etapa de navegação com atraso                             |
| `SCORE_CHANGE`       | Mudança significativa no score de prioridade              |
| `MISSED_APPOINTMENT` | Consulta perdida                                          |
| `SIDE_EFFECT`        | Efeito adverso reportado                                  |

#### Observation

Dados clínicos coletados pelo agente (estruturados):

Campos: `type` (PAIN / NAUSEA / FATIGUE / DYSPNEA / SYMPTOM / VITAL_SIGN / MEDICATION / LAB_RESULT / etc.), `value`, `unit`, `severity` (0-10), `fhirResourceId`.

#### Conversation

Sessão de conversa do agente IA com o paciente.

Campos: `sessionId`, `status` (ACTIVE / PAUSED / COMPLETED / HUMAN_TAKEOVER), `collectedData` (Json), `detectedSymptoms` (Json), `triggeredAlerts` (String[]).

#### AgentConfig

Configuração do agente IA por tenant:

```
{
  llmProvider: "openai" | "anthropic" | "mock",
  llmModel: "gpt-4" | "claude-opus-4-6" | ...,
  systemPrompt: string,
  maxTokens: number,
  temperature: number,
  enableAudio: boolean,
  enableRAG: boolean,
  questionnaireSchedule: { ... }
}
```

#### WhatsAppConnection

Conexão com WhatsApp Business API (por tenant):

Campos: `name`, `phoneNumber`, `phoneNumberId`, `authMethod` (OAUTH / MANUAL), `oauthAccessToken` (criptografado), `status` (PENDING / CONNECTED / DISCONNECTED / ERROR / EXPIRED), `isDefault`.

#### FHIRIntegrationConfig

Configuração da integração FHIR por tenant:

Campos: `baseUrl`, `authType` (oauth2 / basic / apikey), `authConfig` (Json), `syncDirection` (pull / push / bidirectional), `syncFrequency` (realtime / hourly / daily).

#### AuditLog

Registro imutável de todas as ações dos usuários (LGPD):

Campos: `userId`, `action`, `entityType`, `entityId`, `changes` (Json — diff), `ipAddress`, `userAgent`.

### 4.2 Enumerações

```
UserRole:         ADMIN | ONCOLOGIST | DOCTOR | NURSE_CHIEF | NURSE | COORDINATOR
JourneyStage:     SCREENING | NAVIGATION | DIAGNOSIS | TREATMENT | FOLLOW_UP
PriorityCategory: CRITICAL | HIGH | MEDIUM | LOW
PatientStatus:    ACTIVE | IN_TREATMENT | FOLLOW_UP | COMPLETED | DECEASED | INACTIVE | PALLIATIVE_CARE
StepStatus:       PENDING | IN_PROGRESS | COMPLETED | SKIPPED | BLOCKED | OVERDUE
TreatmentType:    CHEMOTHERAPY | RADIOTHERAPY | SURGERY | IMMUNOTHERAPY | HORMONE_THERAPY | TARGETED_THERAPY | PALLIATIVE | CLINICAL_TRIAL
AlertType:        CRITICAL_SYMPTOM | NO_RESPONSE | PENDING_STEP | SCORE_CHANGE | MISSED_APPOINTMENT | SIDE_EFFECT
MessageDirection: INBOUND | OUTBOUND
InterventionType: ASSUME | RESPONSE | ALERT_RESOLVED | NOTE_ADDED | PRIORITY_UPDATED
```

---

## 5. Módulos do Backend

### 5.1 Estrutura de Módulos (`backend/src/`)

```
auth/                  Autenticação JWT, multi-tenant login, MFA
patients/              CRUD de pacientes, diagnósticos, tratamentos
oncology-navigation/   Engine de etapas de navegação, scheduler de alertas de atraso
alerts/                Criação, listagem e resolução de alertas
dashboard/             Agregações para painel de enfermagem
gateways/              WebSocket (Socket.io) — tempo real
whatsapp-connections/  CRUD de conexões WhatsApp Business API
messages/              Recebimento e envio de mensagens WhatsApp
agent/                 Orquestração do agente conversacional IA
observations/          Registro de observações clínicas
questionnaire-responses/ Respostas a questionários (EORTC, PRO-CTCAE, ESAS)
integrations/fhir/     HL7/FHIR — cliente, sync, mapeamento
audit-log/             Registro de auditoria (LGPD)
treatments/            CRUD de tratamentos oncológicos
interventions/         Rastreio de intervenções da enfermagem
internal-notes/        Notas internas da equipe
scheduled-actions/     Ações agendadas (follow-ups automáticos)
clinical-protocols/    Protocolos clínicos por tipo de câncer
channel-gateway/       Gateway de envio de mensagens multi-canal
users/                 Gestão de usuários e perfis
prisma/                PrismaService singleton
common/                Guards, filtros, interceptors, decorators, utils
config/                Configuração de módulos (JWT, ThrottleGT, etc.)
```

### 5.2 Regras Gerais

- **Tenant Isolation**: Toda query deve incluir `{ where: { tenantId } }` — nunca omitir.
- **DTOs com class-validator**: Toda entrada de API validada via DTO + `ValidationPipe`.
- **`ParseUUIDPipe`**: Obrigatório em todos os parâmetros `:id`.
- **Logger NestJS**: Nunca usar `console.log` em serviços — sempre `this.logger.log/warn/error`.
- **Rate Limiting**: 100 req/min (geral), 10 req/min (rotas de auth).

---

## 6. API REST — Endpoints

Base URL: `http://localhost:3002/api/v1`

### Autenticação (contrato primário)

- **Web app (padrão)**: autenticação por **cookies HttpOnly** emitidos pelo backend; o cliente web deve usar `withCredentials: true` nas chamadas HTTP.
- **Header `Authorization: Bearer <token>`**: pode existir como alternativa **para ferramentas e integrações** (quando suportado pelo backend), mas **não** é o modo recomendado para o frontend.

### 6.1 Autenticação

| Método | Rota             | Descrição                    |
| ------ | ---------------- | ---------------------------- |
| POST   | `/auth/login`    | Login com email + senha      |
| POST   | `/auth/register` | Cadastro de novo usuário     |
| GET    | `/auth/me`       | Dados do usuário autenticado |
| POST   | `/auth/refresh`  | Renovar JWT                  |

**Login Request:**

```json
{
  "email": "enfermeira@hospitalteste.com",
  "password": "senha123",
  "tenantId": "uuid-do-tenant"
}
```

**Login Response (JSON):** somente `user`. O JWT de acesso é enviado em cookie HttpOnly (`Set-Cookie: access_token=...`), não no corpo — alinhado ao cliente web (Axios com `withCredentials`).

```json
{
  "user": {
    "id": "uuid",
    "email": "...",
    "name": "...",
    "role": "NURSE",
    "tenantId": "uuid"
  }
}
```

### 6.2 Pacientes

| Método | Rota                                  | Descrição                                           |
| ------ | ------------------------------------- | --------------------------------------------------- |
| GET    | `/patients`                           | Lista pacientes (paginada, ordenada por prioridade) |
| POST   | `/patients`                           | Criar paciente                                      |
| GET    | `/patients/:id`                       | Detalhes do paciente                                |
| PATCH  | `/patients/:id`                       | Atualizar dados básicos                             |
| DELETE | `/patients/:id`                       | Desativar paciente                                  |
| POST   | `/patients/import`                    | Importar via CSV                                    |
| PATCH  | `/patients/:id/priority`              | Atualizar prioridade manualmente                    |
| GET    | `/patients/:id/journey`               | Jornada do paciente                                 |
| GET    | `/patients/:id/messages`              | Histórico de mensagens WhatsApp                     |
| GET    | `/patients/:id/alerts`                | Alertas do paciente                                 |
| GET    | `/patients/:id/observations`          | Observações clínicas                                |
| GET    | `/patients/:id/navigation-steps`      | Etapas de navegação                                 |
| POST   | `/patients/:id/cancer-diagnoses`      | Adicionar diagnóstico de câncer                     |
| PATCH  | `/patients/:id/cancer-diagnoses/:did` | Atualizar diagnóstico                               |
| POST   | `/patients/:id/treatments`            | Registrar tratamento                                |
| PATCH  | `/patients/:id/treatments/:tid`       | Atualizar tratamento                                |

**Parâmetros de query (GET /patients):**

```
limit          int     default 200, max 500
offset         int     default 0
cancerType     string  filtrar por tipo de câncer
stage          string  filtrar por estágio
priority       string  CRITICAL | HIGH | MEDIUM | LOW
journeyStage   string  SCREENING | DIAGNOSIS | TREATMENT | FOLLOW_UP
status         string  ACTIVE | IN_TREATMENT | ...
search         string  busca por nome, CPF ou telefone
```

### 6.3 Alertas

| Método | Rota                      | Descrição                           |
| ------ | ------------------------- | ----------------------------------- |
| GET    | `/alerts`                 | Lista alertas do tenant (filtrável) |
| GET    | `/alerts/:id`             | Detalhes do alerta                  |
| POST   | `/alerts`                 | Criar alerta manualmente            |
| PATCH  | `/alerts/:id/resolve`     | Resolver alerta                     |
| PATCH  | `/alerts/:id/acknowledge` | Reconhecer alerta                   |

### 6.4 Dashboard

| Método | Rota                  | Descrição                                                      |
| ------ | --------------------- | -------------------------------------------------------------- |
| GET    | `/dashboard/summary`  | Resumo: totais por prioridade, estágio, alertas ativos         |
| GET    | `/dashboard/patients` | Pacientes priorizados (para painel enfermagem)                 |
| GET    | `/dashboard/alerts`   | Alertas ativos em tempo real                                   |
| GET    | `/dashboard/metrics`  | Métricas operacionais (tempo de resposta, taxa de engajamento) |

### 6.5 Mensagens

| Método | Rota                                 | Descrição                                   |
| ------ | ------------------------------------ | ------------------------------------------- |
| POST   | `/messages/webhook`                  | Receber mensagem do WhatsApp (webhook Meta) |
| POST   | `/messages/send`                     | Enviar mensagem ao paciente                 |
| GET    | `/messages/conversations/:patientId` | Histórico de conversa                       |

### 6.6 Navegação Oncológica

| Método | Rota                              | Descrição                          |
| ------ | --------------------------------- | ---------------------------------- |
| GET    | `/oncology-navigation/:patientId` | Etapas de navegação                |
| PATCH  | `/oncology-navigation/:stepId`    | Atualizar status de etapa          |
| POST   | `/oncology-navigation/initialize` | Inicializar protocolo de navegação |

### 6.7 Conexões WhatsApp

| Método | Rota                                   | Descrição                 |
| ------ | -------------------------------------- | ------------------------- |
| GET    | `/whatsapp-connections`                | Listar conexões do tenant |
| POST   | `/whatsapp-connections`                | Criar nova conexão        |
| GET    | `/whatsapp-connections/:id`            | Detalhes                  |
| PATCH  | `/whatsapp-connections/:id`            | Atualizar                 |
| DELETE | `/whatsapp-connections/:id`            | Remover                   |
| GET    | `/whatsapp-connections/oauth/start`    | Iniciar fluxo OAuth Meta  |
| GET    | `/whatsapp-connections/oauth/callback` | Callback OAuth            |

### 6.8 Integrações FHIR

| Método | Rota                                     | Descrição                     |
| ------ | ---------------------------------------- | ----------------------------- |
| GET    | `/integrations/fhir/config`              | Configuração FHIR do tenant   |
| POST   | `/integrations/fhir/config`              | Salvar configuração           |
| POST   | `/integrations/fhir/sync`                | Disparar sincronização manual |
| GET    | `/integrations/fhir/patients`            | Pacientes disponíveis no EHR  |
| POST   | `/integrations/fhir/patients/:id/import` | Importar paciente do EHR      |

### 6.9 Observações

| Método | Rota                       | Descrição               |
| ------ | -------------------------- | ----------------------- |
| GET    | `/observations/:patientId` | Observações do paciente |
| POST   | `/observations`            | Registrar observação    |
| GET    | `/observations/:id`        | Detalhes                |

### 6.10 Notas Internas

| Método | Rota                         | Descrição         |
| ------ | ---------------------------- | ----------------- |
| GET    | `/internal-notes/:patientId` | Notas do paciente |
| POST   | `/internal-notes`            | Criar nota        |
| DELETE | `/internal-notes/:id`        | Remover nota      |

### 6.11 Intervenções

| Método | Rota                        | Descrição                 |
| ------ | --------------------------- | ------------------------- |
| GET    | `/interventions/:patientId` | Histórico de intervenções |
| POST   | `/interventions`            | Registrar intervenção     |

---

## 7. Autenticação e Autorização

### 7.1 Fluxo JWT

1. `POST /auth/login` → JSON com `user`; JWT em cookie **`access_token`** (HttpOnly) + refresh em cookie separado
2. Cliente envia o JWT no **cookie** (navegador) e/ou `Authorization: Bearer <token>` (APIs/ferramentas); `JwtStrategy` aceita ambos
3. WebSocket: `POST /auth/socket-ticket` com sessão por cookie → resposta `{ ticket }` (uso único no Redis); o cliente envia `ticket` no `auth` do Socket.io
4. Payload do JWT: `{ sub: userId, email, tenantId, role }`

### 7.2 Guards

| Guard          | Aplicação                                           |
| -------------- | --------------------------------------------------- |
| `JwtAuthGuard` | Todas as rotas autenticadas                         |
| `RolesGuard`   | Restrição por role (junto com `@Roles()` decorator) |
| `TenantGuard`  | Validação de tenantId no token vs. recurso acessado |

### 7.3 Decorator `@CurrentUser()`

Extrai dados do usuário autenticado do JWT. Uso padrão em todos os controllers:

```typescript
@Get()
findAll(@CurrentUser() user: JwtPayload) {
  return this.service.findAll(user.tenantId);
}
```

### 7.4 Hierarquia de Roles

```
ADMIN          → acesso total
NURSE_CHIEF    → dashboard, alertas, intervenções, relatórios
ONCOLOGIST     → pacientes, diagnósticos, tratamentos, observações
NURSE          → dashboard, alertas, intervenções, mensagens
COORDINATOR    → relatórios, métricas, configurações
DOCTOR         → pacientes, observações (leitura)
```

### 7.5 MFA (Multi-Fator de Autenticação)

- Campos no modelo `User`: `mfaEnabled`, `mfaSecret`
- Previsto para profissionais de saúde (configurável por tenant via `settings`)
- Implementação: TOTP (Time-based OTP)

---

## 8. Multi-tenancy

### 8.1 Estratégia

Isolamento por `tenantId` em todas as tabelas (shared schema, row-level isolation).

Cada registro pertence a exatamente um `Tenant`. Não existe dado compartilhado entre tenants (exceto estrutura de `Tenant` e autenticação de `User`).

### 8.2 Regra de Ouro

> **Todo `findMany`, `findFirst`, `findUnique`, `update`, `delete` deve incluir `{ where: { tenantId } }`.**

Violação desta regra resulta em vazamento de dados entre tenants — falha crítica de segurança.

### 8.3 Fluxo de Onboarding

1. Admin cria tenant via seed ou painel administrativo
2. Usuários são criados com `tenantId` do hospital
3. Login envia `tenantId` junto com credenciais (ou o frontend detecta por subdomínio)
4. JWT carrega `tenantId` — todas as queries do backend usam este valor

### 8.4 Credenciais de Teste (após `npx prisma db seed`)

| Role        | Email                         | Senha    |
| ----------- | ----------------------------- | -------- |
| ADMIN       | admin@hospitalteste.com       | senha123 |
| ONCOLOGIST  | oncologista@hospitalteste.com | senha123 |
| NURSE       | enfermeira@hospitalteste.com  | senha123 |
| COORDINATOR | coordenador@hospitalteste.com | senha123 |

---

## 9. Frontend — Páginas e Componentes

### 9.1 Estrutura de Páginas (`frontend/src/app/`)

```
/                          Redirect para /dashboard (se autenticado) ou /auth
/auth/                     Login / cadastro
/dashboard/                Dashboard principal da enfermagem
/patients/                 Lista de pacientes
/patients/[id]/            Detalhes do paciente
/patients/[id]/chat/       Interface de chat WhatsApp
/oncology-navigation/      Visão geral de navegação oncológica
/integrations/             Configurações de integrações (FHIR, WhatsApp)
/calculadora-roi/          Calculadora de ROI para hospitais
```

### 9.2 Componentes Principais (`frontend/src/components/`)

#### `dashboard/`

- `PatientPriorityList` — lista de pacientes ordenada por score
- `AlertsPanel` — alertas em tempo real (WebSocket)
- `MetricsSummary` — cards de totais (críticos, alertas, etc.)
- `NavigationProgress` — barra de progresso da jornada

#### `patients/`

- `PatientCard` — card resumo do paciente
- `PatientJourneyTimeline` — timeline da jornada oncológica
- `PriorityBadge` — badge colorida (CRITICAL = vermelho, HIGH = laranja, etc.)
- `PatientFilters` — filtros de busca/tipo de câncer/estágio
- `CancerDiagnosisForm` — formulário de diagnóstico de câncer
- `TreatmentForm` — formulário de tratamento

#### `chat/`

- `ChatWindow` — interface de conversa (estilo WhatsApp)
- `MessageBubble` — bolha de mensagem (entrada/saída)
- `AudioPlayer` — player de áudio para mensagens de voz
- `NurseInterventionBar` — barra para enfermeira assumir conversa

#### `shared/`

- `DataTable` — tabela genérica paginada
- `AlertBadge` — indicador visual de alerta
- `TenantSelector` — seletor de tenant (para admin)
- `RoiCalculator` — componente de calculadora ROI

#### `ui/`

Componentes base reutilizáveis (Button, Input, Modal, Toast, Select, etc.) — todos baseados em Radix UI + Tailwind.

### 9.3 Gerenciamento de Estado

| Tipo            | Biblioteca            | Uso                                          |
| --------------- | --------------------- | -------------------------------------------- |
| Estado servidor | React Query           | Pacientes, alertas, mensagens, dashboard     |
| Estado cliente  | Zustand               | Usuário logado, filtros, seleção de paciente |
| Formulários     | React Hook Form + Zod | Criação e edição de dados                    |

### 9.4 Convenções Frontend

- Sem `console.log` em produção
- Validação de formulários com Zod schemas
- Erros de API exibidos via Toast (shadcn/ui)
- Skeleton loaders durante carregamento (React Query `isLoading`)
- Acessibilidade: componentes Radix UI garantem ARIA correto

---

## 10. Serviço de IA (ai-service)

### 10.1 Visão Geral

Serviço Python independente (`ai-service/`) exposto via FastAPI na porta 8001.

Responsabilidades:

1. **Scoring de prioridade** — modelo ML que calcula score 0-100 por paciente
2. **Agente conversacional** — LLM integrado para conversa com pacientes via WhatsApp
3. **STT** — transcrição de áudios recebidos
4. **RAG** — recuperação de contexto clínico para respostas mais precisas

### 10.2 Modelo de Priorização

**Features de entrada:**

| Categoria   | Features                                                                   |
| ----------- | -------------------------------------------------------------------------- |
| Clínico     | tipo de câncer, estadiamento, ECOG/Karnofsky, comorbidades, idade          |
| Sintomas    | dor (0-10), náusea, fadiga, dispneia, outros                               |
| Temporal    | dias desde última consulta, desde último exame, desde início do tratamento |
| Tratamento  | tipo de tratamento, ciclo atual/total, efeitos adversos                    |
| Engajamento | dias desde última interação WhatsApp, taxa de resposta, qtd. alertas       |

**Saída:**

```json
{
  "score": 85,
  "category": "CRITICAL",
  "reason": "Dor nível 9, 14 dias sem consulta, ciclo 3 de quimio atrasado",
  "features_importance": {
    "pain_score": 0.42,
    "days_since_consultation": 0.28,
    "treatment_delay": 0.18
  }
}
```

**Categorias por score:**

| Score  | Categoria |
| ------ | --------- |
| 0–39   | LOW       |
| 40–59  | MEDIUM    |
| 60–79  | HIGH      |
| 80–100 | CRITICAL  |

**Algoritmo:** LightGBM (principal). Dataset sintético gerado a partir de distribuições clínicas realistas para treinamento inicial.

### 10.3 Agente Conversacional

**Fluxo de uma mensagem de entrada:**

```
1. Webhook WhatsApp → Backend NestJS → fila RabbitMQ
2. AI Service consome mensagem da fila
3. Se áudio → STT → transcrição texto
4. Recupera contexto do paciente (histórico, diagnóstico, medicações)
5. RAG: busca guidelines relevantes (NCCN, ASCO) por embedding
6. LLM (GPT-4/Claude) gera resposta + extrai estruturado:
   - sintomas detectados
   - score de severidade
   - necessidade de alerta
7. Salva observações estruturadas no banco
8. Se sintoma crítico → dispara Alert → WebSocket → dashboard enfermagem
9. Resposta enviada ao paciente via WhatsApp API
```

**Questionários suportados:**

| Questionário  | Descrição                                        |
| ------------- | ------------------------------------------------ |
| EORTC QLQ-C30 | Qualidade de vida em oncologia (30 itens)        |
| PRO-CTCAE     | Toxicidade de tratamentos relatada pelo paciente |
| ESAS          | Escala de Sintomas de Edmonton (9 sintomas)      |

Aplicados de forma **conversacional** — não como lista de perguntas, mas de forma natural ao longo das trocas.

### 10.4 Fallback (sem chaves de API)

Se `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` não estiverem configuradas, o serviço retorna **respostas mockadas** para desenvolvimento local. Útil para testar fluxo completo sem custo.

### 10.5 Endpoints AI Service

| Método | Rota                       | Descrição                             |
| ------ | -------------------------- | ------------------------------------- |
| POST   | `/api/v1/prioritize`       | Calcular score de um paciente         |
| POST   | `/api/v1/batch-prioritize` | Score em lote para lista de pacientes |
| POST   | `/api/v1/agent/process`    | Processar mensagem do agente (canônico) |
| POST   | `/api/v1/agent/transcribe` | Transcrever áudio                     |
| GET    | `/health`                  | Health check                          |
| GET    | `/docs`                    | Swagger UI (FastAPI auto-gerado)      |

---

## 11. Integração WhatsApp Business API

### 11.1 Arquitetura

```
Meta WhatsApp Cloud API
    │ POST (webhook)
    ▼
/messages/webhook (NestJS)
    │ validação de assinatura HMAC-SHA256
    │
    ├─ Texto → fila → AI Service → resposta
    └─ Áudio → fila → AI Service → STT → processa → resposta
```

### 11.2 Autenticação com Meta

**Método preferencial: OAuth 2.0**

1. Tenant acessa `/whatsapp-connections/oauth/start`
2. Redirecionado para `https://www.facebook.com/dialog/oauth` com parâmetros de escopo
3. Após consentimento, callback em `/whatsapp-connections/oauth/callback`
4. Token de acesso armazenado **criptografado** no banco (AES-256)
5. `OAuthState` registrado temporariamente (expira em 10 min) para CSRF protection

**Método manual (fallback):** tenant fornece `apiToken`, `appId`, `appSecret` diretamente.

### 11.3 Segurança do Webhook

Todo webhook recebido da Meta é validado com HMAC-SHA256 usando `appSecret`:

```
X-Hub-Signature-256: sha256=<hash>
```

Requisições sem assinatura válida retornam `403 Forbidden`.

### 11.4 Rate Limiting WhatsApp

- Respeitar janelas de envio da Meta (template messages: apenas dentro de 24h de última mensagem do usuário)
- Fila RabbitMQ garante ordering e retry em caso de falha de entrega

### 11.5 Tipos de Mensagem

| Tipo               | Suporte | Observação                                 |
| ------------------ | ------- | ------------------------------------------ |
| Texto              | ✅      | Mensagem padrão do agente                  |
| Áudio              | ✅      | Transcrito via STT                         |
| Imagem             | ✅      | Armazenada, não processada por IA (v1)     |
| Documento          | ✅      | Armazenado (v1)                            |
| Template           | ✅      | Para mensagens proativas (fora janela 24h) |
| Botões interativos | Roadmap | v2                                         |

---

## 12. Integração HL7/FHIR

### 12.1 Suporte a Padrões

| Padrão         | Status               |
| -------------- | -------------------- |
| FHIR R4 (REST) | Implementado         |
| HL7 v2 (MLLP)  | Documentado, parcial |

### 12.2 Recursos FHIR Suportados

| Recurso FHIR        | Operação     | Descrição                     |
| ------------------- | ------------ | ----------------------------- |
| `Patient`           | Read, Search | Sincronizar dados do paciente |
| `Condition`         | Read, Search | Diagnósticos do paciente      |
| `Observation`       | Read, Create | Sintomas e sinais vitais      |
| `MedicationRequest` | Read         | Medicações prescritas         |
| `CarePlan`          | Read         | Planos de cuidado             |
| `Encounter`         | Read         | Consultas e internações       |
| `Procedure`         | Read         | Procedimentos realizados      |

### 12.3 Configuração por Tenant

Cada tenant configura sua integração FHIR independentemente via `FHIRIntegrationConfig`:

```json
{
  "baseUrl": "https://ehr.hospital.com/fhir/r4",
  "authType": "oauth2",
  "authConfig": {
    "clientId": "...",
    "clientSecret": "...",
    "tokenUrl": "...",
    "scope": "system/*.read"
  },
  "syncDirection": "bidirectional",
  "syncFrequency": "daily"
}
```

### 12.4 Fluxo de Sincronização

**Pull (EHR → ONCONAV):**

1. Scheduler dispara job diário (ou manual)
2. Busca pacientes no FHIR Server por identificador
3. Mapeia recursos FHIR → modelo interno
4. Atualiza dados do paciente (sem sobrescrever dados locais)

**Push (ONCONAV → EHR):**

1. Observação coletada pelo agente gera `Observation` FHIR
2. Enviada ao servidor FHIR do hospital
3. `fhirResourceId` salvo localmente para referência

### 12.5 Sistemas EHR Alvo

- **Tasy (Philips)** — maior market share hospitais brasileiros
- **MV Soul / PEP** — amplamente usado no Brasil
- **AGHU (Hospitais Universitários)** — software open-source do MEC
- **Epic / Cerner** — hospitais internacionais e grandes redes

---

## 13. Sistema de Alertas

### 13.1 Triggers de Alertas Automáticos

| Tipo                 | Condição                                                    | Prioridade |
| -------------------- | ----------------------------------------------------------- | ---------- |
| `CRITICAL_SYMPTOM`   | Dor ≥ 8/10, dispneia grave, febre ≥ 38.5°C, confusão mental | CRITICAL   |
| `NO_RESPONSE`        | Paciente sem resposta por > 48h após mensagem do agente     | HIGH       |
| `PENDING_STEP`       | Etapa de navegação com `dueDate` vencida                    | MEDIUM     |
| `SCORE_CHANGE`       | Score de prioridade aumentou ≥ 20 pontos em 24h             | HIGH       |
| `MISSED_APPOINTMENT` | Consulta agendada não confirmada 2h antes                   | HIGH       |
| `SIDE_EFFECT`        | Efeito adverso grau ≥ 3 reportado                           | HIGH       |

### 13.2 Ciclo de Vida do Alerta

```
PENDING → ACKNOWLEDGED → RESOLVED
              └──────────────▲
              (resolução direta sem ack)
```

- `PENDING`: Alerta criado, aguardando ação
- `ACKNOWLEDGED`: Enfermeira viu o alerta
- `RESOLVED`: Alerta resolvido com notas opcionais

### 13.3 Entrega em Tempo Real

Alertas são emitidos via WebSocket (Socket.io) para o dashboard de enfermagem imediatamente após criação. Ver seção 17.

### 13.4 Scheduler de Alertas

`oncology-navigation.scheduler.ts` executa jobs Cron:

- **A cada hora**: verifica etapas de navegação com datas vencidas → gera `PENDING_STEP`
- **A cada 6 horas**: verifica pacientes sem interação por > 48h → gera `NO_RESPONSE`

---

## 14. Dashboard de Enfermagem

### 14.1 Funcionalidades

| Funcionalidade                | Descrição                                                      |
| ----------------------------- | -------------------------------------------------------------- |
| Lista priorizada de pacientes | Ordenada por `priorityCategory` + `priorityScore`              |
| Cards de métricas             | Total CRITICAL, HIGH, alertas ativos, pacientes sem resposta   |
| Alertas em tempo real         | WebSocket — notificação imediata no painel                     |
| Chat integrado                | Ver e responder mensagens WhatsApp sem sair do dashboard       |
| Intervenção manual            | Enfermeira assume conversa do agente (registra `Intervention`) |
| Filtros                       | Por tipo de câncer, prioridade, estágio, status                |
| Notas internas                | Comunicação interna da equipe por paciente                     |

### 14.2 Endpoint Principal

`GET /dashboard/summary` retorna:

```json
{
  "totalPatients": 142,
  "criticalCount": 8,
  "highCount": 23,
  "activeAlerts": 12,
  "noResponseCount": 5,
  "averagePriorityScore": 47.3,
  "patientsByStage": {
    "SCREENING": 12,
    "DIAGNOSIS": 34,
    "TREATMENT": 78,
    "FOLLOW_UP": 18
  }
}
```

### 14.3 Fluxo de Intervenção

1. Enfermeira vê alerta de sintoma crítico no painel
2. Clica em "Assumir conversa" → `POST /interventions` com `type: ASSUME`
3. Abre chat com histórico completo
4. Responde ao paciente via `POST /messages/send`
5. Registra `Intervention` com `type: RESPONSE`
6. Resolve alerta via `PATCH /alerts/:id/resolve`

---

## 15. Navegação Oncológica

### 15.1 Conceito

Checklist estruturado de etapas que um paciente deve percorrer para cada tipo de câncer e fase da jornada. Exemplos por tipo de câncer:

**Colorretal:**

| Fase      | Etapas                                                                    |
| --------- | ------------------------------------------------------------------------- |
| SCREENING | Colonoscopia, resultado de biópsia                                        |
| DIAGNOSIS | Estadiamento (TC, RM), marcadores tumorais (CEA), laudo anatomopatológico |
| TREATMENT | Cirurgia/colostomia, quimioterapia adjuvante, radioterapia                |
| FOLLOW_UP | Colonoscopia anual, CEA semestral, TC anual                               |

**Mama:**

| Fase      | Etapas                                                                    |
| --------- | ------------------------------------------------------------------------- |
| SCREENING | Mamografia, ultrassonografia mamária                                      |
| DIAGNOSIS | Core biopsy, imunohistoquímica, estadiamento                              |
| TREATMENT | Cirurgia (quadrantectomia/mastectomia), quimio neoadjuvante, RT adjuvante |
| FOLLOW_UP | Mamografia anual, consulta semestral                                      |

### 15.2 Motor de Etapas

`OncologyNavigationService` é responsável por:

1. Inicializar etapas (`NavigationStep`) ao criar/atualizar diagnóstico de câncer
2. Calcular `delayDays` baseado em `dueDate` vs. data atual
3. Marcar etapas como `OVERDUE` via scheduler
4. Gerar alertas `PENDING_STEP` automaticamente

### 15.3 Protocolos Clínicos (`ClinicalProtocol`)

Configurações de protocolos por tenant, permitindo customização das etapas padrão de acordo com diretrizes do hospital.

---

## 16. Segurança e Compliance (LGPD)

### 16.1 Dados Sensíveis — Criptografia

| Campo                                 | Técnica                                            |
| ------------------------------------- | -------------------------------------------------- |
| `Patient.cpf`                         | AES-256 (criptografia em repouso)                  |
| `Patient.phone`                       | AES-256                                            |
| `WhatsAppConnection.oauthAccessToken` | AES-256                                            |
| `WhatsAppConnection.apiToken`         | AES-256                                            |
| `User.password`                       | bcrypt (salt rounds = 10)                          |
| `Patient.phoneHash`                   | SHA-256 (para busca eficiente sem descriptografar) |

Variável de ambiente `ENCRYPTION_KEY` é **obrigatória em produção** — o sistema lança erro de inicialização se ausente.

### 16.2 Auditoria

Toda ação de usuário (criar, editar, deletar paciente; resolver alerta; etc.) gera um registro em `AuditLog`:

```json
{
  "userId": "uuid",
  "action": "UPDATE_PATIENT",
  "entityType": "Patient",
  "entityId": "uuid",
  "changes": { "priorityScore": { "from": 45, "to": 78 } },
  "ipAddress": "10.0.0.1",
  "userAgent": "Mozilla/5.0..."
}
```

Retenção mínima: **5 anos** (conforme LGPD e CFM).

### 16.3 Transporte

- TLS 1.3 obrigatório em produção (HTTPS)
- Certificados configuráveis (`certs/` para desenvolvimento local via QUICK-START-HTTPS.md)

### 16.4 Rate Limiting

Configurado via `@nestjs/throttler`:

```
Global:    100 requests / 60 segundos / IP
Auth:       10 requests / 60 segundos / IP (rotas /auth/*)
```

### 16.5 Isolamento de Dados (LGPD Art. 46)

- Cada tenant é completamente isolado a nível de linha (row-level security via `tenantId`)
- Backup e restore podem ser feitos por tenant de forma independente
- Dados de pacientes nunca cruzam fronteiras de tenant

### 16.6 LGPD — Bases Legais

| Dado coletado               | Base legal                                |
| --------------------------- | ----------------------------------------- |
| Dados clínicos do paciente  | Tutela da saúde (Art. 11, II, f)          |
| Dados de contato (WhatsApp) | Consentimento explícito + tutela da saúde |
| Áudios transcritos          | Consentimento + tutela da saúde           |
| Logs de auditoria           | Legítimo interesse + obrigação legal      |

---

## 17. WebSockets — Tempo Real

### 17.1 Gateway Socket.io

Implementado em `backend/src/gateways/`. Permite:

- Receber alertas em tempo real no dashboard
- Ver novas mensagens WhatsApp sem polling
- Atualizações de score de prioridade

### 17.2 Eventos Emitidos pelo Backend

| Evento                     | Payload                                   | Trigger                |
| -------------------------- | ----------------------------------------- | ---------------------- |
| `alert.created`            | `{ alertId, patientId, type, severity }`  | Novo alerta            |
| `alert.resolved`           | `{ alertId, patientId }`                  | Alerta resolvido       |
| `message.received`         | `{ messageId, patientId, content, type }` | Nova mensagem WhatsApp |
| `patient.priority_updated` | `{ patientId, score, category }`          | Score atualizado       |
| `step.overdue`             | `{ stepId, patientId, stepKey }`          | Etapa vencida          |

### 17.3 Autenticação WebSocket

Conexão WebSocket autenticada via **ticket opaco** (sem expor JWT no handshake), conforme o contrato em **2.4.4**:

```javascript
// 1) obter ticket autenticado por cookie
const { ticket } = await fetch('/api/v1/auth/socket-ticket', {
  method: 'POST',
  credentials: 'include',
}).then((r) => r.json());

// 2) conectar no Socket.io com ticket opaco
const socket = io('http://localhost:3002', {
  auth: { ticket },
});
```

### 17.4 Rooms (Namespaces)

Cada tenant tem seu próprio room WebSocket, garantindo isolamento de eventos:

```
room: `tenant-${tenantId}`
```

---

## 18. Qualidade de Código e Testes

### 18.1 Linting e Formatação

```bash
# Lint frontend e backend
npm run lint

# Formatação com Prettier
npm run format

# Verificação de tipos
cd frontend && npm run type-check
cd backend && npm run type-check
```

### 18.2 Pre-commit Hooks (Husky + lint-staged)

Executados automaticamente no `git commit`:

1. **ESLint** nos arquivos `.ts` e `.tsx` alterados
2. **Prettier** nos arquivos `.ts`, `.tsx`, `.json`, `.md`

Commit bloqueado se lint ou formatação falharem.

### 18.3 Testes Backend (Jest)

```bash
cd backend && npm test             # Unit tests
cd backend && npm run test:cov     # Com cobertura
cd backend && npm run test:e2e     # Testes end-to-end
```

Padrão de testes:

- **Unit**: cada `Service` testado isoladamente (mock do Prisma)
- **Integration**: módulo completo com banco de dados de teste
- **E2E**: fluxos completos via HTTP (Supertest)

### 18.4 Testes Frontend

```bash
cd frontend && npm test
```

Padrão: React Testing Library para componentes, mock de React Query.

### 18.5 Git Hooks

```bash
npm run prepare   # Instala Husky (executar após git clone)
```

---

## 19. Variáveis de Ambiente

Copiar e configurar:

```bash
cp .env.example .env
cp .env.example backend/.env
cp .env.example frontend/.env
```

### 19.1 Variáveis Principais

| Variável                        | Obrigatório | Descrição                            |
| ------------------------------- | ----------- | ------------------------------------ |
| `DATABASE_URL`                  | ✅          | PostgreSQL connection string         |
| `JWT_SECRET`                    | ✅          | Secret para assinatura de tokens JWT |
| `ENCRYPTION_KEY`                | ✅ prod     | Chave AES-256 para dados sensíveis   |
| `REDIS_URL`                     | ✅          | Redis connection URL                 |
| `RABBITMQ_URL`                  | ✅          | RabbitMQ AMQP URL                    |
| `OPENAI_API_KEY`                | ❌          | GPT-4 (mock se ausente)              |
| `ANTHROPIC_API_KEY`             | ❌          | Claude (mock se ausente)             |
| `WHATSAPP_APP_ID`               | ❌          | Meta App ID                          |
| `WHATSAPP_APP_SECRET`           | ❌          | Meta App Secret                      |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ❌          | Token de verificação do webhook      |
| `GOOGLE_CLOUD_PROJECT_ID`       | ❌          | Para Google Speech-to-Text           |
| `NEXT_PUBLIC_API_URL`           | ✅          | URL do backend (frontend)            |
| `NEXTAUTH_SECRET`               | ✅          | Secret para NextAuth.js              |

### 19.2 Banco de Dados Local (Docker)

```bash
npm run docker:up    # Sobe PostgreSQL, Redis, RabbitMQ
npm run db:migrate   # Executa migrations Prisma
cd backend && npx prisma db seed && cd ..  # Seed de dados de teste
```

---

## 20. Roadmap de Produto

### 20.1 MVP — v1.0 (Status atual)

| Feature                               | Status                          | Prioridade |
| ------------------------------------- | ------------------------------- | ---------- |
| Autenticação multi-tenant JWT         | ✅ Implementado                 | P0         |
| CRUD de pacientes                     | ✅ Implementado                 | P0         |
| Jornada oncológica (colorretal, mama) | ✅ Implementado                 | P0         |
| Sistema de alertas automáticos        | ✅ Implementado                 | P0         |
| Dashboard de enfermagem               | ✅ Implementado                 | P0         |
| Integração WhatsApp (OAuth + webhook) | ✅ Implementado                 | P0         |
| Agente conversacional IA              | ✅ Implementado (mock fallback) | P0         |
| Score de prioridade (ML)              | ✅ Implementado                 | P0         |
| WebSockets (alertas tempo real)       | ✅ Implementado                 | P0         |
| Integração FHIR R4                    | ✅ Implementado                 | P1         |
| Questionários (EORTC, ESAS)           | ✅ Implementado                 | P1         |
| Auditoria (LGPD)                      | ✅ Implementado                 | P1         |
| Notas internas / intervenções         | ✅ Implementado                 | P1         |

### 20.2 Fase 2 — v1.5 (6–12 meses)

- RAG completo com guidelines NCCN/ASCO/SBCO
- Integração com mais EHRs (Epic, Cerner, Tasy)
- Analytics avançado (dashboards executivos, relatórios de qualidade)
- Suporte a mais tipos de câncer (pulmão, próstata, colo de útero)
- MFA obrigatório por configuração de tenant
- Mobile app (React Native) para enfermagem

### 20.3 Fase 3 — v2.0 (12–24 meses)

- Agente multi-canal (SMS, Telegram, e-mail)
- Certificação ANVISA (SaMD Classe II)
- Internacionalização (EN, ES)
- Parcerias com operadoras de saúde
- Marketplace de protocolos oncológicos

---

## Apêndice A — Como Rodar Localmente

```bash
# 1. Clonar e instalar dependências
git clone <repo>
cd OncoSaas
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd ai-service && pip install -r requirements.txt && cd ..

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# 3. Subir infraestrutura
npm run docker:up

# 4. Rodar migrations e seed
npm run db:migrate
cd backend && npx prisma db seed && cd ..

# 5. Instalar hooks git
npm run prepare

# 6. Iniciar todos os serviços
npm run dev

# 7. Acessar
# Frontend:  http://localhost:3000
# API:       http://localhost:3002/api/v1
# Swagger:   http://localhost:8001/docs
```

## Apêndice B — Glossário Oncológico

| Termo         | Definição                                                                 |
| ------------- | ------------------------------------------------------------------------- |
| TNM           | Sistema de estadiamento: Tumor, Nódulos (linfonodos), Metástase           |
| ECOG          | Eastern Cooperative Oncology Group — escala de performance 0-4            |
| Karnofsky     | Escala de performance funcional 0-100                                     |
| EORTC QLQ-C30 | Questionário europeu de qualidade de vida em câncer                       |
| PRO-CTCAE     | Patient-Reported Outcomes — toxicidade de tratamento                      |
| ESAS          | Edmonton Symptom Assessment System                                        |
| NCCN          | National Comprehensive Cancer Network — guidelines de tratamento          |
| FHIR          | Fast Healthcare Interoperability Resources — padrão de interoperabilidade |
| HL7           | Health Level Seven — família de padrões de dados de saúde                 |
| EHR           | Electronic Health Record — prontuário eletrônico                          |
| PEP           | Prontuário Eletrônico do Paciente                                         |
| LGPD          | Lei Geral de Proteção de Dados (Brasil)                                   |
| SaMD          | Software as a Medical Device                                              |
| RAG           | Retrieval-Augmented Generation — técnica de IA com base de conhecimento   |
| STT           | Speech-to-Text — transcrição de voz                                       |
