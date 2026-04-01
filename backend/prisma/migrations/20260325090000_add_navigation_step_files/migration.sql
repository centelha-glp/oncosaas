-- CreateTable
CREATE TABLE "navigation_step_files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "navigationStepId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "etag" TEXT,
    "size" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "navigation_step_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "navigation_step_files_tenantId_idx" ON "navigation_step_files"("tenantId");

-- CreateIndex
CREATE INDEX "navigation_step_files_navigationStepId_idx" ON "navigation_step_files"("navigationStepId");

-- CreateIndex
CREATE INDEX "navigation_step_files_tenantId_objectKey_idx" ON "navigation_step_files"("tenantId", "objectKey");

-- AddForeignKey
ALTER TABLE "navigation_step_files" ADD CONSTRAINT "navigation_step_files_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_step_files" ADD CONSTRAINT "navigation_step_files_navigationStepId_fkey" FOREIGN KEY ("navigationStepId") REFERENCES "navigation_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
