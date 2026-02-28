import { apiClient } from './client';

export interface Conversation {
  id: string;
  tenantId: string;
  patientId: string;
  channel: 'WHATSAPP' | 'SMS' | 'VOICE' | 'WEB_CHAT';
  status: 'ACTIVE' | 'WAITING' | 'ESCALATED' | 'CLOSED';
  handledBy: 'AGENT' | 'NURSING' | 'HYBRID';
  assumedByUserId?: string;
  assumedAt?: string;
  agentState?: Record<string, unknown>;
  activeQuestionnaireId?: string;
  questionnaireProgress?: QuestionnaireProgress;
  lastMessageAt?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: string;
    name: string;
    cancerType?: string;
  };
}

export interface QuestionnaireProgress {
  type: 'ESAS' | 'PRO_CTCAE';
  items: (string | { item: string; attribute: string })[];
  currentIndex: number;
  answers: Record<string, number | null>;
  startedAt?: string;
  completedAt?: string;
}

export interface AgentDecisionLog {
  id: string;
  tenantId: string;
  conversationId: string;
  patientId: string;
  decisionType: string;
  reasoning: string;
  confidence?: number;
  inputData: Record<string, unknown>;
  outputAction: Record<string, unknown>;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejected: boolean;
  rejectionReason?: string;
  createdAt: string;
  conversation?: Conversation;
}

export interface ConversationListResponse {
  data: Conversation[];
  total: number;
  page: number;
  limit: number;
}

export const conversationsApi = {
  list: (params?: {
    patientId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ConversationListResponse> =>
    apiClient.get('/agent/conversations', { params }),

  get: (id: string): Promise<Conversation> =>
    apiClient.get(`/agent/conversations/${id}`),

  escalate: (id: string): Promise<Conversation> =>
    apiClient.post(`/agent/conversations/${id}/escalate`),

  close: (id: string): Promise<Conversation> =>
    apiClient.post(`/agent/conversations/${id}/close`),

  getPendingDecisions: (): Promise<AgentDecisionLog[]> =>
    apiClient.get('/agent/decisions/pending'),

  approveDecision: (id: string): Promise<AgentDecisionLog> =>
    apiClient.post(`/agent/decisions/${id}/approve`),

  rejectDecision: (id: string, reason: string): Promise<AgentDecisionLog> =>
    apiClient.post(`/agent/decisions/${id}/reject`, { reason }),
};
