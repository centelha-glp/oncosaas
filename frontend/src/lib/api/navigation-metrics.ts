import { apiClient } from './client';

export interface NavigationMetrics {
  overdueStepsCount: number;
  criticalOverdueStepsCount: number;
  patientsByStage: {
    SCREENING: number;
    DIAGNOSIS: number;
    TREATMENT: number;
    FOLLOW_UP: number;
    PALLIATIVE: number;
  };
  stepsDueSoonCount: number;
  overallCompletionRate: number;
}

export const navigationMetricsApi = {
  async getMetrics(): Promise<NavigationMetrics> {
    const response = await apiClient.get<NavigationMetrics>(
      '/dashboard/navigation-metrics'
    );
    return response;
  },
};
