import { apiClient } from './client';

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
  status: string;
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
  findings: string[] | null;
  metadata: unknown | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateNavigationStepData {
  status?: string;
  isCompleted?: boolean;
  completedAt?: string;
  completedBy?: string;
  actualDate?: string;
  dueDate?: string;
  institutionName?: string;
  professionalName?: string;
  result?: string;
  findings?: string[];
  metadata?: unknown;
  notes?: string;
}

/** Dados para criar uma nova etapa de navegação */
export interface CreateNavigationStepData {
  patientId: string;
  cancerType: string;
  journeyStage: string;
  stepKey: string;
  stepName: string;
  stepDescription?: string;
  isRequired?: boolean;
  expectedDate?: string;
  dueDate?: string;
  diagnosisId?: string;
}

export const navigationApi = {
  /**
   * Lista todas as etapas de navegação de um paciente
   */
  getPatientSteps: async (patientId: string): Promise<NavigationStep[]> => {
    return apiClient.get<NavigationStep[]>(
      `/oncology-navigation/patients/${patientId}/steps`
    );
  },

  /**
   * Lista etapas de navegação por estágio da jornada
   */
  getStepsByStage: async (
    patientId: string,
    journeyStage: string
  ): Promise<NavigationStep[]> => {
    return apiClient.get<NavigationStep[]>(
      `/oncology-navigation/patients/${patientId}/steps/${journeyStage}`
    );
  },

  /**
   * Cria uma nova etapa de navegação
   */
  createStep: async (
    data: CreateNavigationStepData
  ): Promise<NavigationStep> => {
    return apiClient.post<NavigationStep>('/oncology-navigation/steps', data);
  },

  /**
   * Atualiza uma etapa de navegação
   */
  updateStep: async (
    stepId: string,
    data: UpdateNavigationStepData
  ): Promise<NavigationStep> => {
    return apiClient.patch<NavigationStep>(
      `/oncology-navigation/steps/${stepId}`,
      data
    );
  },

  /**
   * Exclui uma etapa de navegação
   */
  deleteStep: async (stepId: string): Promise<void> => {
    return apiClient.delete(`/oncology-navigation/steps/${stepId}`);
  },

  /**
   * Cria apenas as etapas faltantes para um estágio específico da jornada
   */
  createMissingStepsForStage: async (
    patientId: string,
    journeyStage: string
  ): Promise<{ created: number; skipped: number; message: string }> => {
    return apiClient.post<{
      created: number;
      skipped: number;
      message: string;
    }>(
      `/oncology-navigation/patients/${patientId}/stages/${journeyStage}/create-missing`
    );
  },
};
