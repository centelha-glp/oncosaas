-- Phase 4: Real Data Pipeline
-- Stores nurse-corrected clinical dispositions for ML model retraining.
-- This table captures human expert corrections that serve as ground truth labels.

CREATE TABLE IF NOT EXISTS "clinical_disposition_feedback" (
  "id"                      TEXT NOT NULL,
  "tenant_id"               TEXT NOT NULL,
  "patient_id"              TEXT NOT NULL,
  "conversation_id"         TEXT,

  -- What the algorithm predicted
  "predicted_disposition"   "ClinicalDisposition" NOT NULL,
  "prediction_source"       TEXT NOT NULL,     -- "clinical_rules" | "ml_model" | "manual"
  "prediction_confidence"   DOUBLE PRECISION,
  "rules_findings"          JSONB,             -- RuleFinding[] for audit trail

  -- What the nurse/oncologist corrected it to (ground truth)
  "corrected_disposition"   "ClinicalDisposition" NOT NULL,
  "corrected_by"            TEXT NOT NULL,     -- userId
  "correction_reason"       TEXT,

  -- De-identified feature snapshot (no PII) for ML training
  "feature_snapshot"        JSONB NOT NULL,    -- extract_features() output

  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "clinical_disposition_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "clinical_disposition_feedback_tenant_id_idx"
  ON "clinical_disposition_feedback"("tenant_id");
CREATE INDEX IF NOT EXISTS "clinical_disposition_feedback_patient_id_idx"
  ON "clinical_disposition_feedback"("patient_id");
CREATE INDEX IF NOT EXISTS "clinical_disposition_feedback_predicted_idx"
  ON "clinical_disposition_feedback"("predicted_disposition");
CREATE INDEX IF NOT EXISTS "clinical_disposition_feedback_corrected_idx"
  ON "clinical_disposition_feedback"("corrected_disposition");
CREATE INDEX IF NOT EXISTS "clinical_disposition_feedback_created_at_idx"
  ON "clinical_disposition_feedback"("created_at");

ALTER TABLE "clinical_disposition_feedback"
  ADD CONSTRAINT "clinical_disposition_feedback_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "clinical_disposition_feedback_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;
