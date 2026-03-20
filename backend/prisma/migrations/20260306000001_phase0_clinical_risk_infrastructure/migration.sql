-- Phase 0: Clinical Risk Infrastructure
-- Removes legacy JSON fields; adds structured medications, comorbidities,
-- ECOG history, emergency reference, clinical disposition, and lab enhancements.

-- ─── New Enums ────────────────────────────────────────────────────────────────

CREATE TYPE "ClinicalDisposition" AS ENUM (
  'REMOTE_NURSING',
  'SCHEDULED_CONSULT',
  'ADVANCE_CONSULT',
  'ER_DAYS',
  'ER_IMMEDIATE'
);

CREATE TYPE "MedicationCategory" AS ENUM (
  'ANTICOAGULANT',
  'ANTIPLATELET',
  'CORTICOSTEROID',
  'IMMUNOSUPPRESSANT',
  'NSAID',
  'OPIOID_ANALGESIC',
  'NON_OPIOID_ANALGESIC',
  'ANTIEMETIC',
  'ANTIBIOTIC',
  'ANTIFUNGAL',
  'ANTIVIRAL',
  'ANTIHYPERTENSIVE',
  'ANTIDIABETIC',
  'BISPHOSPHONATE',
  'GROWTH_FACTOR',
  'PROTON_PUMP_INHIBITOR',
  'LAXATIVE',
  'OTHER'
);

CREATE TYPE "ComorbidityType" AS ENUM (
  'DIABETES_TYPE_1',
  'DIABETES_TYPE_2',
  'HYPERTENSION',
  'HEART_FAILURE',
  'CORONARY_ARTERY_DISEASE',
  'ATRIAL_FIBRILLATION',
  'COPD',
  'ASTHMA',
  'CHRONIC_KIDNEY_DISEASE',
  'LIVER_CIRRHOSIS',
  'HIV_AIDS',
  'AUTOIMMUNE_DISEASE',
  'STROKE_HISTORY',
  'DEEP_VEIN_THROMBOSIS',
  'PULMONARY_EMBOLISM',
  'PERIPHERAL_NEUROPATHY',
  'OBESITY',
  'DEPRESSION',
  'ANXIETY_DISORDER',
  'OTHER'
);

CREATE TYPE "ComorbiditySeverity" AS ENUM (
  'MILD',
  'MODERATE',
  'SEVERE'
);

CREATE TYPE "LabCategory" AS ENUM (
  'CBC',
  'METABOLIC',
  'COAGULATION',
  'LIVER_FUNCTION',
  'RENAL_FUNCTION',
  'THYROID',
  'TUMOR_MARKERS',
  'INFLAMMATORY',
  'CULTURES',
  'IMAGING_REPORT',
  'PATHOLOGY_REPORT',
  'OTHER'
);

-- ─── Patient: remove legacy JSON fields; add new columns ─────────────────────

ALTER TABLE "patients"
  DROP COLUMN IF EXISTS "comorbidities",
  DROP COLUMN IF EXISTS "current_medications";

ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "clinical_disposition"        "ClinicalDisposition",
  ADD COLUMN IF NOT EXISTS "clinical_disposition_at"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "clinical_disposition_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "preferred_emergency_hospital" TEXT;

-- ─── Treatment: add last application date ────────────────────────────────────

ALTER TABLE "treatments"
  ADD COLUMN IF NOT EXISTS "last_application_date" TIMESTAMP(3);

-- ─── ComplementaryExam: add lab metadata columns ─────────────────────────────

ALTER TABLE "complementary_exams"
  ADD COLUMN IF NOT EXISTS "loinc_code"          TEXT,
  ADD COLUMN IF NOT EXISTS "lab_category"        "LabCategory",
  ADD COLUMN IF NOT EXISTS "is_critical_metric"  BOOLEAN NOT NULL DEFAULT false;

-- ─── ComplementaryExamResult: add critical flags and collection grouping ──────

ALTER TABLE "complementary_exam_results"
  ADD COLUMN IF NOT EXISTS "collection_id"  TEXT,
  ADD COLUMN IF NOT EXISTS "critical_high"  BOOLEAN,
  ADD COLUMN IF NOT EXISTS "critical_low"   BOOLEAN;

