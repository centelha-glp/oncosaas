import { apiClient } from './client';
import { getApiUrl } from '@/lib/utils/api-config';

export interface PatientSummaryHighlight {
  icon: 'info' | 'warning' | 'success' | 'clock';
  text: string;
}

export interface PatientSummaryRisk {
  risk: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PatientSummaryNextStep {
  step: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface PatientSummaryResponse {
  narrative: string;
  highlights: PatientSummaryHighlight[];
  risks: PatientSummaryRisk[];
  next_steps: PatientSummaryNextStep[];
  used_llm: boolean;
}

export interface CancerDiagnosis {
  id: string;
  tenantId: string;
  patientId: string;
  cancerType: string;
  icd10Code: string | null;
  // Estadiamento TNM Estruturado
  stage: string | null;
  tStage: string | null;
  nStage: string | null;
  mStage: string | null;
  grade: string | null;
  stagingDate: string | null;
  // Tipo Histológico
  histologicalType: string | null;
  // Diagnóstico
  diagnosisDate: string;
  diagnosisConfirmed: boolean;
  pathologyReport: string | null;
  confirmedBy: string | null;
  // Biomarcadores - Câncer de Mama
  her2Status: string | null;
  erStatus: string | null;
  prStatus: string | null;
  ki67Percentage: number | null;
  // Biomarcadores - Câncer de Pulmão/Colorretal
  egfrMutation: string | null;
  alkRearrangement: string | null;
  ros1Rearrangement: string | null;
  brafMutation: string | null;
  krasMutation: string | null;
  nrasMutation: string | null;
  pdl1Expression: number | null;
  msiStatus: string | null;
  // Biomarcadores - Câncer de Próstata
  psaBaseline: number | null;
  gleasonScore: string | null;
  // Marcadores Tumorais
  ceaBaseline: number | null;
  ca199Baseline: number | null;
  ca125Baseline: number | null;
  ca153Baseline: number | null;
  afpBaseline: number | null;
  hcgBaseline: number | null;
  // Status
  isPrimary: boolean;
  isActive: boolean;
  resolvedDate: string | null;
  resolutionReason: string | null;
  // Câncer metastático associado ao primário
  primaryDiagnosisId: string | null;
  primaryDiagnosis?: CancerDiagnosis | null;
  metastaticDiagnoses?: CancerDiagnosis[];
  createdAt: string;
  updatedAt: string;
}

export interface PatientJourney {
  id: string;
  tenantId: string;
  patientId: string;
  screeningDate: string | null;
  screeningResult: string | null;
  diagnosisDate: string | null;
  diagnosisConfirmed: boolean;
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
  blockers: string[];
  updatedAt: string;
}

// ─── Enums clínicos ────────────────────────────────────────────────────────────

export type MedicationCategory =
  | 'ANTICOAGULANT'
  | 'ANTIPLATELET'
  | 'CORTICOSTEROID'
  | 'IMMUNOSUPPRESSANT'
  | 'NSAID'
  | 'OPIOID_ANALGESIC'
  | 'NON_OPIOID_ANALGESIC'
  | 'ANTIEMETIC'
  | 'ANTIBIOTIC'
  | 'ANTIFUNGAL'
  | 'ANTIVIRAL'
  | 'ANTIHYPERTENSIVE'
  | 'ANTIDIABETIC'
  | 'BISPHOSPHONATE'
  | 'GROWTH_FACTOR'
  | 'PROTON_PUMP_INHIBITOR'
  | 'LAXATIVE'
  | 'OTHER';

export type ComorbidityType =
  | 'DIABETES_TYPE_1'
  | 'DIABETES_TYPE_2'
  | 'HYPERTENSION'
  | 'HEART_FAILURE'
  | 'CORONARY_ARTERY_DISEASE'
  | 'ATRIAL_FIBRILLATION'
  | 'COPD'
  | 'ASTHMA'
  | 'CHRONIC_KIDNEY_DISEASE'
  | 'LIVER_CIRRHOSIS'
  | 'HIV_AIDS'
  | 'AUTOIMMUNE_DISEASE'
  | 'STROKE_HISTORY'
  | 'DEEP_VEIN_THROMBOSIS'
  | 'PULMONARY_EMBOLISM'
  | 'PERIPHERAL_NEUROPATHY'
  | 'OBESITY'
  | 'DEPRESSION'
  | 'ANXIETY_DISORDER'
  | 'OTHER';

export type ComorbiditySeverity = 'MILD' | 'MODERATE' | 'SEVERE';

export type ClinicalDisposition =
  | 'REMOTE_NURSING'
  | 'SCHEDULED_CONSULT'
  | 'ADVANCE_CONSULT'
  | 'ER_DAYS'
  | 'ER_IMMEDIATE';

// ─── Modelos estruturados ───────────────────────────────────────────────────────

export interface Medication {
  id: string;
  patientId: string;
  tenantId: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  indication: string | null;
  route: string | null;
  category: MedicationCategory;
  isAnticoagulant: boolean;
  isAntiplatelet: boolean;
  isCorticosteroid: boolean;
  isImmunosuppressant: boolean;
  isOpioid: boolean;
  isNSAID: boolean;
  isGrowthFactor: boolean;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicationDto {
  name: string;
  dosage?: string;
  frequency?: string;
  indication?: string;
  route?: string;
  category?: MedicationCategory;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface Comorbidity {
  id: string;
  patientId: string;
  tenantId: string;
  name: string;
  type: ComorbidityType;
  severity: ComorbiditySeverity;
  controlled: boolean;
  increasesSepsisRisk: boolean;
  increasesBleedingRisk: boolean;
  increasesThrombosisRisk: boolean;
  affectsRenalClearance: boolean;
  affectsPulmonaryReserve: boolean;
  diagnosedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComorbidityDto {
  name: string;
  type?: ComorbidityType;
  severity?: ComorbiditySeverity;
  controlled?: boolean;
  diagnosedAt?: string;
  notes?: string;
}

export interface PerformanceStatusEntry {
  id: string;
  patientId: string;
  ecogScore: number;
  assessedAt: string;
  assessedBy: string | null;
  source: string;
  notes: string | null;
}

export interface EmergencyReference {
  id: string;
  tenantId: string;
  hospitalName: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  distanceKm: number | null;
  hasOncologyER: boolean;
  hasHematologyER: boolean;
  notes: string | null;
}

export interface FamilyHistory {
  relationship: string;
  cancerType: string;
  ageAtDiagnosis?: number;
}

// CurrentMedication mantido apenas para compatibilidade com seed data legado
export interface CurrentMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  indication?: string;
}

export interface Patient {
  id: string;
  tenantId: string;
  name: string;
  cpf: string | null;
  birthDate: string;
  gender: 'male' | 'female' | 'other';
  phone: string;
  email: string | null;
  cancerType: string | null;
  stage: string | null;
  diagnosisDate: string | null;
  performanceStatus: number | null;
  // Fatores de risco
  smokingHistory: string | null;
  alcoholHistory: string | null;
  occupationalExposure: string | null;
  familyHistory: FamilyHistory[] | null;
  // Disposição clínica (output do algoritmo de risco)
  clinicalDisposition: ClinicalDisposition | null;
  clinicalDispositionAt: string | null;
  clinicalDispositionReason: string | null;
  preferredEmergencyHospital: string | null;
  // Jornada
  currentStage: string;
  currentSpecialty: string | null;
  // Priorização IA
  priorityScore: number;
  priorityCategory: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priorityReason: string | null;
  priorityUpdatedAt: string | null;
  ehrPatientId: string | null;
  lastSyncAt: string | null;
  status: string;
  lastInteraction: string | null;
  createdAt: string;
  updatedAt: string;
  journey?: PatientJourney | null;
  cancerDiagnoses?: CancerDiagnosis[];
  medications?: Medication[];
  comorbidities?: Comorbidity[];
  performanceStatusHistory?: PerformanceStatusEntry[];
  _count?: {
    messages: number;
    alerts: number;
    observations: number;
  };
  pendingAlertsCount?: number;
  unassumedMessagesCount?: number;
}

export interface CreatePatientDto {
  name: string;
  cpf?: string;
  birthDate: string;
  gender?: 'male' | 'female' | 'other';
  phone: string;
  email?: string;
  cancerType?: string;
  cancerSubtype?: string;
  stage?: string;
  diagnosisDate?: string;
  performanceStatus?: number;
  currentStage: string;
  currentTreatment?: string;
  smokingHistory?: string;
  alcoholHistory?: string;
  occupationalExposure?: string;
  familyHistory?: { relationship: string; cancerType: string; ageAtDiagnosis?: number }[];
  comorbidities?: { name: string; type?: ComorbidityType; severity?: ComorbiditySeverity; controlled?: boolean }[];
  currentMedications?: { name: string; dosage?: string; frequency?: string; indication?: string; category?: MedicationCategory }[];
  ehrId?: string;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {
  currentMedications?: CurrentMedication[];
}

export interface NavigationStep {
  id: string;
  tenantId: string;
  patientId: string;
  journeyId: string | null;
  cancerType: string;
  journeyStage: string;
  stepKey: string;
  stepName: string;
  stepDescription: string | null;
  status:
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'OVERDUE'
    | 'CANCELLED'
    | 'NOT_APPLICABLE';
  isRequired: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: string | null;
  expectedDate: string | null;
  dueDate: string | null;
  actualDate: string | null;
  institutionName: string | null;
  professionalName: string | null;
  result: string | null;
  findings: any;
  metadata: any;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ComplementaryExamType =
  | 'LABORATORY'
  | 'ANATOMOPATHOLOGICAL'
  | 'IMMUNOHISTOCHEMICAL'
  | 'IMAGING';

export type LabCategory =
  | 'CBC'
  | 'METABOLIC'
  | 'COAGULATION'
  | 'LIVER_FUNCTION'
  | 'RENAL_FUNCTION'
  | 'THYROID'
  | 'TUMOR_MARKERS'
  | 'INFLAMMATORY'
  | 'CULTURES'
  | 'IMAGING_REPORT'
  | 'PATHOLOGY_REPORT'
  | 'OTHER';

export interface ComplementaryExamResult {
  id: string;
  performedAt: string;
  collectionId: string | null;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string | null;
  referenceRange: string | null;
  isAbnormal: boolean | null;
  criticalHigh: boolean | null;
  criticalLow: boolean | null;
  report: string | null;
}

export interface ComplementaryExam {
  id: string;
  tenantId: string;
  patientId: string;
  type: ComplementaryExamType;
  name: string;
  code: string | null;
  loincCode: string | null;
  labCategory: LabCategory | null;
  isCriticalMetric: boolean;
  unit: string | null;
  referenceRange: string | null;
  results: ComplementaryExamResult[];
}

export interface PatientDetail extends Patient {
  journey: PatientJourney | null;
  cancerDiagnoses: CancerDiagnosis[];
  complementaryExams?: ComplementaryExam[];
  navigationSteps: NavigationStep[];
  currentMedications?: CurrentMedication[];
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    message: string;
    createdAt: string;
  }>;
  _count?: {
    messages: number;
    alerts: number;
    observations: number;
  };
}

// ─── Timeline Unificada ──────────────────────────────────────────────────────

export type TimelineEventType =
  | 'symptom'
  | 'alert'
  | 'exam'
  | 'navigation_step'
  | 'consultation'
  | 'diagnosis'
  | 'treatment'
  | 'note'
  | 'intervention'
  | 'questionnaire';

export interface TimelineEvent {
  type: TimelineEventType;
  date: string;
  payload: Record<string, any>;
}

export interface TimelineResponse {
  data: TimelineEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface TimelineQueryParams {
  limit?: number;
  offset?: number;
  types?: TimelineEventType[];
}

export interface ImportCsvResult {
  message: string;
  success: number;
  errors: Array<{ row: number; errors: string[] }>;
  created: Patient[];
}

export const patientsApi = {
  async getAll(): Promise<Patient[]> {
    const data = await apiClient.get<Patient[] | null>('/patients');
    return data ?? [];
  },

  async getById(id: string): Promise<Patient> {
    return apiClient.get<Patient>(`/patients/${id}`);
  },

  async getDetail(id: string): Promise<PatientDetail> {
    const response = await apiClient.get<
      { data: PatientDetail } | PatientDetail
    >(`/patients/${id}/detail`);
    // Backend retorna { data: patient }; garantir que retornamos o objeto paciente
    if (response && typeof response === 'object' && 'data' in response) {
      return (response as { data: PatientDetail }).data;
    }
    return response as PatientDetail;
  },

  async create(data: CreatePatientDto): Promise<Patient> {
    return apiClient.post<Patient>('/patients', data);
  },

  async update(id: string, data: UpdatePatientDto): Promise<Patient> {
    return apiClient.patch<Patient>(`/patients/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/patients/${id}`);
  },

  async importCsv(file: File): Promise<ImportCsvResult> {
    const formData = new FormData();
    formData.append('file', file);

    const API_URL = getApiUrl();
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const tenantId =
      typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;

    const axios = (await import('axios')).default;
    const response = await axios.post<ImportCsvResult>(
      `${API_URL}/api/v1/patients/import`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tenantId || '',
        },
      }
    );

    return response.data;
  },

  // Cancer Diagnosis APIs
  async getCancerDiagnoses(patientId: string): Promise<CancerDiagnosis[]> {
    const response = await apiClient.get<{ data: CancerDiagnosis[] }>(
      `/patients/${patientId}/cancer-diagnoses`
    );
    return response.data;
  },

  async createCancerDiagnosis(
    patientId: string,
    data: any // CancerDiagnosisFormData
  ): Promise<CancerDiagnosis> {
    const response = await apiClient.post<{ data: CancerDiagnosis }>(
      `/patients/${patientId}/cancer-diagnoses`,
      data
    );
    return response.data;
  },

  async updateCancerDiagnosis(
    patientId: string,
    diagnosisId: string,
    data: any // CancerDiagnosisFormData
  ): Promise<CancerDiagnosis> {
    const response = await apiClient.patch<{ data: CancerDiagnosis }>(
      `/patients/${patientId}/cancer-diagnoses/${diagnosisId}`,
      data
    );
    return response.data;
  },

  async deleteCancerDiagnosis(
    patientId: string,
    diagnosisId: string
  ): Promise<void> {
    await apiClient.delete(
      `/patients/${patientId}/cancer-diagnoses/${diagnosisId}`
    );
  },

  async getTimeline(
    patientId: string,
    params?: TimelineQueryParams
  ): Promise<TimelineResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.types?.length)
      searchParams.set('types', params.types.join(','));
    const qs = searchParams.toString();
    return apiClient.get<TimelineResponse>(
      `/patients/${patientId}/timeline${qs ? `?${qs}` : ''}`
    );
  },

  async getPatientSummary(patientId: string): Promise<PatientSummaryResponse> {
    return apiClient.get<PatientSummaryResponse>(
      `/agent/patients/${patientId}/summary`
    );
  },

  // Complementary exams
  async getComplementaryExams(
    patientId: string,
    type?: ComplementaryExamType
  ): Promise<ComplementaryExam[]> {
    const params = type ? { type } : {};
    return apiClient.get<ComplementaryExam[]>(
      `/patients/${patientId}/complementary-exams`,
      { params }
    );
  },

  async createComplementaryExam(
    patientId: string,
    data: {
      type: ComplementaryExamType;
      name: string;
      code?: string;
      unit?: string;
      referenceRange?: string;
    }
  ): Promise<ComplementaryExam> {
    return apiClient.post<ComplementaryExam>(
      `/patients/${patientId}/complementary-exams`,
      data
    );
  },

  async updateComplementaryExam(
    patientId: string,
    examId: string,
    data: Partial<{
      type: ComplementaryExamType;
      name: string;
      code: string;
      unit: string;
      referenceRange: string;
    }>
  ): Promise<ComplementaryExam> {
    return apiClient.patch<ComplementaryExam>(
      `/patients/${patientId}/complementary-exams/${examId}`,
      data
    );
  },

  async deleteComplementaryExam(
    patientId: string,
    examId: string
  ): Promise<void> {
    await apiClient.delete(
      `/patients/${patientId}/complementary-exams/${examId}`
    );
  },

  async createComplementaryExamResult(
    patientId: string,
    examId: string,
    data: {
      performedAt: string;
      valueNumeric?: number;
      valueText?: string;
      unit?: string;
      referenceRange?: string;
      isAbnormal?: boolean;
      report?: string;
    }
  ): Promise<ComplementaryExamResult> {
    return apiClient.post<ComplementaryExamResult>(
      `/patients/${patientId}/complementary-exams/${examId}/results`,
      data
    );
  },

  async updateComplementaryExamResult(
    patientId: string,
    examId: string,
    resultId: string,
    data: Partial<{
      performedAt: string;
      valueNumeric: number;
      valueText: string;
      unit: string;
      referenceRange: string;
      isAbnormal: boolean;
      report: string;
    }>
  ): Promise<ComplementaryExamResult> {
    return apiClient.patch<ComplementaryExamResult>(
      `/patients/${patientId}/complementary-exams/${examId}/results/${resultId}`,
      data
    );
  },

  async deleteComplementaryExamResult(
    patientId: string,
    examId: string,
    resultId: string
  ): Promise<void> {
    await apiClient.delete(
      `/patients/${patientId}/complementary-exams/${examId}/results/${resultId}`
    );
  },

  // ── Medications ────────────────────────────────────────────────────────────

  async getMedications(patientId: string): Promise<Medication[]> {
    return apiClient.get<Medication[]>(`/patients/${patientId}/medications`);
  },

  async createMedication(
    patientId: string,
    data: CreateMedicationDto
  ): Promise<Medication> {
    return apiClient.post<Medication>(
      `/patients/${patientId}/medications`,
      data
    );
  },

  async updateMedication(
    patientId: string,
    medicationId: string,
    data: Partial<CreateMedicationDto>
  ): Promise<Medication> {
    return apiClient.patch<Medication>(
      `/patients/${patientId}/medications/${medicationId}`,
      data
    );
  },

  async deleteMedication(
    patientId: string,
    medicationId: string
  ): Promise<void> {
    await apiClient.delete(
      `/patients/${patientId}/medications/${medicationId}`
    );
  },

  // ── Comorbidities ──────────────────────────────────────────────────────────

  async getComorbidities(patientId: string): Promise<Comorbidity[]> {
    return apiClient.get<Comorbidity[]>(`/patients/${patientId}/comorbidities`);
  },

  async createComorbidity(
    patientId: string,
    data: CreateComorbidityDto
  ): Promise<Comorbidity> {
    return apiClient.post<Comorbidity>(
      `/patients/${patientId}/comorbidities`,
      data
    );
  },

  async updateComorbidity(
    patientId: string,
    comorbidityId: string,
    data: Partial<CreateComorbidityDto>
  ): Promise<Comorbidity> {
    return apiClient.patch<Comorbidity>(
      `/patients/${patientId}/comorbidities/${comorbidityId}`,
      data
    );
  },

  async deleteComorbidity(
    patientId: string,
    comorbidityId: string
  ): Promise<void> {
    await apiClient.delete(
      `/patients/${patientId}/comorbidities/${comorbidityId}`
    );
  },

  // ── Performance Status (ECOG History) ─────────────────────────────────────

  async getPerformanceStatusHistory(
    patientId: string
  ): Promise<PerformanceStatusEntry[]> {
    return apiClient.get<PerformanceStatusEntry[]>(
      `/patients/${patientId}/performance-status`
    );
  },

  async addPerformanceStatus(
    patientId: string,
    data: {
      ecogScore: number;
      assessedAt?: string;
      notes?: string;
      source?: string;
    }
  ): Promise<PerformanceStatusEntry> {
    return apiClient.post<PerformanceStatusEntry>(
      `/patients/${patientId}/performance-status`,
      data
    );
  },

  // ── Emergency Reference ────────────────────────────────────────────────────

  async getEmergencyReference(): Promise<EmergencyReference | null> {
    return apiClient.get<EmergencyReference | null>('/emergency-reference');
  },

  async upsertEmergencyReference(
    data: Partial<EmergencyReference>
  ): Promise<EmergencyReference> {
    return apiClient.put<EmergencyReference>('/emergency-reference', data);
  },
};
