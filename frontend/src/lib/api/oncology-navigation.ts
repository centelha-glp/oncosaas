import axios from 'axios';
import { apiClient } from './client';
import { getApiUrl } from '@/lib/utils/api-config';

export interface NavigationStep {
  id: string;
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
  expectedDate?: string;
  dueDate?: string; // Data limite para gerar alarmes de atraso
  actualDate?: string; // Data real de conclusão
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
  metadata?: Record<string, unknown>;
  notes?: string;
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
  actualDate?: string; // Data realizada
  dueDate?: string; // Data limite para gerar alarmes de atraso
  institutionName?: string; // Instituição de saúde onde foi realizada
  professionalName?: string; // Profissional que realizou
  result?: string; // Resultado da etapa
  findings?: string[]; // Lista de achados/alterações
  metadata?: Record<string, unknown>;
  notes?: string;
}

export const oncologyNavigationApi = {
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
    journeyStage:
      | 'SCREENING'
      | 'DIAGNOSIS'
      | 'TREATMENT'
      | 'FOLLOW_UP'
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
    currentStage:
      | 'SCREENING'
      | 'DIAGNOSIS'
      | 'TREATMENT'
      | 'FOLLOW_UP'
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
   * Cria etapas faltantes para uma fase
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

  /**
   * Faz upload de arquivo para uma etapa
   */
  /**
   * Retorna templates de etapas disponíveis (não criadas) para uma fase
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
    }[]
  > => {
    const data = await apiClient.get<
      {
        stepKey: string;
        stepName: string;
        stepDescription?: string;
        journeyStage: string;
        isRequired: boolean;
      }[]
    >(`/oncology-navigation/patients/${patientId}/step-templates/${journeyStage}`);
    return data ?? [];
  },

  /**
   * Cria etapas faltantes para uma fase (opcionalmente apenas uma pelo stepKey)
   */
  createMissingStepsForStage: async (
    patientId: string,
    journeyStage: string,
    stepKey?: string
  ): Promise<{ created: number; skipped: number }> => {
    return apiClient.post<{ created: number; skipped: number }>(
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

    // Usar axios diretamente para FormData (não definir Content-Type manualmente)
    const API_URL = getApiUrl();
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const tenantId =
      typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;

    const response = await axios.post<NavigationStep>(
      `${API_URL}/api/v1/oncology-navigation/steps/${stepId}/upload`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tenantId || '',
          // Não definir Content-Type - deixar o navegador definir com boundary
        },
      }
    );

    return response.data;
  },
};
