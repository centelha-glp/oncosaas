-- Renomeia índice truncado pelo PostgreSQL (63 chars) apenas se existir.
-- Instalações novas criam o índice com o nome final em 20260514100000_navigation_step_consultation_queue_metrics;
-- esta migration corre antes dela, por isso o ALTER INDEX simples falhava no CI (P3018).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = 'navigation_steps_tenantId_consultationAttendance_expectedDate_i'
  ) THEN
    ALTER INDEX "navigation_steps_tenantId_consultationAttendance_expectedDate_i"
      RENAME TO "navigation_steps_tenantId_consultationAttendance_expectedDa_idx";
  END IF;
END $$;
