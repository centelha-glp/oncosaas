import { apiClient } from './client';

export interface Message {
  id: string;
  tenantId: string;
  patientId: string;
  conversationId: string | null;
  whatsappMessageId: string;
  whatsappTimestamp: string;
  type: 'TEXT' | 'AUDIO' | 'IMAGE' | 'DOCUMENT';
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  audioUrl: string | null;
  audioDuration: number | null;
  transcribedText: string | null;
  processedBy: 'AGENT' | 'NURSING';
  structuredData: Record<string, unknown> | null;
  criticalSymptomsDetected: string[];
  alertTriggered: boolean;
  assumedBy: string | null;
  assumedAt: string | null;
  createdAt: string;
  patient?: {
    id: string;
    name: string;
    phone: string;
  };
}

export interface MessageCount {
  count: number;
}

export interface SendMessageDto {
  patientId: string;
  content: string;
  conversationId?: string;
}

export const messagesApi = {
  async getAll(
    patientId?: string,
    limit?: number,
    offset?: number
  ): Promise<Message[]> {
    const params = new URLSearchParams();
    if (patientId) params.set('patientId', patientId);
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const query = params.toString();
    return apiClient.get<Message[]>(query ? `/messages?${query}` : '/messages');
  },

  async getById(id: string): Promise<Message> {
    return apiClient.get<Message>(`/messages/${id}`);
  },

  async getUnassumedCount(): Promise<MessageCount> {
    return apiClient.get<MessageCount>('/messages/unassumed/count');
  },

  async assume(id: string): Promise<Message> {
    return apiClient.patch<Message>(`/messages/${id}/assume`, {});
  },

  async send(data: SendMessageDto): Promise<Message> {
    // A3: crypto.randomUUID() is universally unique — avoids the collision that
    // Date.now() would produce when two messages are sent within the same ms,
    // which would cause the backend to discard the second as a duplicate.
    return apiClient.post<Message>('/messages', {
      patientId: data.patientId,
      conversationId: data.conversationId,
      whatsappMessageId: `nursing_${crypto.randomUUID()}`,
      whatsappTimestamp: new Date().toISOString(),
      type: 'TEXT',
      direction: 'OUTBOUND',
      content: data.content,
      processedBy: 'NURSING',
    });
  },
};