-- ─── New table: medications ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "medications" (
  "id"                  TEXT NOT NULL,
  "tenant_id"           TEXT NOT NULL,
  "patient_id"          TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "dosage"              TEXT,
  "frequency"           TEXT,
  "indication"          TEXT,
  "route"               TEXT,
  "category"            "MedicationCategory" NOT NULL DEFAULT 'OTHER',
  "is_anticoagulant"    BOOLEAN NOT NULL DEFAULT false,
  "is_antiplatelet"     BOOLEAN NOT NULL DEFAULT false,
  "is_corticosteroid"   BOOLEAN NOT NULL DEFAULT false,
  "is_immunosuppressant" BOOLEAN NOT NULL DEFAULT false,
  "is_opioid"           BOOLEAN NOT NULL DEFAULT false,
  "is_nsaid"            BOOLEAN NOT NULL DEFAULT false,
  "is_growth_factor"    BOOLEAN NOT NULL DEFAULT false,
  "is_active"           BOOLEAN NOT NULL DEFAULT true,
  "start_date"          TIMESTAMP(3),
  "end_date"            TIMESTAMP(3),
  "notes"               TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "medications_tenant_id_idx"         ON "medications"("tenant_id");
CREATE INDEX IF NOT EXISTS "medications_patient_id_idx"        ON "medications"("patient_id");
CREATE INDEX IF NOT EXISTS "medications_category_idx"          ON "medications"("category");
CREATE INDEX IF NOT EXISTS "medications_is_active_idx"         ON "medications"("is_active");
CREATE INDEX IF NOT EXISTS "medications_is_anticoagulant_idx"  ON "medications"("is_anticoagulant");
CREATE INDEX IF NOT EXISTS "medications_is_corticosteroid_idx" ON "medications"("is_corticosteroid");
CREATE INDEX IF NOT EXISTS "medications_is_immunosuppressant_idx" ON "medications"("is_immunosuppressant");

ALTER TABLE "medications"
  ADD CONSTRAINT "medications_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "medications_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;

-- ─── New table: comorbidities ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "comorbidities" (
  "id"                        TEXT NOT NULL,
  "tenant_id"                 TEXT NOT NULL,
  "patient_id"                TEXT NOT NULL,
  "name"                      TEXT NOT NULL,
  "type"                      "ComorbidityType" NOT NULL DEFAULT 'OTHER',
  "severity"                  "ComorbiditySeverity" NOT NULL DEFAULT 'MODERATE',
  "controlled"                BOOLEAN NOT NULL DEFAULT false,
  "increases_sepsis_risk"     BOOLEAN NOT NULL DEFAULT false,
  "increases_bleeding_risk"   BOOLEAN NOT NULL DEFAULT false,
  "increases_thrombosis_risk" BOOLEAN NOT NULL DEFAULT false,
  "affects_renal_clearance"   BOOLEAN NOT NULL DEFAULT false,
  "affects_pulmonary_reserve" BOOLEAN NOT NULL DEFAULT false,
  "diagnosed_at"              TIMESTAMP(3),
  "notes"                     TEXT,
  "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "comorbidities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "comorbidities_tenant_id_idx"           ON "comorbidities"("tenant_id");
CREATE INDEX IF NOT EXISTS "comorbidities_patient_id_idx"          ON "comorbidities"("patient_id");
CREATE INDEX IF NOT EXISTS "comorbidities_type_idx"                ON "comorbidities"("type");
CREATE INDEX IF NOT EXISTS "comorbidities_increases_sepsis_risk_idx" ON "comorbidities"("increases_sepsis_risk");

ALTER TABLE "comorbidities"
  ADD CONSTRAINT "comorbidities_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "comorbidities_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;

-- ─── New table: performance_status_history ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "performance_status_history" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "patient_id"  TEXT NOT NULL,
  "ecog_score"  INTEGER NOT NULL,
  "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assessed_by" TEXT,
  "source"      TEXT NOT NULL DEFAULT 'MANUAL',
  "notes"       TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "performance_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "performance_status_history_tenant_id_idx"   ON "performance_status_history"("tenant_id");
CREATE INDEX IF NOT EXISTS "performance_status_history_patient_id_idx"  ON "performance_status_history"("patient_id");
CREATE INDEX IF NOT EXISTS "performance_status_history_assessed_at_idx" ON "performance_status_history"("assessed_at");

ALTER TABLE "performance_status_history"
  ADD CONSTRAINT "performance_status_history_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "performance_status_history_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;

-- ─── New table: emergency_references ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "emergency_references" (
  "id"                TEXT NOT NULL,
  "tenant_id"         TEXT NOT NULL,
  "hospital_name"     TEXT NOT NULL,
  "address"           TEXT,
  "city"              TEXT,
  "phone"             TEXT,
  "distance_km"       DOUBLE PRECISION,
  "has_oncology_er"   BOOLEAN NOT NULL DEFAULT false,
  "has_hematology_er" BOOLEAN NOT NULL DEFAULT false,
  "notes"             TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "emergency_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "emergency_references_tenant_id_key" ON "emergency_references"("tenant_id");

ALTER TABLE "emergency_references"
  ADD CONSTRAINT "emergency_references_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
