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

export interface Comorbidity {
  name: string;
  severity: string;
  controlled: boolean;
}

export interface FamilyHistory {
  relationship: string;
  cancerType: string;
  ageAtDiagnosis?: number;
}

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
  cancerType: string | null; // Pode ser null para pacientes em rastreio
  stage: string | null;
  diagnosisDate: string | null;
  performanceStatus: number | null;
  // Comorbidades e Fatores de Risco
  comorbidities: Comorbidity[] | null;
  currentMedications: CurrentMedication[] | null;
  smokingHistory: string | null;
  alcoholHistory: string | null;
  occupationalExposure: string | null;
  familyHistory: FamilyHistory[] | null;
  currentStage: string; // SCREENING, NAVIGATION, DIAGNOSIS, TREATMENT, FOLLOW_UP
  currentSpecialty: string | null;
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
  journey?: PatientJourney | null; // Jornada do paciente (rastreio, diagnóstico, tratamento)
  cancerDiagnoses?: CancerDiagnosis[]; // Múltiplos diagnósticos de câncer
  _count?: {
    messages: number;
    alerts: number;
    observations: number;
  };
  /** Contagem de alertas PENDING (alinhado com aba Alertas) */
  pendingAlertsCount?: number;
}

export interface CreatePatientDto {
  name: string;
  cpf?: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other';
  phone: string;
  email?: string;
  cancerType: string;
  stage: string;
  diagnosisDate?: string;
  performanceStatus?: number;
  currentStage: string;
  currentSpecialty?: string;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {}

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

export interface ComplementaryExamResult {
  id: string;
  performedAt: string;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string | null;
  referenceRange: string | null;
  isAbnormal: boolean | null;
  report: string | null;
}

export interface ComplementaryExam {
  id: string;
  tenantId: string;
  patientId: string;
  type: ComplementaryExamType;
  name: string;
  code: string | null;
  unit: string | null;
  referenceRange: string | null;
  results: ComplementaryExamResult[];
}

export interface PatientDetail extends Patient {
  journey: PatientJourney | null;
  cancerDiagnoses: CancerDiagnosis[];
  complementaryExams?: ComplementaryExam[];
  navigationSteps: NavigationStep[];
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

export interface ImportCsvResult {
  message: string;
  success: number;
  errors: Array<{ row: number; errors: string[] }>;
  created: Patient[];
}

export const patientsApi = {
  async getAll(): Promise<Patient[]> {
    return apiClient.get<Patient[]>('/patients');
  },

  async getById(id: string): Promise<Patient> {
    return apiClient.get<Patient>(`/patients/${id}`);
  },

  async getDetail(id: string): Promise<PatientDetail> {
    const response = await apiClient.get<{ data: PatientDetail } | PatientDetail>(
      `/patients/${id}/detail`
    );
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

  async getPatientSummary(
    patientId: string
  ): Promise<PatientSummaryResponse> {
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
};
