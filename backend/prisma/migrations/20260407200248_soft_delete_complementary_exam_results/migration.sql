-- AlterTable
ALTER TABLE "complementary_exam_results" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedByUserId" TEXT;

-- AlterTable
ALTER TABLE "complementary_exams" ADD COLUMN     "specimen" TEXT;

-- CreateIndex
CREATE INDEX "complementary_exam_results_tenantId_examId_deletedAt_idx" ON "complementary_exam_results"("tenantId", "examId", "deletedAt");

-- CreateIndex
CREATE INDEX "complementary_exam_results_tenantId_deletedAt_idx" ON "complementary_exam_results"("tenantId", "deletedAt");
