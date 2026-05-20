-- AlterTable
ALTER TABLE "clinical_prescription_lines" ADD COLUMN "quantity" TEXT;

UPDATE "clinical_prescription_lines" SET "quantity" = '1' WHERE "quantity" IS NULL;
