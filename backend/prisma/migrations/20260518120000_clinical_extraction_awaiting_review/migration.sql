-- Fluxo de revisão humana antes de aplicar extração estruturada no prontuário.
ALTER TYPE "ClinicalNoteExtractionRunStatus" ADD VALUE 'AWAITING_REVIEW';
ALTER TYPE "ClinicalNoteExtractionRunStatus" ADD VALUE 'REJECTED';

ALTER TABLE "clinical_note_extraction_runs"
  ADD COLUMN "proposedPayload" JSONB,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByUserId" TEXT;

CREATE INDEX "clinical_note_extraction_runs_tenantId_patientId_status_idx"
  ON "clinical_note_extraction_runs"("tenantId", "patientId", "status");
