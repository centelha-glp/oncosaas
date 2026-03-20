-- CreateEnum
CREATE TYPE "NavigationStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED', 'NOT_APPLICABLE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'NAVIGATION_DELAY';
ALTER TYPE "AlertType" ADD VALUE 'MISSING_EXAM';
ALTER TYPE "AlertType" ADD VALUE 'STAGING_INCOMPLETE';
ALTER TYPE "AlertType" ADD VALUE 'TREATMENT_DELAY';
ALTER TYPE "AlertType" ADD VALUE 'FOLLOW_UP_OVERDUE';

-- CreateTable
CREATE TABLE "navigation_steps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "journeyId" TEXT,
    "cancerType" TEXT NOT NULL,
    "journeyStage" "JourneyStage" NOT NULL,
    "stepKey" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "stepDescription" TEXT,
    "status" "NavigationStepStatus" NOT NULL DEFAULT 'PENDING',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "expectedDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "navigation_steps_tenantId_idx" ON "navigation_steps"("tenantId");

-- CreateIndex
CREATE INDEX "navigation_steps_patientId_idx" ON "navigation_steps"("patientId");

-- CreateIndex
CREATE INDEX "navigation_steps_journeyId_idx" ON "navigation_steps"("journeyId");

-- CreateIndex
CREATE INDEX "navigation_steps_cancerType_journeyStage_idx" ON "navigation_steps"("cancerType", "journeyStage");

-- CreateIndex
CREATE INDEX "navigation_steps_status_idx" ON "navigation_steps"("status");

-- CreateIndex
CREATE INDEX "navigation_steps_dueDate_idx" ON "navigation_steps"("dueDate");

-- AddForeignKey
ALTER TABLE "navigation_steps" ADD CONSTRAINT "navigation_steps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_steps" ADD CONSTRAINT "navigation_steps_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_steps" ADD CONSTRAINT "navigation_steps_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "patient_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
