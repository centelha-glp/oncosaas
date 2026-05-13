-- Remove migration record for erroneous early-only-rename migration (shadow DB never had the index).
-- Align index name with 20260514100000_navigation_step_consultation_queue_metrics (expectedDate_idx).

DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260511024130_navigation_step_consultation_queue_metrics';

ALTER INDEX IF EXISTS "navigation_steps_tenantId_consultationAttendance_expectedDa_idx"
RENAME TO "navigation_steps_tenantId_consultationAttendance_expectedDate_idx";
