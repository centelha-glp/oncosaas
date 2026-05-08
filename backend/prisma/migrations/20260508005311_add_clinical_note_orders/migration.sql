-- CreateTable
CREATE TABLE "clinical_exam_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicalNoteId" TEXT NOT NULL,
    "clinicalNoteVersionNumber" INTEGER NOT NULL,
    "requestedById" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "code" TEXT,
    "loincCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_exam_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_prescription_lines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicalNoteId" TEXT NOT NULL,
    "clinicalNoteVersionNumber" INTEGER NOT NULL,
    "prescribedById" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "catalogKey" TEXT,
    "dosage" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "duration" TEXT,
    "indication" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_prescription_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinical_exam_requests_tenantId_idx" ON "clinical_exam_requests"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_exam_requests_patientId_idx" ON "clinical_exam_requests"("patientId");

-- CreateIndex
CREATE INDEX "clinical_exam_requests_clinicalNoteId_idx" ON "clinical_exam_requests"("clinicalNoteId");

-- CreateIndex
CREATE INDEX "clinical_exam_requests_tenantId_clinicalNoteId_idx" ON "clinical_exam_requests"("tenantId", "clinicalNoteId");

-- CreateIndex
CREATE INDEX "clinical_prescription_lines_tenantId_idx" ON "clinical_prescription_lines"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_prescription_lines_patientId_idx" ON "clinical_prescription_lines"("patientId");

-- CreateIndex
CREATE INDEX "clinical_prescription_lines_clinicalNoteId_idx" ON "clinical_prescription_lines"("clinicalNoteId");

-- CreateIndex
CREATE INDEX "clinical_prescription_lines_tenantId_clinicalNoteId_idx" ON "clinical_prescription_lines"("tenantId", "clinicalNoteId");

-- AddForeignKey
ALTER TABLE "clinical_exam_requests" ADD CONSTRAINT "clinical_exam_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_exam_requests" ADD CONSTRAINT "clinical_exam_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_exam_requests" ADD CONSTRAINT "clinical_exam_requests_clinicalNoteId_fkey" FOREIGN KEY ("clinicalNoteId") REFERENCES "clinical_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_exam_requests" ADD CONSTRAINT "clinical_exam_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_prescription_lines" ADD CONSTRAINT "clinical_prescription_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_prescription_lines" ADD CONSTRAINT "clinical_prescription_lines_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_prescription_lines" ADD CONSTRAINT "clinical_prescription_lines_clinicalNoteId_fkey" FOREIGN KEY ("clinicalNoteId") REFERENCES "clinical_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_prescription_lines" ADD CONSTRAINT "clinical_prescription_lines_prescribedById_fkey" FOREIGN KEY ("prescribedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
