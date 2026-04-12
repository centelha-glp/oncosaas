-- AlterTable
ALTER TABLE "clinical_notes" ADD COLUMN "navigationStepId" TEXT;

-- CreateIndex
CREATE INDEX "clinical_notes_navigationStepId_idx" ON "clinical_notes"("navigationStepId");

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_navigationStepId_fkey" FOREIGN KEY ("navigationStepId") REFERENCES "navigation_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
