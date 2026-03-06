import { apiClient } from './client';

export interface Alert {
  id: string;
  tenantId: string;
  patientId: string;
  type:
    | 'CRITICAL_SYMPTOM'
    | 'NO_RESPONSE'
    | 'DELAYED_APPOINTMENT'
    | 'SCORE_CHANGE'
    | 'SYMPTOM_WORSENING'
    | 'NAVIGATION_DELAY'
    | 'MISSING_EXAM'
    | 'STAGING_INCOMPLETE'
    | 'TREATMENT_DELAY'
    | 'FOLLOW_UP_OVERDUE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  context: Record<string, unknown> | null;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: string;
    name: string;
    phone: string;
    priorityScore: number;
  };
}

export interface CreateAlertDto {
  patientId: string;
  type: Alert['type'];
  severity: Alert['severity'];
  message: string;
  context?: Record<string, unknown>;
}

export interface AlertCount {
  count: number;
}

export const alertsApi = {
  async getAll(status?: Alert['status']): Promise<Alert[]> {
    const url = status ? `/alerts?status=${status}` : '/alerts';
    return apiClient.get<Alert[]>(url);
  },

  async getById(id: string): Promise<Alert> {
    return apiClient.get<Alert>(`/alerts/${id}`);
  },

  async getCriticalCount(): Promise<AlertCount> {
    return apiClient.get<AlertCount>('/alerts/critical/count');
  },

  async getOpenCount(): Promise<AlertCount> {
    return apiClient.get<AlertCount>('/alerts/open/count');
  },

  async create(data: CreateAlertDto): Promise<Alert> {
    return apiClient.post<Alert>('/alerts', data);
  },

  async acknowledge(id: string): Promise<Alert> {
    return apiClient.patch<Alert>(`/alerts/${id}/acknowledge`, {});
  },

  async resolve(id: string): Promise<Alert> {
    return apiClient.patch<Alert>(`/alerts/${id}/resolve`, {});
  },

  async dismiss(id: string): Promise<Alert> {
    return apiClient.patch<Alert>(`/alerts/${id}/dismiss`, {});
  },
};
