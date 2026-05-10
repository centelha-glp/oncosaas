-- AlterTable
ALTER TABLE "users" ADD COLUMN "crmUf" TEXT,
ADD COLUMN "crmNumber" TEXT,
ADD COLUMN "corenUf" TEXT,
ADD COLUMN "corenNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_crmUf_crmNumber_key" ON "users"("tenantId", "crmUf", "crmNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_corenUf_corenNumber_key" ON "users"("tenantId", "corenUf", "corenNumber");
