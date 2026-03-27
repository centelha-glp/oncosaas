'use client';

import { DashboardMetrics, DashboardStatistics } from '@/lib/api/dashboard';
import { Clock, CheckCircle2, Users, TrendingUp } from 'lucide-react';
import { cn, formatMinutes } from '@/lib/utils';
import { MetricInfoTooltip } from '@/components/shared/metric-info-tooltip';

interface TeamPerformanceProps {
  metrics: DashboardMetrics;
  statistics: DashboardStatistics;
  isLoading?: boolean;
}

export function TeamPerformance({
  metrics,
  statistics,
  isLoading,
}: TeamPerformanceProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  // Calcular taxa de resolução de alertas (últimos 7 dias)
  const resolvedAlerts7d = statistics.alertStatistics.reduce(
    (sum, day) => sum + day.total,
    0
  );
  const totalAlerts7d = resolvedAlerts7d + metrics.totalPendingAlerts;
  const resolutionRate7d =
    totalAlerts7d > 0
      ? Math.round((resolvedAlerts7d / totalAlerts7d) * 100)
      : 0;

  // Calcular taxa de resolução em 24h (aproximado)
  const recentResolved = statistics.responseTimeStatistics.filter(
    (r) => r.averageMinutes <= 24 * 60 && r.averageMinutes > 0
  ).length;
  const resolutionRate24h =
    statistics.responseTimeStatistics.length > 0
      ? Math.round(
          (recentResolved / statistics.responseTimeStatistics.length) * 100
        )
      : 0;

  // Tempo médio de resposta (últimos 7 dias)
  const avgResponseTime =
    statistics.responseTimeStatistics.length > 0
      ? statistics.responseTimeStatistics.reduce(
          (sum, r) => sum + r.averageMinutes,
          0
        ) / statistics.responseTimeStatistics.length
      : metrics.averageResponseTimeMinutes || 0;

  // Carga de trabalho (pacientes por profissional)
  // Assumindo 1 oncologista por tenant (pode ser ajustado)
  const workloadPerProfessional = metrics.totalActivePatients;

  const performanceCards = [
    {
      title: 'Tempo Médio de Resposta',
      value:
        avgResponseTime > 0
          ? formatMinutes(avgResponseTime)
          : 'N/A',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      trend: avgResponseTime < (metrics.averageResponseTimeMinutes || Infinity),
      tooltip: { description: 'Tempo médio de resposta da equipe nos últimos 7 dias.', calculation: 'Média dos tempos de resposta diários.' },
    },
    {
      title: 'Taxa de Resolução (7 dias)',
      value: `${resolutionRate7d}%`,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      trend: resolutionRate7d >= 80,
      tooltip: { description: 'Percentual de alertas resolvidos nos últimos 7 dias.', calculation: 'Alertas resolvidos / (resolvidos + pendentes) × 100.' },
    },
    {
      title: 'Resolução em 24h',
      value: `${resolutionRate24h}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      trend: resolutionRate24h >= 60,
      tooltip: { description: 'Dias com tempo de resposta < 24h.', calculation: 'Dias com avgResponseTime ≤ 24h / total de dias × 100.' },
    },
    {
      title: 'Carga de Trabalho',
      value: `${workloadPerProfessional} pacientes`,
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      subtitle: 'por profissional',
      tooltip: { description: 'Total de pacientes ativos por profissional.', calculation: 'Total de pacientes ativos no tenant.' },
    },
  ];

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">Performance da Equipe</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className={cn(
                'rounded-lg border p-4',
                card.borderColor,
                card.bgColor
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={cn('p-2 rounded-md bg-white', card.bgColor)}>
                  <Icon className={cn('h-5 w-5', card.color)} />
                </div>
                {card.trend !== undefined && (
                  <div
                    className={cn(
                      'text-xs px-2 py-1 rounded',
                      card.trend
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    )}
                  >
                    {card.trend ? '✓' : '⚠'}
                  </div>
                )}
              </div>
              <div>
                <span className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                  {card.title}
                  {card.tooltip && <MetricInfoTooltip title={card.title} description={card.tooltip.description} calculation={card.tooltip.calculation} />}
                </span>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
