-- AlterTable
ALTER TABLE "clinical_prescription_lines" ADD COLUMN     "presentationCatalogCode" TEXT;

-- CreateTable
CREATE TABLE "medication_catalog_drugs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" "MedicationCategory",
    "allowedRoutes" TEXT[],
    "sourceVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_catalog_drugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_catalog_presentations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "drugCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "strength" TEXT,
    "form" TEXT,
    "sourceVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_catalog_presentations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medication_catalog_drugs_code_key" ON "medication_catalog_drugs"("code");

-- CreateIndex
CREATE INDEX "medication_catalog_drugs_displayName_idx" ON "medication_catalog_drugs"("displayName");

-- CreateIndex
CREATE INDEX "medication_catalog_drugs_genericName_idx" ON "medication_catalog_drugs"("genericName");

-- CreateIndex
CREATE UNIQUE INDEX "medication_catalog_presentations_code_key" ON "medication_catalog_presentations"("code");

-- CreateIndex
CREATE INDEX "medication_catalog_presentations_drugCode_idx" ON "medication_catalog_presentations"("drugCode");

-- AddForeignKey
ALTER TABLE "medication_catalog_presentations" ADD CONSTRAINT "medication_catalog_presentations_drugCode_fkey" FOREIGN KEY ("drugCode") REFERENCES "medication_catalog_drugs"("code") ON DELETE CASCADE ON UPDATE CASCADE;
