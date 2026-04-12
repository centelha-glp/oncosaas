'use client';

import { useNavigationMetrics } from '@/hooks/useNavigationMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Clock,
  Users,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MetricInfoTooltip } from '@/components/shared/metric-info-tooltip';
import { QueryErrorRetry } from '@/components/shared/query-error-retry';

const JOURNEY_STAGE_LABELS: Record<string, string> = {
  SCREENING: 'Rastreio',
  DIAGNOSIS: 'Diagnóstico',
  TREATMENT: 'Tratamento',
  FOLLOW_UP: 'Seguimento',
  PALLIATIVE: 'Cuidados paliativos',
};

export function NavigationMetricsPanel() {
  const { data: metrics, isLoading, error, refetch, isFetching } =
    useNavigationMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg py-2">
        <QueryErrorRetry
          title="Não foi possível carregar as métricas de navegação"
          onRetry={refetch}
          isFetching={isFetching}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Etapas Atrasadas
              <MetricInfoTooltip title="Etapas Atrasadas" description="Etapas de navegação com prazo vencido." calculation="Etapas OVERDUE ou PENDING/IN_PROGRESS com dueDate < hoje." />
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.overdueStepsCount ?? 0}
            </div>
            {metrics && metrics.criticalOverdueStepsCount > 0 && (
              <p className="text-xs text-red-600 mt-1">
                {metrics.criticalOverdueStepsCount} críticas (&gt;14 dias)
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Etapas Próximas do Prazo
              <MetricInfoTooltip title="Etapas Próximas do Prazo" description="Etapas com prazo nos próximos 7 dias." calculation="Etapas PENDING/IN_PROGRESS com dueDate entre hoje e hoje + 7 dias." />
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.stepsDueSoonCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Próximos 7 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Taxa de Conclusão
              <MetricInfoTooltip title="Taxa de Conclusão" description="Percentual de etapas concluídas." calculation="Etapas COMPLETED / total de etapas × 100." />
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.overallCompletionRate ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Etapas concluídas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Total de Pacientes
              <MetricInfoTooltip title="Total de Pacientes" description="Pacientes em acompanhamento de navegação." calculation="Soma de pacientes em todos os estágios da jornada." />
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics
                ? Object.values(metrics.patientsByStage).reduce(
                    (a, b) => a + b,
                    0
                  )
                : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Em acompanhamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por fase da jornada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Pacientes por Fase da Jornada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics &&
              Object.entries(metrics.patientsByStage).map(([stage, count]) => (
                <div
                  key={stage}
                  className="flex flex-col items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Badge variant="outline" className="mb-2">
                    {JOURNEY_STAGE_LABELS[stage] || stage}
                  </Badge>
                  <div className="text-2xl font-bold">{count}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    pacientes
                  </p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
