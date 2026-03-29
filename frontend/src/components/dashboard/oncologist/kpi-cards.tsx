'use client';

import { DashboardMetrics } from '@/lib/api/dashboard';
import {
  AlertTriangle,
  Users,
  Bell,
  Clock,
  MessageSquare,
  CalendarX,
  Activity,
  Stethoscope,
  Dna,
  CheckCircle2,
} from 'lucide-react';
import { cn, formatMinutes } from '@/lib/utils';
import { MetricInfoTooltip } from '@/components/shared/metric-info-tooltip';

interface KPICardsProps {
  metrics: DashboardMetrics | undefined;
  isLoading?: boolean;
  onCardClick?: (filterType: string, filterValue?: string | Record<string, unknown>, cardTitle?: string) => void;
}

export function KPICards({ metrics, isLoading, onCardClick }: KPICardsProps) {
  if (!metrics) {
    return null;
  }
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Pacientes Críticos',
      value: metrics.criticalPatientsCount,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      badge: metrics.criticalPatientsCount > 0,
      clickable: true,
      filterType: 'priority',
      filterValue: 'CRITICAL',
      tooltip: { description: 'Pacientes classificados com prioridade CRITICAL.', calculation: 'Contagem de pacientes ativos com priorityCategory = CRITICAL.' },
    },
    {
      title: 'Total de Pacientes',
      value: metrics.totalActivePatients,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      clickable: false,
      tooltip: { description: 'Total de pacientes ativos no tenant.', calculation: 'Contagem de pacientes com status ACTIVE.' },
    },
    {
      title: 'Alertas Pendentes',
      value: metrics.totalPendingAlerts,
      icon: Bell,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      badge: metrics.criticalAlertsCount > 0,
      breakdown: {
        critical: metrics.criticalAlertsCount,
        high: metrics.highAlertsCount,
        medium: metrics.mediumAlertsCount,
        low: metrics.lowAlertsCount,
      },
      clickable: true,
      filterType: 'alerts',
      filterValue: { hasAlerts: true },
      tooltip: { description: 'Alertas com status PENDING ou ACKNOWLEDGED, agrupados por severidade.', calculation: 'Soma de alertas não resolvidos, divididos em Crítico, Alto, Médio e Baixo.' },
    },
    {
      title: 'Tempo Médio de Resposta',
      value: metrics.averageResponseTimeMinutes
        ? formatMinutes(metrics.averageResponseTimeMinutes)
        : 'N/A',
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      clickable: false,
      tooltip: { description: 'Tempo médio entre a primeira mensagem INBOUND e a primeira intervenção.', calculation: 'Média da diferença (em minutos) entre createdAt da mensagem e createdAt da intervenção, últimos 90 dias.' },
    },
    {
      title: 'Mensagens Não Assumidas',
      value: metrics.unassumedMessagesCount,
      icon: MessageSquare,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      badge: metrics.unassumedMessagesCount > 0,
      clickable: true,
      filterType: 'messages',
      filterValue: { hasUnassumedMessages: true },
      tooltip: { description: 'Mensagens recebidas (INBOUND) não assumidas por nenhum profissional.', calculation: 'Contagem de mensagens com direction=INBOUND e assumedByUserId=null.' },
    },
    {
      title: 'Etapas Atrasadas',
      value: metrics.overdueStepsCount,
      icon: CalendarX,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      badge: metrics.overdueStepsCount > 0,
      clickable: true,
      filterType: 'overdueSteps',
      filterValue: { hasOverdueSteps: true },
      tooltip: { description: 'Etapas de navegação oncológica com prazo vencido.', calculation: 'Etapas com status OVERDUE, ou PENDING/IN_PROGRESS com dueDate < hoje.' },
    },
    {
      title: 'Time-to-Treatment',
      value:
        metrics.averageTimeToTreatmentDays !== null
          ? `${metrics.averageTimeToTreatmentDays} dias`
          : 'N/A',
      subtitle:
        metrics.averageTimeToTreatmentDays !== null &&
        metrics.averageTimeToTreatmentDays > 30
          ? 'Meta: <30 dias'
          : undefined,
      icon: Activity,
      color:
        metrics.averageTimeToTreatmentDays !== null &&
        metrics.averageTimeToTreatmentDays > 30
          ? 'text-red-600'
          : metrics.averageTimeToTreatmentDays !== null &&
              metrics.averageTimeToTreatmentDays > 20
            ? 'text-orange-600'
            : 'text-green-600',
      bgColor:
        metrics.averageTimeToTreatmentDays !== null &&
        metrics.averageTimeToTreatmentDays > 30
          ? 'bg-red-50'
          : metrics.averageTimeToTreatmentDays !== null &&
              metrics.averageTimeToTreatmentDays > 20
            ? 'bg-orange-50'
            : 'bg-green-50',
      borderColor:
        metrics.averageTimeToTreatmentDays !== null &&
        metrics.averageTimeToTreatmentDays > 30
          ? 'border-red-200'
          : metrics.averageTimeToTreatmentDays !== null &&
              metrics.averageTimeToTreatmentDays > 20
            ? 'border-orange-200'
            : 'border-green-200',
      badge:
        metrics.averageTimeToTreatmentDays !== null &&
        metrics.averageTimeToTreatmentDays > 30,
      clickable: false,
      tooltip: { description: 'Tempo médio entre o diagnóstico e o início do tratamento.', calculation: 'Média de dias entre a data do diagnóstico e a data de início do tratamento.' },
    },
    {
      title: 'Time-to-Diagnosis',
      value:
        metrics.averageTimeToDiagnosisDays !== null
          ? `${metrics.averageTimeToDiagnosisDays} dias`
          : 'N/A',
      subtitle:
        metrics.averageTimeToDiagnosisDays !== null &&
        metrics.averageTimeToDiagnosisDays > 60
          ? 'Meta: <60 dias'
          : undefined,
      icon: Stethoscope,
      color:
        metrics.averageTimeToDiagnosisDays !== null &&
        metrics.averageTimeToDiagnosisDays > 60
          ? 'text-red-600'
          : metrics.averageTimeToDiagnosisDays !== null &&
              metrics.averageTimeToDiagnosisDays > 45
            ? 'text-orange-600'
            : 'text-green-600',
      bgColor:
        metrics.averageTimeToDiagnosisDays !== null &&
        metrics.averageTimeToDiagnosisDays > 60
          ? 'bg-red-50'
          : metrics.averageTimeToDiagnosisDays !== null &&
              metrics.averageTimeToDiagnosisDays > 45
            ? 'bg-orange-50'
            : 'bg-green-50',
      borderColor:
        metrics.averageTimeToDiagnosisDays !== null &&
        metrics.averageTimeToDiagnosisDays > 60
          ? 'border-red-200'
          : metrics.averageTimeToDiagnosisDays !== null &&
              metrics.averageTimeToDiagnosisDays > 45
            ? 'border-orange-200'
            : 'border-green-200',
      badge:
        metrics.averageTimeToDiagnosisDays !== null &&
        metrics.averageTimeToDiagnosisDays > 60,
      clickable: false,
      tooltip: { description: 'Tempo médio entre a suspeita clínica e a confirmação diagnóstica.', calculation: 'Média de dias entre a data de suspeita e a data do diagnóstico confirmado.' },
    },
    {
      title: 'Biomarcadores Pendentes',
      value: metrics.pendingBiomarkersCount,
      subtitle: 'Aguardando resultados',
      icon: Dna,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      badge: metrics.pendingBiomarkersCount > 0,
      clickable: true,
      filterType: 'biomarkers',
      filterValue: { hasPendingBiomarkers: true },
      tooltip: { description: 'Pacientes com etapas de biomarcadores em status pendente.', calculation: 'Contagem de etapas PENDING/IN_PROGRESS com stepKey de biomarcadores.' },
    },
    {
      title: 'Taxa de Adesão',
      value: `${metrics.treatmentAdherencePercentage}%`,
      subtitle: 'Tratamento conforme planejado',
      icon: CheckCircle2,
      color:
        metrics.treatmentAdherencePercentage >= 80
          ? 'text-green-600'
          : metrics.treatmentAdherencePercentage >= 60
            ? 'text-orange-600'
            : 'text-red-600',
      bgColor:
        metrics.treatmentAdherencePercentage >= 80
          ? 'bg-green-50'
          : metrics.treatmentAdherencePercentage >= 60
            ? 'bg-orange-50'
            : 'bg-red-50',
      borderColor:
        metrics.treatmentAdherencePercentage >= 80
          ? 'border-green-200'
          : metrics.treatmentAdherencePercentage >= 60
            ? 'border-orange-200'
            : 'border-red-200',
      badge: metrics.treatmentAdherencePercentage < 60,
      clickable: false,
      tooltip: { description: 'Percentual de pacientes cujo tratamento está conforme planejado.', calculation: 'Pacientes com etapas de tratamento COMPLETED / total × 100.' },
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            onClick={() => {
              if (card.clickable && onCardClick) {
                onCardClick(card.filterType!, card.filterValue, card.title);
              }
            }}
            className={cn(
              'bg-white rounded-lg border p-4 relative',
              card.borderColor,
              card.clickable &&
                'cursor-pointer hover:shadow-md transition-shadow'
            )}
          >
            {card.badge && (
              <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
            <div className="flex items-start justify-between mb-2">
              <div className={cn('p-2 rounded-md', card.bgColor)}>
                <Icon className={cn('h-5 w-5', card.color)} />
              </div>
            </div>
            <div className="mt-2">
              <span className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                {card.title}
                {card.tooltip && (
                  <MetricInfoTooltip title={card.title} description={card.tooltip.description} calculation={card.tooltip.calculation} />
                )}
              </span>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              {card.subtitle && (
                <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
              )}
              {card.breakdown && (
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Crítico:</span>
                    <span className="font-semibold text-red-600">
                      {card.breakdown.critical}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Alto:</span>
                    <span className="font-semibold text-orange-600">
                      {card.breakdown.high}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Médio:</span>
                    <span className="font-semibold text-yellow-600">
                      {card.breakdown.medium}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Baixo:</span>
                    <span className="font-semibold text-gray-600">
                      {card.breakdown.low}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
