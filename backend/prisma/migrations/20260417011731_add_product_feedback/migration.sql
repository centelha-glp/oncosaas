-- CreateEnum
CREATE TYPE "ProductFeedbackType" AS ENUM ('BUG', 'FEATURE');

-- CreateTable
CREATE TABLE "product_feedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ProductFeedbackType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_feedback_tenantId_createdAt_idx" ON "product_feedback"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
