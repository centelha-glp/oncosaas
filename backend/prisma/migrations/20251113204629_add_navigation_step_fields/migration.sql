-- AlterTable
ALTER TABLE "navigation_steps" ADD COLUMN     "findings" JSONB,
ADD COLUMN     "institutionName" TEXT,
ADD COLUMN     "professionalName" TEXT,
ADD COLUMN     "result" TEXT;
