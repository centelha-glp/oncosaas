-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ONCOLOGIST', 'NURSE', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "JourneyStage" AS ENUM ('SCREENING', 'NAVIGATION', 'DIAGNOSIS', 'TREATMENT', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "PriorityCategory" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'IN_TREATMENT', 'FOLLOW_UP', 'COMPLETED', 'DECEASED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TreatmentType" AS ENUM ('CHEMOTHERAPY', 'RADIOTHERAPY', 'SURGERY', 'COMBINED', 'IMMUNOTHERAPY', 'TARGETED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'AUDIO', 'IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ProcessedBy" AS ENUM ('AGENT', 'NURSING');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('CRITICAL_SYMPTOM', 'NO_RESPONSE', 'DELAYED_APPOINTMENT', 'SCORE_CHANGE', 'SYMPTOM_WORSENING');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "QuestionnaireType" AS ENUM ('EORTC_QLQ_C30', 'PRO_CTCAE', 'ESAS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "password" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpf" TEXT,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "cancerType" TEXT,
    "stage" TEXT,
    "diagnosisDate" TIMESTAMP(3),
    "performanceStatus" INTEGER,
    "currentStage" "JourneyStage" NOT NULL DEFAULT 'SCREENING',
    "currentSpecialty" TEXT,
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "priorityCategory" "PriorityCategory" NOT NULL DEFAULT 'LOW',
    "priorityReason" TEXT,
    "priorityUpdatedAt" TIMESTAMP(3),
    "ehrPatientId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastInteraction" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_journeys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "screeningDate" TIMESTAMP(3),
    "screeningResult" TEXT,
    "diagnosisDate" TIMESTAMP(3),
    "diagnosisConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "pathologyReport" TEXT,
    "stagingDate" TIMESTAMP(3),
    "treatmentStartDate" TIMESTAMP(3),
    "treatmentType" "TreatmentType",
    "treatmentProtocol" TEXT,
    "currentCycle" INTEGER,
    "totalCycles" INTEGER,
    "lastFollowUpDate" TIMESTAMP(3),
    "nextFollowUpDate" TIMESTAMP(3),
    "currentStep" TEXT,
    "nextStep" TEXT,
    "blockers" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "conversationId" TEXT,
    "whatsappMessageId" TEXT NOT NULL,
    "whatsappTimestamp" TIMESTAMP(3) NOT NULL,
    "type" "MessageType" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "audioUrl" TEXT,
    "audioDuration" INTEGER,
    "transcribedText" TEXT,
    "processedBy" "ProcessedBy" NOT NULL DEFAULT 'AGENT',
    "structuredData" JSONB,
    "criticalSymptomsDetected" TEXT[],
    "alertTriggered" BOOLEAN NOT NULL DEFAULT false,
    "assumedBy" TEXT,
    "assumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "messageId" TEXT,
    "code" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "valueQuantity" DECIMAL(65,30),
    "valueString" TEXT,
    "unit" TEXT,
    "effectiveDateTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'final',
    "fhirResourceId" TEXT,
    "syncedToEHR" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "priority_scores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "category" "PriorityCategory" NOT NULL,
    "reason" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelVersion" TEXT,

    CONSTRAINT "priority_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaires" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "QuestionnaireType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "structure" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_responses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" TEXT,
    "appliedBy" "ProcessedBy" NOT NULL DEFAULT 'AGENT',

    CONSTRAINT "questionnaire_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "patients_tenantId_idx" ON "patients"("tenantId");

-- CreateIndex
CREATE INDEX "patients_priorityScore_idx" ON "patients"("priorityScore");

-- CreateIndex
CREATE INDEX "patients_currentStage_idx" ON "patients"("currentStage");

-- CreateIndex
CREATE INDEX "patients_status_idx" ON "patients"("status");

-- CreateIndex
CREATE INDEX "patients_ehrPatientId_idx" ON "patients"("ehrPatientId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_journeys_patientId_key" ON "patient_journeys"("patientId");

-- CreateIndex
CREATE INDEX "patient_journeys_tenantId_idx" ON "patient_journeys"("tenantId");

-- CreateIndex
CREATE INDEX "patient_journeys_patientId_idx" ON "patient_journeys"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "messages_whatsappMessageId_key" ON "messages"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "messages_tenantId_idx" ON "messages"("tenantId");

-- CreateIndex
CREATE INDEX "messages_patientId_idx" ON "messages"("patientId");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "messages_whatsappTimestamp_idx" ON "messages"("whatsappTimestamp");

-- CreateIndex
CREATE INDEX "messages_alertTriggered_idx" ON "messages"("alertTriggered");

-- CreateIndex
CREATE INDEX "alerts_tenantId_idx" ON "alerts"("tenantId");

-- CreateIndex
CREATE INDEX "alerts_patientId_idx" ON "alerts"("patientId");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "alerts_severity_createdAt_idx" ON "alerts"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "observations_tenantId_idx" ON "observations"("tenantId");

-- CreateIndex
CREATE INDEX "observations_patientId_idx" ON "observations"("patientId");

-- CreateIndex
CREATE INDEX "observations_code_idx" ON "observations"("code");

-- CreateIndex
CREATE INDEX "observations_syncedToEHR_idx" ON "observations"("syncedToEHR");

-- CreateIndex
CREATE INDEX "priority_scores_tenantId_idx" ON "priority_scores"("tenantId");

-- CreateIndex
CREATE INDEX "priority_scores_patientId_idx" ON "priority_scores"("patientId");

-- CreateIndex
CREATE INDEX "priority_scores_calculatedAt_idx" ON "priority_scores"("calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaires_code_key" ON "questionnaires"("code");

-- CreateIndex
CREATE INDEX "questionnaires_tenantId_idx" ON "questionnaires"("tenantId");

-- CreateIndex
CREATE INDEX "questionnaires_code_idx" ON "questionnaires"("code");

-- CreateIndex
CREATE INDEX "questionnaire_responses_tenantId_idx" ON "questionnaire_responses"("tenantId");

-- CreateIndex
CREATE INDEX "questionnaire_responses_patientId_idx" ON "questionnaire_responses"("patientId");

-- CreateIndex
CREATE INDEX "questionnaire_responses_questionnaireId_idx" ON "questionnaire_responses"("questionnaireId");

-- CreateIndex
CREATE INDEX "questionnaire_responses_completedAt_idx" ON "questionnaire_responses"("completedAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_schemaName_key" ON "tenants"("schemaName");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_journeys" ADD CONSTRAINT "patient_journeys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_journeys" ADD CONSTRAINT "patient_journeys_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "priority_scores" ADD CONSTRAINT "priority_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "priority_scores" ADD CONSTRAINT "priority_scores_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_responses" ADD CONSTRAINT "questionnaire_responses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_responses" ADD CONSTRAINT "questionnaire_responses_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_responses" ADD CONSTRAINT "questionnaire_responses_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "questionnaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
