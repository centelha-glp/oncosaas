import { apiClient } from './client';

export interface QuestionnaireResponseScores {
  total?: number;
  items?: Record<string, number>;
  alerts?: Array<{
    item: string;
    score?: number;
    grade?: number;
    severity: string;
  }>;
  interpretation?: string;
}

export interface QuestionnaireResponse {
  id: string;
  tenantId: string;
  patientId: string;
  questionnaireId: string;
  responses: Record<string, unknown>;
  completedAt: string;
  messageId: string | null;
  conversationId: string | null;
  appliedBy: string;
  scores: QuestionnaireResponseScores | null;
  patient?: {
    id: string;
    name: string;
  };
  questionnaire?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface QuestionnaireResponsesGetAllParams {
  patientId?: string;
  questionnaireId?: string;
  limit?: number;
  offset?: number;
}

export const questionnaireResponsesApi = {
  async getAll(
    patientId?: string,
    questionnaireId?: string,
    options?: { limit?: number; offset?: number }
  ): Promise<QuestionnaireResponse[]> {
    const params = new URLSearchParams();
    if (patientId) params.append('patientId', patientId);
    if (questionnaireId) params.append('questionnaireId', questionnaireId);
    if (options?.limit != null) params.append('limit', String(options.limit));
    if (options?.offset != null) params.append('offset', String(options.offset));
    const query = params.toString();
    return apiClient.get<QuestionnaireResponse[]>(
      `/questionnaire-responses${query ? `?${query}` : ''}`
    );
  },

  async getById(id: string): Promise<QuestionnaireResponse> {
    return apiClient.get<QuestionnaireResponse>(
      `/questionnaire-responses/${id}`
    );
  },
};
