import { apiClient } from './client';

export interface AgentConfig {
  id: string;
  tenantId: string;
  llmProvider: string;
  llmModel: string;
  llmFallbackProvider?: string;
  llmFallbackModel?: string;
  maxAutoReplies: number;
  agentLanguage: string;
  isActive: boolean;
  escalationThreshold: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledAction {
  id: string;
  tenantId: string;
  patientId: string;
  conversationId?: string;
  actionType: 'CHECK_IN' | 'SEND_MESSAGE' | 'QUESTIONNAIRE' | 'VOICE_CALL';
  scheduledAt: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  payload: Record<string, unknown>;
  retryCount: number;
  lastError?: string;
  patient?: { id: string; name: string };
}

export const agentConfigApi = {
  get: (): Promise<AgentConfig | null> =>
    apiClient.get('/agent/config').catch(() => null),

  update: (data: Partial<AgentConfig>): Promise<AgentConfig> =>
    apiClient.patch('/agent/config', data),

  getScheduledActions: (params?: {
    status?: string;
    patientId?: string;
  }): Promise<ScheduledAction[]> =>
    apiClient.get('/agent/scheduled-actions', { params }),
};
