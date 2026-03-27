'use client';

import { DashboardMetrics, DashboardStatistics } from '@/lib/api/dashboard';
import {
  TrendingUp,
  Clock,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { useMemo } from 'react';
import { MetricInfoTooltip } from '@/components/shared/metric-info-tooltip';

interface ExecutiveViewProps {
  metrics: DashboardMetrics;
  statistics: DashboardStatistics;
}

export function ExecutiveView({ metrics, statistics }: ExecutiveViewProps) {
  const executiveMetrics = useMemo(() => {
    const totalPatients = metrics.totalActivePatients;

    // Taxa de resolução de alertas (últimos 7 dias)
    const last7Days = statistics.alertStatistics.slice(-7);
    const totalAlerts7d = last7Days.reduce((sum, day) => sum + day.total, 0);
    const previous7Days = statistics.alertStatistics.slice(-14, -7);
    const totalAlertsPrev7d = previous7Days.reduce((sum, day) => sum + day.total, 0);

    const improvementPercentage =
      totalAlertsPrev7d > 0
        ? Math.round(((totalAlertsPrev7d - totalAlerts7d) / totalAlertsPrev7d) * 100)
        : 0;

    // Taxa de pacientes críticos
    const criticalRate =
      totalPatients > 0
        ? Math.round((metrics.criticalPatientsCount / totalPatients) * 100)
        : 0;

    return {
      improvementPercentage,
      criticalRate,
      totalPatients,
      avgAlertsPerDay: last7Days.length > 0
        ? Math.round((totalAlerts7d / last7Days.length) * 10) / 10
        : 0,
    };
  }, [metrics, statistics]);

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-6 w-6 text-indigo-600" />
        <h2 className="text-xl font-semibold text-gray-900">Visão Executiva</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Taxa de Pacientes Críticos */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="text-sm font-medium text-gray-600 flex items-center gap-1">
              Taxa de Pacientes Críticos
              <MetricInfoTooltip title="Taxa de Pacientes Críticos" description="Percentual de pacientes em estado crítico." calculation="Pacientes CRITICAL / total de pacientes ativos × 100." />
            </h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {executiveMetrics.criticalRate}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.criticalPatientsCount} de {executiveMetrics.totalPatients}{' '}
            pacientes
          </p>
        </div>

        {/* Redução de Alertas */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-medium text-gray-600 flex items-center gap-1">
              Variação de Alertas
              <MetricInfoTooltip title="Variação de Alertas" description="Variação percentual de alertas entre semanas." calculation="(alertas 7d anteriores − últimos 7d) / anteriores × 100." />
            </h3>
          </div>
          <p className={`text-2xl font-bold ${executiveMetrics.improvementPercentage > 0 ? 'text-green-600' : 'text-gray-900'}`}>
            {executiveMetrics.improvementPercentage > 0 ? '-' : ''}
            {Math.abs(executiveMetrics.improvementPercentage)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Últimos 7 dias vs. 7 dias anteriores
          </p>
        </div>

        {/* Média de Alertas/Dia */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-medium text-gray-600 flex items-center gap-1">
              Alertas/Dia (7d)
              <MetricInfoTooltip title="Alertas/Dia (7d)" description="Média de alertas por dia nos últimos 7 dias." calculation="Total de alertas nos últimos 7 dias / 7." />
            </h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {executiveMetrics.avgAlertsPerDay}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Média dos últimos 7 dias
          </p>
        </div>

        {/* Total de Pacientes */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-600 flex items-center gap-1">
              Pacientes Ativos
              <MetricInfoTooltip title="Pacientes Ativos" description="Total de pacientes em acompanhamento ativo." calculation="Contagem de pacientes com status ACTIVE no tenant." />
            </h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {executiveMetrics.totalPatients}
          </p>
          <p className="text-xs text-gray-500 mt-1">Em acompanhamento ativo</p>
        </div>
      </div>

      {/* Benchmarking */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Comparação com Padrões do Mercado
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600">Time-to-Treatment</p>
              <p className="text-lg font-semibold text-gray-900">
                {metrics.averageTimeToTreatmentDays !== null
                  ? `${metrics.averageTimeToTreatmentDays} dias`
                  : 'N/A'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Meta: {'<'} 30 dias</p>
              {metrics.averageTimeToTreatmentDays !== null &&
              metrics.averageTimeToTreatmentDays <= 30 ? (
                <p className="text-xs text-green-600 font-medium">Dentro da meta</p>
              ) : metrics.averageTimeToTreatmentDays !== null ? (
                <p className="text-xs text-red-600 font-medium">Acima da meta</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600">Time-to-Diagnosis</p>
              <p className="text-lg font-semibold text-gray-900">
                {metrics.averageTimeToDiagnosisDays !== null
                  ? `${metrics.averageTimeToDiagnosisDays} dias`
                  : 'N/A'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Meta: {'<'} 60 dias</p>
              {metrics.averageTimeToDiagnosisDays !== null &&
              metrics.averageTimeToDiagnosisDays <= 60 ? (
                <p className="text-xs text-green-600 font-medium">Dentro da meta</p>
              ) : metrics.averageTimeToDiagnosisDays !== null ? (
                <p className="text-xs text-red-600 font-medium">Acima da meta</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600">Pacientes Críticos</p>
              <p className="text-lg font-semibold text-gray-900">
                {executiveMetrics.criticalRate}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Ideal: {'<'} 10%</p>
              {executiveMetrics.criticalRate < 10 ? (
                <p className="text-xs text-green-600 font-medium">
                  Dentro do ideal
                </p>
              ) : (
                <p className="text-xs text-red-600 font-medium">
                  {executiveMetrics.criticalRate - 10}% acima
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
