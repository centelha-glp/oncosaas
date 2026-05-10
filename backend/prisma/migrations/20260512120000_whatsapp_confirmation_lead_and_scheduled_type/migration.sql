-- Correção de ordem: deve correr depois de 20260511120000_consultation_agenda_config_blocks.
-- SQL idempotente para quem já aplicou a migração mal datada 20260510192410 localmente.

-- AlterEnum (só se ainda não existir o valor)
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    INNER JOIN pg_catalog.pg_type t ON e.enumtypid = t.oid
    INNER JOIN pg_catalog.pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = current_schema()
      AND t.typname = 'ScheduledActionType'
      AND e.enumlabel = 'CONSULTATION_CONFIRMATION'
  ) THEN
    ALTER TYPE "ScheduledActionType" ADD VALUE 'CONSULTATION_CONFIRMATION';
  END IF;
END
$mig$;

-- AlterTable
ALTER TABLE "consultation_agenda_configs"
  ADD COLUMN IF NOT EXISTS "whatsappConfirmationLeadHours" INTEGER NOT NULL DEFAULT 24;
