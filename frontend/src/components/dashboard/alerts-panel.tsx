'use client';

import { useAlerts } from '@/hooks/useAlerts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bell,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAcknowledgeAlert, useResolveAlert } from '@/hooks/useAlerts';
import { Alert } from '@/lib/api/alerts';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface AlertsPanelProps {
  onAlertSelect?: (alert: Alert) => void;
  selectedAlertId?: string | null;
  severityFilter?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
}

export function AlertsPanel({
  onAlertSelect,
  selectedAlertId,
  severityFilter,
}: AlertsPanelProps) {
  const { data: alerts, isLoading, error } = useAlerts('PENDING');
  const acknowledgeAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg border border-gray-200 bg-white"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-3 mt-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex gap-2 pt-2 mt-2 border-t">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-12 w-12 text-red-500" />}
        title="Erro ao carregar alertas"
        description={`Não foi possível carregar a lista de alertas. ${error.message}`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  // Filtrar por severidade se especificado
  const filteredAlerts = severityFilter
    ? alerts.filter((alert) => alert.severity === severityFilter)
    : alerts;

  if (!alerts || alerts.length === 0) {
    return (
      <EmptyState
        icon={<Bell className="h-12 w-12 text-green-500" />}
        title="Nenhum alerta pendente"
        description="Ótimo! Não há alertas pendentes no momento. Todos os pacientes estão sendo monitorados adequadamente."
      />
    );
  }

  if (filteredAlerts.length === 0 && severityFilter) {
    const severityLabel =
      severityFilter === 'CRITICAL'
        ? 'crítico'
        : severityFilter === 'HIGH'
          ? 'de alta prioridade'
          : severityFilter === 'MEDIUM'
            ? 'de média prioridade'
            : 'de baixa prioridade';

    return (
      <EmptyState
        icon={<Filter className="h-12 w-12 text-gray-400" />}
        title={`Nenhum alerta ${severityLabel} pendente`}
        description={`Não há alertas ${severityLabel} no momento. Tente ajustar o filtro para ver outros tipos de alertas.`}
      />
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'border-l-red-500 bg-red-50';
      case 'HIGH':
        return 'border-l-orange-500 bg-orange-50';
      case 'MEDIUM':
        return 'border-l-yellow-500 bg-yellow-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'HIGH':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-700 border border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 border border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-300';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'Crítico';
      case 'HIGH':
        return 'Alto';
      case 'MEDIUM':
        return 'Médio';
      default:
        return 'Baixo';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          Alertas Pendentes
        </h2>
        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 border border-red-300 rounded-full font-semibold">
          {filteredAlerts.length}
        </span>
      </div>
      {filteredAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`px-3 py-2.5 rounded-lg border-l-4 ${getSeverityColor(
            alert.severity
          )} relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${
            selectedAlertId === alert.id ? 'ring-2 ring-indigo-500' : ''
          }`}
          onClick={() => onAlertSelect?.(alert)}
        >
          <div className="flex items-start gap-2.5">
            <div className="flex-shrink-0 mt-0.5">
              {getSeverityIcon(alert.severity)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <h3 className="font-semibold text-sm truncate">
                  {alert.patient?.name || 'Paciente'}
                </h3>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${getSeverityBadgeClass(alert.severity)}`}
                >
                  {getSeverityLabel(alert.severity)}
                </span>
              </div>
              <p className="text-xs text-gray-700 mb-1.5 break-words line-clamp-2">
                {alert.message}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                <span>
                  {formatDistanceToNow(new Date(alert.createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
                {alert.type && <span>{getAlertTypeLabel(alert.type)}</span>}
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                acknowledgeAlert.mutate(alert.id);
              }}
              disabled={acknowledgeAlert.isPending}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Reconhecer
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                resolveAlert.mutate(alert.id);
              }}
              disabled={resolveAlert.isPending}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Resolver
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
