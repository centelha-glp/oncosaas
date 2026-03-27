'use client';

import { DashboardMetrics, DashboardStatistics } from '@/lib/api/dashboard';
import { TrendingUp, Clock, DollarSign, Users } from 'lucide-react';
import { useMemo } from 'react';
import { MetricInfoTooltip } from '@/components/shared/metric-info-tooltip';

interface ROISectionProps {
  metrics: DashboardMetrics;
  statistics: DashboardStatistics;
}

export function ROISection({ metrics, statistics }: ROISectionProps) {
  // Calcular métricas de ROI baseadas nos dados disponíveis
  const roiMetrics = useMemo(() => {
    // Estimativas baseadas em dados reais
    // Cada mensagem respondida pode evitar uma consulta presencial
    const totalMessages = metrics.unassumedMessagesCount;
    const estimatedConsultationsAvoided = Math.floor(totalMessages * 0.3); // 30% das mensagens evitam consulta

    // Tempo economizado: baseado em tempo médio de resposta e alertas pendentes
    const avgResponseTimeHours = metrics.averageResponseTimeMinutes
      ? metrics.averageResponseTimeMinutes / 60
      : 0;
    const timeSavedHours = metrics.totalPendingAlerts * avgResponseTimeHours;

    // Economia estimada: cada consulta presencial custa ~R$ 150-300
    // Usando média conservadora de R$ 200 por consulta evitada
    const costPerConsultation = 200;
    const estimatedSavings =
      estimatedConsultationsAvoided * costPerConsultation;

    // Comparação com baseline (últimos 30 dias vs últimos 7 dias)
    const last7Days = statistics.alertStatistics.slice(-7);
    const previous7Days = statistics.alertStatistics.slice(-14, -7);

    const avgAlertsLast7Days =
      last7Days.reduce((sum, day) => sum + day.total, 0) / 7;
    const avgAlertsPrevious7Days =
      previous7Days.reduce((sum, day) => sum + day.total, 0) / 7;

    const improvementPercentage =
      avgAlertsPrevious7Days > 0
        ? Math.round(
            ((avgAlertsPrevious7Days - avgAlertsLast7Days) /
              avgAlertsPrevious7Days) *
              100
          )
        : 0;

    return {
      consultationsAvoided: estimatedConsultationsAvoided,
      timeSavedHours: Math.round(timeSavedHours * 10) / 10,
      estimatedSavings,
      improvementPercentage,
      avgAlertsLast7Days: Math.round(avgAlertsLast7Days * 10) / 10,
      avgAlertsPrevious7Days: Math.round(avgAlertsPrevious7Days * 10) / 10,
    };
  }, [metrics, statistics]);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">Impacto e ROI</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Consultas Evitadas */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-600 flex items-center gap-1">
              Consultas Evitadas
              <MetricInfoTooltip title="Consultas Evitadas" description="Estimativa de consultas presenciais evitadas." calculation="30% das mensagens não assumidas." />
            </h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {roiMetrics.consultationsAvoided}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Estimativa baseada em mensagens respondidas
          </p>
        </div>

        {/* Tempo Economizado */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-medium text-gray-600 flex items-center gap-1">
              Tempo Economizado
              <MetricInfoTooltip title="Tempo Economizado" description="Estimativa de horas economizadas." calculation="Alertas pendentes × tempo médio de resposta (em horas)." />
            </h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {roiMetrics.timeSavedHours}h
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Baseado em tempo médio de resposta
          </p>
        </div>

        {/* Economia Estimada */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-medium text-gray-600 flex items-center gap-1">
              Economia Estimada
              <MetricInfoTooltip title="Economia Estimada" description="Economia estimada com consultas evitadas." calculation="Consultas evitadas × R$ 200 (custo médio)." />
            </h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            R$ {roiMetrics.estimatedSavings.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Custo evitado (consultas + deslocamento)
          </p>
        </div>

        {/* Melhoria vs Baseline */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-medium text-gray-600 flex items-center gap-1">
              Redução de Alertas
              <MetricInfoTooltip title="Redução de Alertas" description="Variação na média diária de alertas." calculation="(média 7d anteriores − últimos 7d) / anteriores × 100." />
            </h3>
          </div>
          <p
            className={`text-2xl font-bold ${roiMetrics.improvementPercentage > 0 ? 'text-green-600' : 'text-gray-900'}`}
          >
            {roiMetrics.improvementPercentage > 0 ? '+' : ''}
            {roiMetrics.improvementPercentage}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Últimos 7 dias vs. 7 dias anteriores
          </p>
        </div>
      </div>

      {/* Comparação com Baseline */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Comparação com Baseline
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">
              Média de Alertas (7 dias anteriores)
            </p>
            <p className="text-lg font-semibold text-gray-700">
              {roiMetrics.avgAlertsPrevious7Days} alertas/dia
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">
              Média de Alertas (últimos 7 dias)
            </p>
            <p className="text-lg font-semibold text-gray-700">
              {roiMetrics.avgAlertsLast7Days} alertas/dia
            </p>
          </div>
        </div>
        {roiMetrics.improvementPercentage > 0 && (
          <div className="mt-3 p-3 bg-green-50 rounded-md border border-green-200">
            <p className="text-sm text-green-800">
              ✅ Redução de {roiMetrics.improvementPercentage}% na média diária
              de alertas indica melhoria na gestão proativa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
