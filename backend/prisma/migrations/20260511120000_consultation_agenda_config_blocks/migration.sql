-- CreateTable
CREATE TABLE "consultation_agenda_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultConsultationDurationMinutes" INTEGER NOT NULL,
    "maxConsultationsPerDay" INTEGER,
    "weeklyPattern" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_agenda_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_agenda_blocks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_agenda_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultation_agenda_configs_userId_key" ON "consultation_agenda_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_agenda_configs_tenantId_userId_key" ON "consultation_agenda_configs"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "consultation_agenda_configs_tenantId_idx" ON "consultation_agenda_configs"("tenantId");

-- CreateIndex
CREATE INDEX "consultation_agenda_blocks_tenantId_startsAt_endsAt_idx" ON "consultation_agenda_blocks"("tenantId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "consultation_agenda_blocks_tenantId_userId_startsAt_idx" ON "consultation_agenda_blocks"("tenantId", "userId", "startsAt");

-- AddForeignKey
ALTER TABLE "consultation_agenda_configs" ADD CONSTRAINT "consultation_agenda_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_agenda_configs" ADD CONSTRAINT "consultation_agenda_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_agenda_blocks" ADD CONSTRAINT "consultation_agenda_blocks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_agenda_blocks" ADD CONSTRAINT "consultation_agenda_blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
