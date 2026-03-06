-- CreateEnum
CREATE TYPE "ComplementaryExamType" AS ENUM ('LABORATORY', 'ANATOMOPATHOLOGICAL', 'IMMUNOHISTOCHEMICAL', 'IMAGING');

-- CreateTable
CREATE TABLE "complementary_exams" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "ComplementaryExamType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "unit" TEXT,
    "referenceRange" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complementary_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complementary_exam_results" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "valueNumeric" DOUBLE PRECISION,
    "valueText" TEXT,
    "unit" TEXT,
    "referenceRange" TEXT,
    "isAbnormal" BOOLEAN,
    "report" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complementary_exam_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complementary_exams_tenantId_idx" ON "complementary_exams"("tenantId");

-- CreateIndex
CREATE INDEX "complementary_exams_patientId_idx" ON "complementary_exams"("patientId");

-- CreateIndex
CREATE INDEX "complementary_exams_type_idx" ON "complementary_exams"("type");

-- CreateIndex
CREATE INDEX "complementary_exam_results_tenantId_idx" ON "complementary_exam_results"("tenantId");

-- CreateIndex
CREATE INDEX "complementary_exam_results_examId_idx" ON "complementary_exam_results"("examId");

-- CreateIndex
CREATE INDEX "complementary_exam_results_performedAt_idx" ON "complementary_exam_results"("performedAt");

-- AddForeignKey
ALTER TABLE "complementary_exams" ADD CONSTRAINT "complementary_exams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complementary_exams" ADD CONSTRAINT "complementary_exams_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complementary_exam_results" ADD CONSTRAINT "complementary_exam_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complementary_exam_results" ADD CONSTRAINT "complementary_exam_results_examId_fkey" FOREIGN KEY ("examId") REFERENCES "complementary_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
