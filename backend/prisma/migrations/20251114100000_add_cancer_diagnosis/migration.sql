-- CreateTable
CREATE TABLE "cancer_diagnoses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "cancerType" TEXT NOT NULL,
    "icd10Code" TEXT,
    "stage" TEXT,
    "stagingDate" TIMESTAMP(3),
    "diagnosisDate" TIMESTAMP(3) NOT NULL,
    "diagnosisConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "pathologyReport" TEXT,
    "confirmedBy" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "resolvedDate" TIMESTAMP(3),
    "resolutionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancer_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cancer_diagnoses_tenantId_idx" ON "cancer_diagnoses"("tenantId");

-- CreateIndex
CREATE INDEX "cancer_diagnoses_patientId_idx" ON "cancer_diagnoses"("patientId");

-- CreateIndex
CREATE INDEX "cancer_diagnoses_isActive_idx" ON "cancer_diagnoses"("isActive");

-- CreateIndex
CREATE INDEX "cancer_diagnoses_isPrimary_idx" ON "cancer_diagnoses"("isPrimary");

-- AddForeignKey
ALTER TABLE "cancer_diagnoses" ADD CONSTRAINT "cancer_diagnoses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancer_diagnoses" ADD CONSTRAINT "cancer_diagnoses_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

