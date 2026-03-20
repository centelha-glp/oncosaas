-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('ASSUME', 'RESPONSE', 'ALERT_RESOLVED', 'NOTE_ADDED', 'PRIORITY_UPDATED');

-- CreateTable
CREATE TABLE "internal_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT,
    "type" "InterventionType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_notes_tenantId_idx" ON "internal_notes"("tenantId");

-- CreateIndex
CREATE INDEX "internal_notes_patientId_idx" ON "internal_notes"("patientId");

-- CreateIndex
CREATE INDEX "internal_notes_authorId_idx" ON "internal_notes"("authorId");

-- CreateIndex
CREATE INDEX "internal_notes_createdAt_idx" ON "internal_notes"("createdAt");

-- CreateIndex
CREATE INDEX "interventions_tenantId_idx" ON "interventions"("tenantId");

-- CreateIndex
CREATE INDEX "interventions_patientId_idx" ON "interventions"("patientId");

-- CreateIndex
CREATE INDEX "interventions_userId_idx" ON "interventions"("userId");

-- CreateIndex
CREATE INDEX "interventions_createdAt_idx" ON "interventions"("createdAt");

-- CreateIndex
CREATE INDEX "interventions_type_idx" ON "interventions"("type");

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
