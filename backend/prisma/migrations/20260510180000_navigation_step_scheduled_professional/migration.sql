-- AlterTable
ALTER TABLE "navigation_steps" ADD COLUMN "scheduledProfessionalId" TEXT;

-- AddForeignKey
ALTER TABLE "navigation_steps" ADD CONSTRAINT "navigation_steps_scheduledProfessionalId_fkey" FOREIGN KEY ("scheduledProfessionalId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "navigation_steps_tenantId_scheduledProfessionalId_expectedDate_idx" ON "navigation_steps"("tenantId", "scheduledProfessionalId", "expectedDate");
