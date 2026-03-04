-- Align patients phone hash migration to be idempotent with previous migration
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "phoneHash" TEXT;

-- Ensure index used for phone hash lookups exists
CREATE INDEX IF NOT EXISTS "patients_phoneHash_idx" ON "patients"("phoneHash");

-- Align FHIR integration config defaults/types with current schema
ALTER TABLE "fhir_integration_configs"
  ALTER COLUMN "syncDirection" SET DEFAULT 'pull',
  ALTER COLUMN "syncFrequency" SET DEFAULT 'daily',
  ALTER COLUMN "maxDelay" TYPE INTEGER USING "maxDelay"::INTEGER;

-- Remove legacy columns no longer present in schema
ALTER TABLE "fhir_integration_configs"
  DROP COLUMN IF EXISTS "lastSyncAt",
  DROP COLUMN IF EXISTS "lastError",
  DROP COLUMN IF EXISTS "metadata";
