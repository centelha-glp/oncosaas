export interface StageMetrics {
  stage: string;
  patientsCount: number;
  completionRate: number; // Taxa de conclusão de etapas nesta fase (%)
  averageTimeDays: number | null; // Tempo médio em dias nesta fase
  totalSteps: number;
  completedSteps: number;
  pendingSteps: number;
  overdueSteps: number;
}

export interface Bottleneck {
  stage: string;
  stageLabel: string;
  patientsCount: number;
  percentage: number; // % do total de pacientes
  averageTimeDays: number | null;
  reason: string; // Razão identificada do bottleneck
}

export class NavigationMetricsDto {
  // Etapas atrasadas
  overdueStepsCount: number;
  criticalOverdueStepsCount: number; // Obrigatórias + >14 dias

  // Pacientes por fase da jornada
  patientsByStage: {
    SCREENING: number;
    DIAGNOSIS: number;
    TREATMENT: number;
    FOLLOW_UP: number;
    PALLIATIVE: number;
  };

  // Etapas próximas do prazo (próximas 7 dias)
  stepsDueSoonCount: number;

  // Taxa de conclusão de etapas
  overallCompletionRate: number; // Percentual (0-100)

  // Métricas Avançadas de Navegação
  stageMetrics: StageMetrics[]; // Métricas detalhadas por fase
  bottlenecks: Bottleneck[]; // Identificação de bottlenecks
  averageTimePerStage: {
    SCREENING: number | null;
    DIAGNOSIS: number | null;
    TREATMENT: number | null;
    FOLLOW_UP: number | null;
    PALLIATIVE: number | null;
  };
}