-- CreateEnum
CREATE TYPE "ConsultationAttendance" AS ENUM ('EXPECTED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ConsultationNoShowSource" AS ENUM ('MANUAL', 'AUTO_EOD');

-- AlterTable
ALTER TABLE "navigation_steps" ADD COLUMN     "consultationCheckedInAt" TIMESTAMP(3),
ADD COLUMN     "consultationCheckedInByUserId" TEXT,
ADD COLUMN     "consultationStartedAt" TIMESTAMP(3),
ADD COLUMN     "consultationStartedByUserId" TEXT,
ADD COLUMN     "consultationWaitingDurationMinutes" INTEGER,
ADD COLUMN     "consultationLateDurationMinutes" INTEGER,
ADD COLUMN     "consultationAttendance" "ConsultationAttendance" NOT NULL DEFAULT 'EXPECTED',
ADD COLUMN     "consultationNoShowSource" "ConsultationNoShowSource";

-- AddForeignKey
ALTER TABLE "navigation_steps" ADD CONSTRAINT "navigation_steps_consultationCheckedInByUserId_fkey" FOREIGN KEY ("consultationCheckedInByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_steps" ADD CONSTRAINT "navigation_steps_consultationStartedByUserId_fkey" FOREIGN KEY ("consultationStartedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "navigation_steps_tenantId_consultationAttendance_expectedDate_idx" ON "navigation_steps"("tenantId", "consultationAttendance", "expectedDate");
