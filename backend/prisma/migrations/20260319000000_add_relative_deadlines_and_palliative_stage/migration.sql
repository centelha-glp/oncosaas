-- AlterEnum: Add PALLIATIVE to JourneyStage
ALTER TYPE "JourneyStage" ADD VALUE IF NOT EXISTS 'PALLIATIVE';

-- AlterTable: Add relative deadline fields to NavigationStep
ALTER TABLE "navigation_steps" ADD COLUMN "dependsOnStepKey" TEXT;
ALTER TABLE "navigation_steps" ADD COLUMN "relativeDaysMin" INTEGER;
ALTER TABLE "navigation_steps" ADD COLUMN "relativeDaysMax" INTEGER;
ALTER TABLE "navigation_steps" ADD COLUMN "stepOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "navigation_steps_patientId_stepKey_idx" ON "navigation_steps"("patientId", "stepKey");
CREATE INDEX "navigation_steps_patientId_dependsOnStepKey_idx" ON "navigation_steps"("patientId", "dependsOnStepKey");
