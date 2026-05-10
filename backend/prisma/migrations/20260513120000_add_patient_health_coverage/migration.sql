-- CreateEnum
CREATE TYPE "HealthCoverageType" AS ENUM ('PRIVATE', 'HEALTH_PLAN');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN "healthCoverageType" "HealthCoverageType",
ADD COLUMN "healthPlanName" TEXT,
ADD COLUMN "insuranceMemberId" TEXT;
