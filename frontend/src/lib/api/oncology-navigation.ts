import { apiClient } from './client';
import type { JourneyStage } from '@/lib/utils/journey-stage';

/**
 * Datas por etapa (documentação produto ↔ JSON):
 * @see frontend/src/lib/utils/navigation-step-dates.ts NAVIGATION_STEP_UI_DATE_LABEL —
 * «Agendada» → expectedDate; «Limite» → dueDate; «Realizada» → actualDate.
 */
/** Parâmetro de estágio da jornada (API oncology-navigation) — alinhado ao Prisma. */
export type JourneyStageParam = JourneyStage;

export interface NavigationStep {
  id: string;
  tenantId?: string;
  patientId: string;
  journeyId?: string | null;
  cancerType: string;
  journeyStage:
    | 'SCREENING'
    | 'DIAGNOSIS'
    | 'TREATMENT'
    | 'FOLLOW_UP'
    | 'PALLIATIVE';
  stepKey: string;
  stepName: string;
  stepDescription?: string;
  status:
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'OVERDUE'
    | 'CANCELLED'
    | 'NOT_APPLICABLE';
  isRequired: boolean;
  isCompleted: boolean;
  completedAt?: string;
  /** «Agendada» na UI — data-alvo planejada. */
  expectedDate?: string;
  /** «Limite» na UI — vigência para alertas de atraso. */
  dueDate?: string;
  /** «Realizada» na UI — quando o evento ocorreu. */
  actualDate?: string;
  institutionName?: string; // Instituição de saúde onde foi realizada
  professionalName?: string; // Profissional que realizou a etapa
  result?: string; // Resultado da etapa
  findings?: string[]; // Lista de achados/alterações
  metadata?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNavigationStepDto {
  patientId: string;
  cancerType: string;
  journeyStage:
    | 'SCREENING'
    | 'DIAGNOSIS'
    | 'TREATMENT'
    | 'FOLLOW_UP'
    | 'PALLIATIVE';
  stepKey: string;
  stepName: string;
  stepDescription?: string;
  isRequired?: boolean;
  expectedDate?: string;
  dueDate?: string;
  diagnosisId?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
}

export type ConsultationAgendaScope = 'consultations' | 'all';

export interface ConsultationAgendaItem {
  id: string;
  patientId: string;
  stepKey: string;
  stepName: string;
  journeyStage: NavigationStep['journeyStage'];
  status: NavigationStep['status'];
  isCompleted: boolean;
  expectedDate: string | null;
  dueDate: string | null;
  actualDate: string | null;
  agendaDate: string;
  patient: { id: string; name: string };
}

export interface ConsultationAgendaPage {
  items: ConsultationAgendaItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ConsultationAgendaQuery {
  from: string;
  to: string;
  scope?: ConsultationAgendaScope;
  page?: number;
  limit?: number;
}

export interface UpdateNavigationStepDto {
  status?:
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'OVERDUE'
    | 'CANCELLED'
    | 'NOT_APPLICABLE';
  isCompleted?: boolean;
  completedAt?: string;
  completedBy?: string;
  expectedDate?: string;
  actualDate?: string;
  dueDate?: string;
  institutionName?: string; // Instituição de saúde onde foi realizada
  professionalName?: string; // Profissional que realizou
  result?: string; // Resultado da etapa
  findings?: string[]; // Lista de achados/alterações
  metadata?: Record<string, unknown>;
  notes?: string;
  journeyStage?:
    | 'SCREENING'
    | 'DIAGNOSIS'
    | 'TREATMENT'
    | 'FOLLOW_UP'
    | 'PALLIATIVE';
}

export const oncologyNavigationApi = {
  /**
   * Agenda de consultas (etapas com data no intervalo, por padrão só consultas clínicas).
   */
  getConsultationAgenda: async (
    params: ConsultationAgendaQuery
  ): Promise<ConsultationAgendaPage> => {
    return apiClient.get<ConsultationAgendaPage>(
      '/oncology-navigation/consultation-agenda',
      {
        params: {
          from: params.from,
          to: params.to,
          scope: params.scope,
          page: params.page,
          limit: params.limit,
        },
      }
    );
  },

  /**
   * Obtém todas as etapas de navegação de um paciente
   */
  getPatientSteps: async (patientId: string): Promise<NavigationStep[]> => {
    const data = await apiClient.get<NavigationStep[] | null>(
      `/oncology-navigation/patients/${patientId}/steps`
    );
    return data ?? [];
  },

  /**
   * Obtém etapas por fase da jornada
   */
  getStepsByStage: async (
    patientId: string,
    journeyStage: JourneyStageParam
  ): Promise<NavigationStep[]> => {
    const data = await apiClient.get<NavigationStep[] | null>(
      `/oncology-navigation/patients/${patientId}/steps/${journeyStage}`
    );
    return data ?? [];
  },

  /**
   * Inicializa etapas de navegação para um paciente
   */
  initializeSteps: async (
    patientId: string,
    cancerType: string,
    currentStage: JourneyStageParam
  ): Promise<void> => {
    await apiClient.post(
      `/oncology-navigation/patients/${patientId}/initialize`,
      {
        cancerType,
        currentStage,
      }
    );
  },

  /**
   * Cria uma nova etapa de navegação
   */
  createStep: async (
    data: CreateNavigationStepDto
  ): Promise<NavigationStep> => {
    return apiClient.post<NavigationStep>('/oncology-navigation/steps', data);
  },

  /**
   * Atualiza uma etapa de navegação
   */
  updateStep: async (
    stepId: string,
    data: UpdateNavigationStepDto
  ): Promise<NavigationStep> => {
    return apiClient.patch<NavigationStep>(
      `/oncology-navigation/steps/${stepId}`,
      data
    );
  },

  /**
   * Inicializa etapas de navegação para todos os pacientes existentes
   */
  initializeAllPatients: async (): Promise<{
    message: string;
    initialized: number;
    skipped: number;
    errors: number;
  }> => {
    return apiClient.post<{
      message: string;
      initialized: number;
      skipped: number;
      errors: number;
    }>('/oncology-navigation/initialize-all-patients');
  },

  /**
   * Retorna todos os templates de etapas para uma fase, com contagem de instâncias existentes
   */
  getStepTemplates: async (
    patientId: string,
    journeyStage: string
  ): Promise<
    {
      stepKey: string;
      stepName: string;
      stepDescription?: string;
      journeyStage: string;
      isRequired: boolean;
      existingCount: number;
    }[]
  > => {
    const data = await apiClient.get<
      {
        stepKey: string;
        stepName: string;
        stepDescription?: string;
        journeyStage: string;
        isRequired: boolean;
        existingCount: number;
      }[]
    >(
      `/oncology-navigation/patients/${patientId}/step-templates/${journeyStage}`
    );
    return data ?? [];
  },

  /**
   * Cria uma instância de um step a partir de um template (primeira ou adicional)
   */
  createStepFromTemplate: async (
    patientId: string,
    journeyStage: string,
    stepKey: string
  ): Promise<NavigationStep> => {
    return apiClient.post<NavigationStep>(
      `/oncology-navigation/patients/${patientId}/stages/${journeyStage}/create-from-template`,
      { stepKey }
    );
  },

  /**
   * Cria etapas faltantes para uma fase (opcionalmente apenas uma pelo stepKey)
   */
  createMissingStepsForStage: async (
    patientId: string,
    journeyStage: string,
    stepKey?: string
  ): Promise<{ created: number; skipped: number; message?: string }> => {
    return apiClient.post<{
      created: number;
      skipped: number;
      message?: string;
    }>(
      `/oncology-navigation/patients/${patientId}/stages/${journeyStage}/create-missing`,
      stepKey ? { stepKey } : {}
    );
  },

  /**
   * Exclui uma etapa de navegação
   */
  deleteStep: async (stepId: string): Promise<void> => {
    await apiClient.delete(`/oncology-navigation/steps/${stepId}`);
  },

  /**
   * Faz upload de arquivo para uma etapa
   */
  uploadFile: async (stepId: string, file: File): Promise<NavigationStep> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postFormData<NavigationStep>(
      `/oncology-navigation/steps/${stepId}/upload`,
      formData
    );
  },
};
