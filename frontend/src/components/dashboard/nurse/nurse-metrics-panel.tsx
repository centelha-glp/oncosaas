'use client';

import { useNurseMetrics } from '@/hooks/useNurseMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Clock, Users, TrendingUp } from 'lucide-react';
import { MetricInfoTooltip } from '@/components/shared/metric-info-tooltip';
import { formatMinutes } from '@/lib/utils';

export function NurseMetricsPanel() {
  const { data: metrics, isLoading, error } = useNurseMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
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
      <div className="text-center py-4 text-red-500">
        Erro ao carregar métricas: {error.message}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Cards de métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Alertas Resolvidos Hoje
              <MetricInfoTooltip title="Alertas Resolvidos Hoje" description="Alertas que você resolveu hoje." calculation="Contagem de alertas com resolvedAt = hoje e resolvedByUserId = seu ID." />
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.alertsResolvedToday}
            </div>
            <p className="text-xs text-muted-foreground">
              Resolvidos por você hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Tempo Médio de Resposta
              <MetricInfoTooltip title="Tempo Médio de Resposta" description="Tempo médio entre mensagem recebida e intervenção." calculation="Média em minutos, últimos 90 dias." />
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageResponseTimeMinutes !== null
                ? formatMinutes(metrics.averageResponseTimeMinutes)
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Média de tempo de resposta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Pacientes Atendidos Hoje
              <MetricInfoTooltip title="Pacientes Atendidos Hoje" description="Pacientes distintos que você atendeu hoje." calculation="Contagem distinta de patientId nas intervenções de hoje." />
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.patientsAttendedToday}
            </div>
            <p className="text-xs text-muted-foreground">
              Pacientes únicos atendidos hoje
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sintomas Mais Reportados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1">
            Sintomas Mais Reportados
            <MetricInfoTooltip title="Sintomas Mais Reportados" description="Top 5 sintomas reportados nos últimos 30 dias." calculation="Contagem de alertas agrupados por tipo de sintoma." />
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {metrics.topReportedSymptoms.length > 0 ? (
            <div className="space-y-2">
              {metrics.topReportedSymptoms.slice(0, 5).map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{item.symptom}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.count}</span>
                    <span className="text-xs text-muted-foreground">
                      ({item.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum sintoma reportado nos últimos 30 dias
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
