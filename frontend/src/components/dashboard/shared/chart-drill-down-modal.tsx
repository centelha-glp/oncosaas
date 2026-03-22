'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { patientsApi, Patient } from '@/lib/api/patients';
import { dashboardApi, PendingAlert } from '@/lib/api/dashboard';
import { Search, Download, Loader2, CalendarX } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DrillDownFilterType =
  | 'priority'
  | 'cancerType'
  | 'journeyStage'
  | 'alerts'
  | 'messages'
  | 'overdueSteps'
  | 'biomarkers'
  | null;

interface ChartDrillDownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterType: DrillDownFilterType;
  filterValue: string | null;
  title: string;
  description?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  LOW: 'bg-green-100 text-green-800 border-green-300',
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Crítico',
  HIGH: 'Alto',
  MEDIUM: 'Médio',
  LOW: 'Baixo',
};

const JOURNEY_STAGE_LABELS: Record<string, string> = {
  SCREENING: 'Rastreio',
  DIAGNOSIS: 'Diagnóstico',
  TREATMENT: 'Tratamento',
  FOLLOW_UP: 'Seguimento',
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  CRITICAL_SYMPTOM: 'Sintoma crítico',
  NO_RESPONSE: 'Sem resposta',
  DELAYED_APPOINTMENT: 'Atraso em consulta/exame',
  SCORE_CHANGE: 'Mudança no score',
  SYMPTOM_WORSENING: 'Piora de sintomas',
  NAVIGATION_DELAY: 'Atraso na navegação',
  MISSING_EXAM: 'Exame não realizado',
  STAGING_INCOMPLETE: 'Estadiamento incompleto',
  TREATMENT_DELAY: 'Atraso no tratamento',
  FOLLOW_UP_OVERDUE: 'Seguimento atrasado',
  PALLIATIVE_SYMPTOM_WORSENING: 'Piora (paliativo)',
  PALLIATIVE_MEDICATION_ADJUSTMENT: 'Ajuste de medicação (paliativo)',
  PALLIATIVE_FAMILY_SUPPORT: 'Suporte familiar (paliativo)',
  PALLIATIVE_PSYCHOSOCIAL: 'Avaliação psicossocial (paliativo)',
  QUESTIONNAIRE_ALERT: 'Questionário (score alto)',
};

