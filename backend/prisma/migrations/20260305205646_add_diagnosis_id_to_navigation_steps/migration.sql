-- AlterTable
ALTER TABLE "navigation_steps" ADD COLUMN     "diagnosisId" TEXT;

-- CreateIndex
CREATE INDEX "navigation_steps_diagnosisId_idx" ON "navigation_steps"("diagnosisId");

-- AddForeignKey
ALTER TABLE "navigation_steps" ADD CONSTRAINT "navigation_steps_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "cancer_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
