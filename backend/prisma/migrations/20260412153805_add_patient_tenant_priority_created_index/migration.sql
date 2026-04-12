-- CreateIndex
CREATE INDEX "patients_tenantId_priorityScore_createdAt_idx" ON "patients"("tenantId", "priorityScore", "createdAt");