export function ChartDrillDownModal({
  open,
  onOpenChange,
  filterType,
  filterValue,
  title,
  description,
}: ChartDrillDownModalProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const isOverdueSteps = filterType === 'overdueSteps';
  const isAlertsFilter = filterType === 'alerts';
  const isIndicatorFilter =
    filterType === 'alerts' ||
    filterType === 'messages' ||
    filterType === 'biomarkers';

  // Buscar pacientes com etapas críticas (só quando indicador "Etapas Atrasadas") — apenas atrasadas
  const { data: criticalStepsPatients, isLoading: isLoadingCriticalSteps } =
    useQuery({
      queryKey: ['dashboard', 'patients-with-critical-steps', 'overdueOnly'],
      queryFn: () =>
        dashboardApi.getPatientsWithCriticalSteps({
          maxResults: 100,
          overdueOnly: true,
        }),
      enabled: open && isOverdueSteps,
    });

  // Buscar alertas pendentes (drill-down "Alertas Pendentes") — lista de alertas, não de pacientes
  const {
    data: pendingAlertsRaw,
    isLoading: isLoadingAlerts,
    error: alertsError,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['dashboard', 'pending-alerts'],
    queryFn: () => dashboardApi.getPendingAlerts(100),
    enabled: open && isAlertsFilter,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  // Computed inside useMemo below to avoid a new [] reference on every render.

  // Buscar pacientes por indicador (mensagens não assumidas, biomarcadores pendentes)
  const {
    data: indicatorPatientsRaw,
    isLoading: isLoadingIndicator,
    error: indicatorError,
    refetch: refetchIndicator,
  } = useQuery({
    queryKey: ['dashboard', 'patients-by-indicator', filterType],
    queryFn: () =>
      dashboardApi.getPatientsByIndicator(
        filterType as 'messages' | 'biomarkers',
        100
      ),
    enabled: open && (filterType === 'messages' || filterType === 'biomarkers'),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  // Computed inside useMemo below to avoid a new [] reference on every render.

  // Buscar todos os pacientes (para priority, cancerType, journeyStage)
  const { data: allPatients, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', 'drill-down'],
    queryFn: () => patientsApi.getAll(),
    enabled: open && !isOverdueSteps && !isIndicatorFilter,
  });

  const isLoading = isOverdueSteps
    ? isLoadingCriticalSteps
    : isAlertsFilter
      ? isLoadingAlerts
      : isIndicatorFilter
        ? isLoadingIndicator
        : isLoadingPatients;

  // Lista de alertas filtrada por nome do paciente ou mensagem
  const pendingAlertsFiltered = React.useMemo(() => {
    const pendingAlerts: PendingAlert[] = Array.isArray(pendingAlertsRaw) ? pendingAlertsRaw : [];
    if (!pendingAlerts.length) return [];
    if (!searchTerm.trim()) return pendingAlerts;
    const term = searchTerm.toLowerCase().trim();
    return pendingAlerts.filter(
      (a) =>
        a.patient.name.toLowerCase().includes(term) ||
        a.message.toLowerCase().includes(term)
    );
  }, [pendingAlertsRaw, searchTerm]);

  // Lista de pacientes filtrada por indicador (mensagens/biomarcadores) + busca por nome
  const indicatorPatientsFiltered = React.useMemo(() => {
    const indicatorPatients = Array.isArray(indicatorPatientsRaw) ? indicatorPatientsRaw : [];
    if (!indicatorPatients.length) return [];
    if (!searchTerm.trim()) return indicatorPatients;
    const term = searchTerm.toLowerCase().trim();
    return indicatorPatients.filter((p) => p.name.toLowerCase().includes(term));
  }, [indicatorPatientsRaw, searchTerm]);

  // Filtrar pacientes baseado no tipo de filtro (apenas para priority, cancerType, journeyStage)
  const filteredPatients = useMemo(() => {
    if (isOverdueSteps || isIndicatorFilter || !allPatients) return [];

    let filtered = [...allPatients];

    if (filterType && filterValue) {
      switch (filterType) {
        case 'priority':
          filtered = filtered.filter((p) => p.priorityCategory === filterValue);
          break;
        case 'cancerType':
          filtered = filtered.filter((p) => p.cancerType === filterValue);
          break;
        case 'journeyStage':
          filtered = filtered.filter((p) => p.currentStage === filterValue);
          break;
        default:
          break;
      }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(term));
    }

    return filtered;
  }, [
    allPatients,
    filterType,
    filterValue,
    searchTerm,
    isOverdueSteps,
    isIndicatorFilter,
  ]);

  const displayTitle = typeof title === 'string' ? title : 'Pacientes';

  // Mostrar apenas pacientes com etapa realmente atrasada (dias de atraso > 0)
  const criticalStepsOverdueOnly =
    criticalStepsPatients?.filter(
      (p) =>
        p.criticalStep.daysOverdue != null && p.criticalStep.daysOverdue > 0
    ) ?? [];
  const criticalStepsFiltered = searchTerm
    ? criticalStepsOverdueOnly.filter((p) =>
        p.patientName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : criticalStepsOverdueOnly;
  const patientListToShow =
    isIndicatorFilter && !isAlertsFilter
      ? indicatorPatientsFiltered
      : filteredPatients;
  const listCount = isOverdueSteps
    ? criticalStepsFiltered.length
    : isAlertsFilter
      ? pendingAlertsFiltered.length
      : patientListToShow.length;

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    if (isOverdueSteps && criticalStepsPatients) {
      const headers = [
        'Paciente',
        'Etapa Crítica',
        'Dias de Atraso',
        'Estágio',
        'Prioridade',
      ];
      const rows = criticalStepsFiltered.map((p) => [
        p.patientName,
        p.criticalStep.stepName,
        p.criticalStep.daysOverdue ?? '-',
        p.currentStage,
        p.priorityCategory ?? '-',
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `etapas-atrasadas_${dateStr}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      return;
    }
    if (isAlertsFilter) {
      const headers = ['Paciente', 'Tipo', 'Severidade', 'Mensagem', 'Data'];
      const rows = pendingAlertsFiltered.map((a) => [
        a.patient.name,
        ALERT_TYPE_LABELS[a.type] ?? a.type,
        PRIORITY_LABELS[a.severity] ?? a.severity,
        a.message.replace(/"/g, '""'),
        new Date(a.createdAt).toLocaleString('pt-BR'),
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `alertas-pendentes_${dateStr}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      return;
    }
    const headers = [
      'Nome',
      'CPF',
      'Tipo de Câncer',
      'Estágio',
      'Prioridade',
      'Telefone',
    ];
    const rows = patientListToShow.map((p) => [
      p.name,
      p.cpf || '-',
      p.cancerType || '-',
      p.stage || '-',
      PRIORITY_LABELS[p.priorityCategory] || p.priorityCategory,
      p.phone,
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pacientes_${filterValue || 'todos'}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {displayTitle}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-gray-600">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogClose onClose={() => onOpenChange(false)} />

        {/* Barra de busca e ações */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={
                isAlertsFilter
                  ? 'Buscar por nome ou mensagem...'
                  : 'Buscar por nome...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-blue-500"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={listCount === 0}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Lista: Etapas Atrasadas ou Pacientes */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-medical-blue-500" />
            </div>
          ) : isAlertsFilter && alertsError ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-amber-700">
                Erro ao carregar os alertas. Tente novamente.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAlerts()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : (filterType === 'messages' || filterType === 'biomarkers') &&
            indicatorError ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-amber-700">
                Erro ao carregar a lista. Tente novamente.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchIndicator()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : isAlertsFilter ? (
            pendingAlertsFiltered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhum alerta encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingAlertsFiltered.map((alert) => (
                  <div
                    key={alert.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onOpenChange(false);
                      router.push(`/patients/${alert.patientId}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenChange(false);
                        router.push(`/patients/${alert.patientId}`);
                      }
                    }}
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge
                            className={cn(
                              'text-xs',
                              PRIORITY_COLORS[alert.severity] ||
                                'bg-gray-100 text-gray-800'
                            )}
                          >
                            {PRIORITY_LABELS[alert.severity] ?? alert.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                          </Badge>
                          <span className="text-sm font-medium text-gray-700">
                            {alert.patient.name}
                            {alert.patient.phone && (
                              <span className="text-gray-500 font-normal">
                                {' '}
                                · {alert.patient.phone}
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(alert.createdAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : isOverdueSteps ? (
            criticalStepsFiltered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  Nenhum paciente com etapas atrasadas
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {criticalStepsFiltered.map((p) => (
                  <div
                    key={p.patientId}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onOpenChange(false);
                      router.push(`/patients/${p.patientId}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenChange(false);
                        router.push(`/patients/${p.patientId}`);
                      }
                    }}
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-gray-900">
                            {p.patientName}
                          </h4>
                          <Badge
                            className={cn(
                              'text-xs',
                              PRIORITY_COLORS[p.priorityCategory ?? ''] ||
                                'bg-gray-100 text-gray-800'
                            )}
                          >
                            {PRIORITY_LABELS[p.priorityCategory ?? ''] ??
                              p.priorityCategory}
                          </Badge>
                          {p.cancerType && (
                            <Badge variant="outline" className="text-xs">
                              {p.cancerType}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {JOURNEY_STAGE_LABELS[p.currentStage] ??
                              p.currentStage}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <CalendarX className="h-4 w-4 text-red-500 shrink-0" />
                            <span className="font-medium">
                              {p.criticalStep.stepName}
                            </span>
                            {p.criticalStep.daysOverdue != null && (
                              <span className="text-red-600 font-semibold">
                                {p.criticalStep.daysOverdue} dia
                                {p.criticalStep.daysOverdue !== 1 ? 's' : ''} de
                                atraso
                              </span>
                            )}
                          </div>
                          {p.criticalStep.stepDescription && (
                            <p className="text-gray-500 text-xs">
                              {p.criticalStep.stepDescription}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        Progresso: {p.completedSteps}/{p.totalSteps} (
                        {p.completionRate}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : patientListToShow.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhum paciente encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {patientListToShow.map((patient) => (
                <div
                  key={patient.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onOpenChange(false);
                    router.push(`/patients/${patient.id}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenChange(false);
                      router.push(`/patients/${patient.id}`);
                    }
                  }}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {patient.name}
                        </h4>
                        <Badge
                          className={cn(
                            'text-xs',
                            PRIORITY_COLORS[patient.priorityCategory] ||
                              'bg-gray-100 text-gray-800'
                          )}
                        >
                          {PRIORITY_LABELS[patient.priorityCategory] ||
                            patient.priorityCategory}
                        </Badge>
                        {patient.cancerType && (
                          <Badge variant="outline" className="text-xs">
                            {patient.cancerType}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {JOURNEY_STAGE_LABELS[patient.currentStage] ||
                            patient.currentStage}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                        {patient.cpf && (
                          <div>
                            <span className="font-medium">CPF:</span>{' '}
                            {patient.cpf}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Telefone:</span>{' '}
                          {patient.phone}
                        </div>
                        {patient.stage && (
                          <div>
                            <span className="font-medium">Estágio:</span>{' '}
                            {patient.stage}
                          </div>
                        )}
                        {patient.diagnosisDate && (
                          <div>
                            <span className="font-medium">Diagnóstico:</span>{' '}
                            {new Date(patient.diagnosisDate).toLocaleDateString(
                              'pt-BR'
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        Score: {patient.priorityScore}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé com contagem */}
        <div className="pt-4 border-t flex items-center justify-between text-sm text-gray-600">
          <span>
            {listCount}{' '}
            {isAlertsFilter
              ? `alerta${listCount !== 1 ? 's' : ''} encontrado${listCount !== 1 ? 's' : ''}`
              : `paciente${listCount !== 1 ? 's' : ''} encontrado${listCount !== 1 ? 's' : ''}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
