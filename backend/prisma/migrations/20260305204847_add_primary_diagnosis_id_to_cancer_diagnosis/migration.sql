-- AlterTable
ALTER TABLE "cancer_diagnoses" ADD COLUMN     "primaryDiagnosisId" TEXT;

-- CreateIndex
CREATE INDEX "cancer_diagnoses_primaryDiagnosisId_idx" ON "cancer_diagnoses"("primaryDiagnosisId");

-- AddForeignKey
ALTER TABLE "cancer_diagnoses" ADD CONSTRAINT "cancer_diagnoses_primaryDiagnosisId_fkey" FOREIGN KEY ("primaryDiagnosisId") REFERENCES "cancer_diagnoses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
