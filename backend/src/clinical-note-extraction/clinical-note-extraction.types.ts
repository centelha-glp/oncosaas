export type ClinicalNoteExtractionJobPayload = {
  tenantId: string;
  patientId: string;
  clinicalNoteId: string;
  signedByUserId: string;
  latestVersionNumber: number;
  sectionsContentHash: string;
};

/** Resposta mínima do ai-service (domínios aplicados no Nest). */
export type AiClinicalExamRequestItem = {
  display_name: string;
  code?: string | null;
  loinc_code?: string | null;
};

export type AiMedicationItem = {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  indication?: string | null;
  route?: string | null;
  category?: string | null;
  notes?: string | null;
};

export type AiComorbidityItem = {
  name: string;
  type?: string | null;
  severity?: string | null;
  controlled?: boolean | null;
  notes?: string | null;
};

/** Campos cadastrais/clínicos permitidos no aplicador (whitelist). */
export type AiPatientPatch = Partial<{
  cancerType: string | null;
  stage: string | null;
  performanceStatus: number | null;
  occupation: string | null;
  preferredEmergencyHospital: string | null;
  healthCoverageType: 'PRIVATE' | 'HEALTH_PLAN' | null;
  healthPlanName: string | null;
  insuranceMemberId: string | null;
  currentSpecialty: string | null;
}>;

export type AiJourneyPatch = Partial<{
  screeningDate: string | null;
  screeningResult: string | null;
  diagnosisDate: string | null;
  diagnosisConfirmed: boolean | null;
  pathologyReport: string | null;
  stagingDate: string | null;
  treatmentStartDate: string | null;
  treatmentType: string | null;
  treatmentProtocol: string | null;
  currentCycle: number | null;
  totalCycles: number | null;
  lastFollowUpDate: string | null;
  nextFollowUpDate: string | null;
  currentStep: string | null;
  nextStep: string | null;
  blockers: string[] | null;
}>;

export type AiDiagnosisItem = {
  cancer_type: string;
  icd10_code?: string | null;
  stage?: string | null;
  t_stage?: string | null;
  n_stage?: string | null;
  m_stage?: string | null;
  grade?: string | null;
  histological_type?: string | null;
  staging_date?: string | null;
  pathology_report?: string | null;
  diagnosis_date?: string | null;
};

export type AiTreatmentItem = {
  treatment_type: string;
  treatment_name?: string | null;
  protocol?: string | null;
  line?: number | null;
  intent?: string | null;
  status?: string | null;
  start_date?: string | null;
  planned_end_date?: string | null;
  is_active?: boolean | null;
  notes?: string | null;
  medications_json?: unknown | null;
  toxicities_json?: unknown | null;
  response?: string | null;
  response_date?: string | null;
  response_notes?: string | null;
};

export type AiNavigationStepUpdateItem = {
  navigation_step_id?: string | null;
  step_key?: string | null;
  cancer_type?: string | null;
  journey_stage?: string | null;
  result?: string | null;
  findings?: unknown | null;
  notes?: string | null;
  metadata?: unknown | null;
  actual_date?: string | null;
  institution_name?: string | null;
  professional_name?: string | null;
  mark_completed?: boolean | null;
};

export type AiComplementaryExamResult = {
  performed_at?: string | null;
  value_numeric?: number | null;
  value_text?: string | null;
  unit?: string | null;
  reference_range?: string | null;
  is_abnormal?: boolean | null;
  report?: string | null;
  components?: unknown | null;
};

export type AiComplementaryExamItem = {
  type: string;
  name: string;
  code?: string | null;
  loinc_code?: string | null;
  result?: AiComplementaryExamResult | null;
};

export type AiObservationItem = {
  code: string;
  display: string;
  effective_date_time: string;
  value_quantity?: string | number | null;
  value_string?: string | null;
  unit?: string | null;
};

export type AiPerformanceStatusItem = {
  ecog_score: number;
  assessed_at?: string | null;
  notes?: string | null;
};

export type AiPrescriptionLineItem = {
  medication_name: string;
  catalog_key?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  duration?: string | null;
  indication?: string | null;
};

export type AiQuestionnaireResponseItem = {
  questionnaire_code: string;
  responses: Record<string, unknown>;
  scores?: Record<string, unknown> | null;
  completed_at?: string | null;
};

/** Resposta do ai-service POST /clinical-evolution/suggest-orders (preview em rascunho). */
export type AiSuggestClinicalOrdersResponse = {
  suggestion_schema_version?: string;
  clinical_exam_requests: AiClinicalExamRequestItem[];
  clinical_prescription_lines: AiPrescriptionLineItem[];
  rejection_report?: Array<{
    domain: string;
    reason: string;
    field?: string | null;
  }> | null;
};

export type AiClinicalEvolutionStructureResponse = {
  extraction_schema_version: string;
  /** Contrato degradado (ai-service): quando true, não aplicar APPLIED. */
  llm_available?: boolean;
  parse_ok?: boolean;
  degraded?: boolean;
  clinical_exam_requests: AiClinicalExamRequestItem[];
  medications?: AiMedicationItem[];
  comorbidities?: AiComorbidityItem[];
  patient_patch?: AiPatientPatch | null;
  journey_patch?: AiJourneyPatch | null;
  diagnoses?: AiDiagnosisItem[];
  treatments?: AiTreatmentItem[];
  navigation_step_updates?: AiNavigationStepUpdateItem[];
  complementary_exams?: AiComplementaryExamItem[];
  observations?: AiObservationItem[];
  performance_status_history?: AiPerformanceStatusItem[];
  clinical_prescription_lines?: AiPrescriptionLineItem[];
  questionnaire_responses?: AiQuestionnaireResponseItem[];
  rejection_report?: Array<{
    domain: string;
    reason: string;
    field?: string | null;
  }> | null;
};
