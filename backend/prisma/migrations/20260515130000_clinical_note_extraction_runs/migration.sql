-- CreateEnum
CREATE TYPE "ClinicalNoteExtractionRunStatus" AS ENUM ('PENDING', 'APPLIED', 'FAILED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "clinical_note_extraction_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicalNoteId" TEXT NOT NULL,
    "sectionsContentHash" TEXT NOT NULL,
    "latestVersionNumber" INTEGER NOT NULL,
    "signedByUserId" TEXT NOT NULL,
    "status" "ClinicalNoteExtractionRunStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReport" JSONB,
    "appliedPayloadHash" TEXT,
    "errorMessage" TEXT,
    "appliedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_note_extraction_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_note_extraction_ledger_lines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_note_extraction_ledger_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinical_note_extraction_runs_tenantId_idx" ON "clinical_note_extraction_runs"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_note_extraction_runs_clinicalNoteId_idx" ON "clinical_note_extraction_runs"("clinicalNoteId");

-- CreateIndex
CREATE INDEX "clinical_note_extraction_runs_tenantId_patientId_idx" ON "clinical_note_extraction_runs"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_note_extraction_runs_clinicalNoteId_sectionsContentHash_key" ON "clinical_note_extraction_runs"("clinicalNoteId", "sectionsContentHash");

-- CreateIndex
CREATE INDEX "clinical_note_extraction_ledger_lines_tenantId_idx" ON "clinical_note_extraction_ledger_lines"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_note_extraction_ledger_lines_runId_sequence_idx" ON "clinical_note_extraction_ledger_lines"("runId", "sequence");

-- AddForeignKey
ALTER TABLE "clinical_note_extraction_runs" ADD CONSTRAINT "clinical_note_extraction_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note_extraction_runs" ADD CONSTRAINT "clinical_note_extraction_runs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note_extraction_runs" ADD CONSTRAINT "clinical_note_extraction_runs_clinicalNoteId_fkey" FOREIGN KEY ("clinicalNoteId") REFERENCES "clinical_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note_extraction_runs" ADD CONSTRAINT "clinical_note_extraction_runs_signedByUserId_fkey" FOREIGN KEY ("signedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note_extraction_ledger_lines" ADD CONSTRAINT "clinical_note_extraction_ledger_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note_extraction_ledger_lines" ADD CONSTRAINT "clinical_note_extraction_ledger_lines_runId_fkey" FOREIGN KEY ("runId") REFERENCES "clinical_note_extraction_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
