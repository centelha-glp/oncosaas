-- AlterTable
ALTER TABLE "clinical_exam_requests" ADD COLUMN     "examCatalogCode" TEXT;

-- CreateTable
CREATE TABLE "tiss_spsadt_guides" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicalNoteId" TEXT NOT NULL,
    "guideNumber" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "operatorANSCode" TEXT,
    "beneficiaryName" TEXT NOT NULL,
    "beneficiaryCardNumber" TEXT,
    "requestingProfessionalName" TEXT NOT NULL,
    "requestingProfessionalCouncil" TEXT,
    "requestingProfessionalCouncilUf" TEXT,
    "requestingProfessionalRegistration" TEXT,
    "requestingFacilityCnes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiss_spsadt_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiss_spsadt_guide_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "examRequestId" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "procedureCode" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiss_spsadt_guide_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tiss_spsadt_guides_tenantId_idx" ON "tiss_spsadt_guides"("tenantId");

-- CreateIndex
CREATE INDEX "tiss_spsadt_guides_tenantId_patientId_idx" ON "tiss_spsadt_guides"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "tiss_spsadt_guides_tenantId_guideNumber_key" ON "tiss_spsadt_guides"("tenantId", "guideNumber");

-- CreateIndex
CREATE INDEX "tiss_spsadt_guide_items_tenantId_idx" ON "tiss_spsadt_guide_items"("tenantId");

-- CreateIndex
CREATE INDEX "tiss_spsadt_guide_items_guideId_idx" ON "tiss_spsadt_guide_items"("guideId");

-- CreateIndex
CREATE INDEX "tiss_spsadt_guide_items_examRequestId_idx" ON "tiss_spsadt_guide_items"("examRequestId");

-- CreateIndex
CREATE INDEX "clinical_exam_requests_examCatalogCode_idx" ON "clinical_exam_requests"("examCatalogCode");

-- AddForeignKey
ALTER TABLE "tiss_spsadt_guides" ADD CONSTRAINT "tiss_spsadt_guides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiss_spsadt_guides" ADD CONSTRAINT "tiss_spsadt_guides_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiss_spsadt_guides" ADD CONSTRAINT "tiss_spsadt_guides_clinicalNoteId_fkey" FOREIGN KEY ("clinicalNoteId") REFERENCES "clinical_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiss_spsadt_guides" ADD CONSTRAINT "tiss_spsadt_guides_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiss_spsadt_guide_items" ADD CONSTRAINT "tiss_spsadt_guide_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiss_spsadt_guide_items" ADD CONSTRAINT "tiss_spsadt_guide_items_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "tiss_spsadt_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiss_spsadt_guide_items" ADD CONSTRAINT "tiss_spsadt_guide_items_examRequestId_fkey" FOREIGN KEY ("examRequestId") REFERENCES "clinical_exam_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
