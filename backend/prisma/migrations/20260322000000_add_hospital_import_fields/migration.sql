-- AlterEnum
BEGIN;
CREATE TYPE "AlertType_new" AS ENUM ('CRITICAL_SYMPTOM', 'NO_RESPONSE', 'DELAYED_APPOINTMENT', 'SCORE_CHANGE', 'SYMPTOM_WORSENING', 'NAVIGATION_DELAY', 'MISSING_EXAM', 'STAGING_INCOMPLETE', 'TREATMENT_DELAY', 'FOLLOW_UP_OVERDUE', 'PALLIATIVE_SYMPTOM_WORSENING', 'PALLIATIVE_MEDICATION_ADJUSTMENT', 'PALLIATIVE_FAMILY_SUPPORT', 'PALLIATIVE_PSYCHOSOCIAL');
ALTER TABLE "alerts" ALTER COLUMN "type" TYPE "AlertType_new" USING ("type"::text::"AlertType_new");
ALTER TYPE "AlertType" RENAME TO "AlertType_old";
ALTER TYPE "AlertType_new" RENAME TO "AlertType";
DROP TYPE "public"."AlertType_old";
COMMIT;

-- DropIndex
DROP INDEX "questionnaires_tenantId_code_key";

-- AlterTable
ALTER TABLE "patients" DROP COLUMN "maxDaysWithoutInteractionAlert",
ADD COLUMN     "medicalRecordNumber" TEXT,
ADD COLUMN     "occupation" TEXT;

-- AlterTable
ALTER TABLE "treatments" ADD COLUMN     "admissionDate" TIMESTAMP(3),
ADD COLUMN     "aihEmissionDate" TIMESTAMP(3),
ADD COLUMN     "dischargeDate" TIMESTAMP(3),
ADD COLUMN     "hadNeoadjuvantChemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hadUrinaryDiversion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intraoperativeMortality" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isReadmission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isReoperation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mortality30Days" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mortality90Days" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mortality90DaysDetail" TEXT,
ADD COLUMN     "neoadjuvantChemoDetail" TEXT,
ADD COLUMN     "readmissionReason" TEXT;

-- CreateIndex
CREATE INDEX "patients_tenantId_medicalRecordNumber_idx" ON "patients"("tenantId", "medicalRecordNumber");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaires_code_key" ON "questionnaires"("code");
