-- CreateEnum
CREATE TYPE "WhatsAppAuthMethod" AS ENUM ('OAUTH', 'MANUAL');

-- CreateEnum
CREATE TYPE "WhatsAppConnectionStatus" AS ENUM ('PENDING', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'ERROR', 'EXPIRED');

-- CreateTable
CREATE TABLE "whatsapp_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "whatsappBusinessAccountId" TEXT,
    "businessAccountId" TEXT,
    "authMethod" "WhatsAppAuthMethod" NOT NULL DEFAULT 'OAUTH',
    "oauthAccessToken" TEXT,
    "oauthRefreshToken" TEXT,
    "oauthExpiresAt" TIMESTAMP(3),
    "oauthScopes" TEXT[],
    "apiToken" TEXT,
    "appId" TEXT,
    "appSecret" TEXT,
    "webhookUrl" TEXT,
    "webhookVerifyToken" TEXT,
    "status" "WhatsAppConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_connections_tenantId_idx" ON "whatsapp_connections"("tenantId");

-- CreateIndex
CREATE INDEX "whatsapp_connections_status_idx" ON "whatsapp_connections"("status");

-- CreateIndex
CREATE INDEX "whatsapp_connections_isActive_idx" ON "whatsapp_connections"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_connections_tenantId_phoneNumber_key" ON "whatsapp_connections"("tenantId", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_state_key" ON "oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_state_idx" ON "oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_expiresAt_idx" ON "oauth_states"("expiresAt");

-- AddForeignKey
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
