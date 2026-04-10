-- Fatores de risco e alergias estruturados + chave de catálogo em medicamentos
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "smokingProfile" JSONB;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "alcoholProfile" JSONB;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "occupationalExposureEntries" JSONB;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "allergyEntries" JSONB;

ALTER TABLE "medications" ADD COLUMN IF NOT EXISTS "catalogKey" TEXT;

CREATE INDEX IF NOT EXISTS "medications_catalogKey_idx" ON "medications" ("catalogKey");
