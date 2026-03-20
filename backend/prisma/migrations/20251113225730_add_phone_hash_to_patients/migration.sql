-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "phoneHash" TEXT;

-- CreateIndex
CREATE INDEX "patients_tenantId_phoneHash_idx" ON "patients"("tenantId", "phoneHash");
