-- CreateEnum
CREATE TYPE "TreatmentIntent" AS ENUM ('CURATIVE', 'PALLIATIVE', 'ADJUVANT', 'NEOADJUVANT');

-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'SUSPENDED', 'DISCONTINUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TreatmentResponse" AS ENUM ('COMPLETE_RESPONSE', 'PARTIAL_RESPONSE', 'STABLE_DISEASE', 'PROGRESSIVE_DISEASE', 'NOT_EVALUATED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'SMS', 'VOICE', 'WEB_CHAT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'WAITING', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HandledBy" AS ENUM ('AGENT', 'NURSING', 'HYBRID');

-- CreateEnum
CREATE TYPE "AgentDecisionType" AS ENUM ('SYMPTOM_DETECTED', 'CRITICAL_ESCALATION', 'QUESTIONNAIRE_STARTED', 'QUESTIONNAIRE_SCORED', 'CHECK_IN_SCHEDULED', 'PRIORITY_UPDATED', 'HANDOFF_TO_NURSING', 'ALERT_CREATED', 'RESPONSE_GENERATED');

-- CreateEnum
CREATE TYPE "ScheduledActionType" AS ENUM ('CHECK_IN', 'QUESTIONNAIRE', 'MEDICATION_REMINDER', 'APPOINTMENT_REMINDER', 'FOLLOW_UP', 'VOICE_CALL');

-- CreateEnum
CREATE TYPE "ScheduledActionStatus" AS ENUM ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "channel" "ChannelType" NOT NULL DEFAULT 'WHATSAPP';

-- AlterTable
ALTER TABLE "questionnaire_responses" ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "scores" JSONB;

-- CreateTable
CREATE TABLE "treatments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "treatmentType" "TreatmentType" NOT NULL,
    "treatmentName" TEXT,
    "protocol" TEXT,
    "line" INTEGER,
    "intent" "TreatmentIntent" NOT NULL DEFAULT 'CURATIVE',
    "startDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "lastCycleDate" TIMESTAMP(3),
    "currentCycle" INTEGER,
    "totalCycles" INTEGER,
    "cyclesCompleted" INTEGER DEFAULT 0,
    "status" "TreatmentStatus" NOT NULL DEFAULT 'PLANNED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "discontinuationReason" TEXT,
    "medications" JSONB,
    "frequency" TEXT,
    "administrationRoute" TEXT,
    "institutionName" TEXT,
    "physicianName" TEXT,
    "toxicities" JSONB,
    "doseReductions" JSONB,
    "delays" JSONB,
    "response" "TreatmentResponse",
    "responseDate" TIMESTAMP(3),
    "responseNotes" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL DEFAULT 'WHATSAPP',
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "handledBy" "HandledBy" NOT NULL DEFAULT 'AGENT',
    "assumedByUserId" TEXT,
    "assumedAt" TIMESTAMP(3),
    "agentState" JSONB,
    "activeQuestionnaireId" TEXT,
    "questionnaireProgress" JSONB,
    "lastMessageAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "llmProvider" TEXT NOT NULL DEFAULT 'anthropic',
    "llmModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "llmFallbackProvider" TEXT,
    "llmFallbackModel" TEXT,
    "anthropicApiKey" TEXT,
    "openaiApiKey" TEXT,
    "vapiApiKey" TEXT,
    "vapiAssistantId" TEXT,
    "elevenLabsApiKey" TEXT,
    "elevenLabsVoiceId" TEXT,
    "twilioAccountSid" TEXT,
    "twilioAuthToken" TEXT,
    "twilioPhoneNumber" TEXT,
    "agentLanguage" TEXT NOT NULL DEFAULT 'pt-BR',
    "maxAutoReplies" INTEGER NOT NULL DEFAULT 10,
    "escalationRules" JSONB,
    "greeting" TEXT,
    "defaultCheckInFrequency" JSONB,
    "riskBasedAdjustment" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_decision_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "decisionType" "AgentDecisionType" NOT NULL,
    "reasoning" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "inputData" JSONB NOT NULL,
    "outputAction" JSONB NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_decision_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_actions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "conversationId" TEXT,
    "actionType" "ScheduledActionType" NOT NULL,
    "channel" "ChannelType" NOT NULL DEFAULT 'WHATSAPP',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "status" "ScheduledActionStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "nextOccurrence" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_protocols" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cancerType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "definition" JSONB NOT NULL,
    "checkInRules" JSONB NOT NULL,
    "criticalSymptoms" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treatments_tenantId_idx" ON "treatments"("tenantId");

-- CreateIndex
CREATE INDEX "treatments_patientId_idx" ON "treatments"("patientId");

-- CreateIndex
CREATE INDEX "treatments_diagnosisId_idx" ON "treatments"("diagnosisId");

-- CreateIndex
CREATE INDEX "treatments_status_idx" ON "treatments"("status");

-- CreateIndex
CREATE INDEX "treatments_isActive_idx" ON "treatments"("isActive");

-- CreateIndex
CREATE INDEX "treatments_treatmentType_idx" ON "treatments"("treatmentType");

-- CreateIndex
CREATE INDEX "conversations_tenantId_idx" ON "conversations"("tenantId");

-- CreateIndex
CREATE INDEX "conversations_patientId_idx" ON "conversations"("patientId");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_tenantId_key" ON "agent_configs"("tenantId");

-- CreateIndex
CREATE INDEX "agent_decision_logs_tenantId_idx" ON "agent_decision_logs"("tenantId");

-- CreateIndex
CREATE INDEX "agent_decision_logs_conversationId_idx" ON "agent_decision_logs"("conversationId");

-- CreateIndex
CREATE INDEX "agent_decision_logs_decisionType_idx" ON "agent_decision_logs"("decisionType");

-- CreateIndex
CREATE INDEX "agent_decision_logs_requiresApproval_idx" ON "agent_decision_logs"("requiresApproval");

-- CreateIndex
CREATE INDEX "scheduled_actions_tenantId_idx" ON "scheduled_actions"("tenantId");

-- CreateIndex
CREATE INDEX "scheduled_actions_patientId_idx" ON "scheduled_actions"("patientId");

-- CreateIndex
CREATE INDEX "scheduled_actions_scheduledAt_idx" ON "scheduled_actions"("scheduledAt");

-- CreateIndex
CREATE INDEX "scheduled_actions_status_idx" ON "scheduled_actions"("status");

-- CreateIndex
CREATE INDEX "clinical_protocols_tenantId_idx" ON "clinical_protocols"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_protocols_cancerType_idx" ON "clinical_protocols"("cancerType");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_protocols_tenantId_cancerType_version_key" ON "clinical_protocols"("tenantId", "cancerType", "version");

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "cancer_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_decision_logs" ADD CONSTRAINT "agent_decision_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_decision_logs" ADD CONSTRAINT "agent_decision_logs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_actions" ADD CONSTRAINT "scheduled_actions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_actions" ADD CONSTRAINT "scheduled_actions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_protocols" ADD CONSTRAINT "clinical_protocols_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
