'use client';

import { useState, useMemo, useEffect } from 'react';
import { Patient } from '@/lib/api/patients';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Filter, X, Calendar, Pill, AlertCircle } from 'lucide-react';
import { ScoreBreakdownTooltip } from './score-breakdown-tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PatientListEnhancedProps {
  patients: Patient[];
  onPatientClick: (patientId: string) => void;
  isLoading?: boolean;
  externalFilters?: {
    priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
    minScore?: number;
    hasAlerts?: boolean;
    hasOverdueSteps?: boolean;
    cancerType?: string;
    journeyStage?: string;
  };
}

type PriorityFilter = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
type CancerTypeFilter = string | null;
type JourneyStageFilter = string | null;
type StatusFilter = string | null;

export function PatientListEnhanced({
  patients,
  onPatientClick,
  isLoading,
  externalFilters,
}: PatientListEnhancedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(
    externalFilters?.priority || null
  );
  const [cancerTypeFilter, setCancerTypeFilter] = useState<CancerTypeFilter>(
    externalFilters?.cancerType || null
  );
  const [journeyStageFilter, setJourneyStageFilter] =
    useState<JourneyStageFilter>(externalFilters?.journeyStage || null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [hasAlertsFilter, setHasAlertsFilter] = useState(
    externalFilters?.hasAlerts || false
  );
  const [hasOverdueStepsFilter, setHasOverdueStepsFilter] = useState(
    externalFilters?.hasOverdueSteps || false
  );
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20); // Mostrar 20 pacientes por vez

  // Atualizar filtros quando externalFilters mudar
  useEffect(() => {
    if (externalFilters) {
      if (externalFilters.priority) setPriorityFilter(externalFilters.priority);
      if (externalFilters.hasAlerts) setHasAlertsFilter(true);
      if (externalFilters.hasOverdueSteps) setHasOverdueStepsFilter(true);
      if (externalFilters.cancerType)
        setCancerTypeFilter(externalFilters.cancerType);
      if (externalFilters.journeyStage)
        setJourneyStageFilter(externalFilters.journeyStage);
    }
  }, [externalFilters]);

  // Obter valores únicos para filtros
  const uniqueCancerTypes = useMemo(() => {
    const types = new Set(
      patients.map((p) => p.cancerType).filter((t): t is string => !!t)
    );
    return Array.from(types).sort();
  }, [patients]);

  const uniqueJourneyStages = useMemo(() => {
    const stages = new Set(patients.map((p) => p.currentStage));
    return Array.from(stages).sort();
  }, [patients]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(patients.map((p) => p.status));
    return Array.from(statuses).sort();
  }, [patients]);

  // Filtrar pacientes
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      // Busca por nome ou CPF
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = patient.name.toLowerCase().includes(query);
        const matchesCpf = patient.cpf?.toLowerCase().includes(query) || false;
        if (!matchesName && !matchesCpf) return false;
      }

      // Filtro de prioridade
      if (
        priorityFilter &&
        (patient.priorityCategory || 'MEDIUM') !== priorityFilter
      ) {
        return false;
      }

      // Filtro de score mínimo (para pacientes críticos)
      if (
        externalFilters?.minScore !== undefined &&
        (patient.priorityScore || 0) < externalFilters.minScore
      ) {
        return false;
      }

      // Filtro de tipo de câncer
      if (cancerTypeFilter && patient.cancerType !== cancerTypeFilter) {
        return false;
      }

      // Filtro de estágio da jornada
      if (journeyStageFilter && patient.currentStage !== journeyStageFilter) {
        return false;
      }

      // Filtro de status
      if (statusFilter && patient.status !== statusFilter) {
        return false;
      }

      // Filtro de alertas
      if (hasAlertsFilter && (patient.pendingAlertsCount ?? patient._count?.alerts ?? 0) === 0) {
        return false;
      }

      // Filtro de etapas atrasadas (por enquanto, apenas verifica se tem alertas de navegação)
      // TODO: Adicionar informação de etapas atrasadas ao tipo Patient
      if (hasOverdueStepsFilter) {
        // Por enquanto, verificamos se tem alertas de navegação
        // Isso será melhorado quando tivermos dados de etapas diretamente no paciente
        const hasNavigationAlerts = (patient.pendingAlertsCount ?? patient._count?.alerts ?? 0) > 0;
        if (!hasNavigationAlerts) {
          return false;
        }
      }

      return true;
    });
  }, [
    patients,
    searchQuery,
    priorityFilter,
    cancerTypeFilter,
    journeyStageFilter,
    statusFilter,
    hasAlertsFilter,
    hasOverdueStepsFilter,
    externalFilters,
  ]);

  const getPriorityColor = (category: string | null | undefined) => {
    const cat = category || 'MEDIUM';
    switch (cat) {
      case 'CRITICAL':
        return 'border-l-red-500 bg-red-50';
      case 'HIGH':
        return 'border-l-orange-500 bg-orange-50';
      case 'MEDIUM':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'LOW':
        return 'border-l-green-500 bg-green-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getPriorityIcon = (category: string | null | undefined) => {
    const cat = category || 'MEDIUM';
    switch (cat) {
      case 'CRITICAL':
        return '🔴';
      case 'HIGH':
        return '🟠';
      case 'MEDIUM':
        return '🟡';
      case 'LOW':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setPriorityFilter(null);
    setCancerTypeFilter(null);
    setJourneyStageFilter(null);
    setStatusFilter(null);
    setHasAlertsFilter(false);
  };

  const activeFiltersCount =
    (priorityFilter ? 1 : 0) +
    (cancerTypeFilter ? 1 : 0) +
    (journeyStageFilter ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (hasAlertsFilter ? 1 : 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg border bg-gray-100 animate-pulse"
          >
            <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de busca e filtros */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        {/* Painel de filtros */}
        {showFilters && (
          <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm">Filtros</h4>
              <div className="flex gap-2">
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs"
                  >
                    Limpar ({activeFiltersCount})
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Filtro de Prioridade */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Prioridade
                </label>
                <select
                  value={priorityFilter || ''}
                  onChange={(e) =>
                    setPriorityFilter(
                      e.target.value ? (e.target.value as PriorityFilter) : null
                    )
                  }
                  className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Todas</option>
                  <option value="CRITICAL">Crítico</option>
                  <option value="HIGH">Alto</option>
                  <option value="MEDIUM">Médio</option>
                  <option value="LOW">Baixo</option>
                </select>
              </div>

              {/* Filtro de Tipo de Câncer */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Tipo de Câncer
                </label>
                <select
                  value={cancerTypeFilter || ''}
                  onChange={(e) => setCancerTypeFilter(e.target.value || null)}
                  className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Todos</option>
                  {uniqueCancerTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro de Estágio da Jornada */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Estágio da Jornada
                </label>
                <select
                  value={journeyStageFilter || ''}
                  onChange={(e) =>
                    setJourneyStageFilter(e.target.value || null)
                  }
                  className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Todos</option>
                  {uniqueJourneyStages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro de Status */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Status
                </label>
                <select
                  value={statusFilter || ''}
                  onChange={(e) => setStatusFilter(e.target.value || null)}
                  className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Todos</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro de Alertas */}
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAlertsFilter}
                    onChange={(e) => setHasAlertsFilter(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    Apenas com alertas
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Contador de resultados */}
        <div className="text-sm text-gray-600">
          Mostrando {Math.min(visibleCount, filteredPatients.length)} de{' '}
          {filteredPatients.length} pacientes
          {filteredPatients.length < patients.length &&
            ` (${patients.length} total)`}
        </div>
      </div>

      {/* Lista de pacientes */}
      <div className="space-y-3">
        {filteredPatients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum paciente encontrado com os filtros aplicados
          </div>
        ) : (
          <>
            {filteredPatients.slice(0, visibleCount).map((patient) => (
              <div
                key={patient.id}
                className={cn(
                  'p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden',
                  getPriorityColor(patient.priorityCategory)
                )}
                onClick={() => onPatientClick(patient.id)}
              >
                <div className="flex flex-col gap-3">
                  {/* Header com nome e informações básicas */}
                  <div className="flex items-start gap-2">
                    <span className="text-xl flex-shrink-0">
                      {getPriorityIcon(patient.priorityCategory)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        {patient.name}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {patient.cancerType || 'Não informado'} -{' '}
                        {patient.stage || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Informações expandidas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Última consulta:{' '}
                        {patient.journey?.lastFollowUpDate
                          ? formatDistanceToNow(
                              new Date(patient.journey.lastFollowUpDate),
                              { addSuffix: true, locale: ptBR }
                            )
                          : 'N/A'}
                      </span>
                    </div>
                    {patient.journey?.nextFollowUpDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span>
                          Próxima consulta:{' '}
                          {formatDistanceToNow(
                            new Date(patient.journey.nextFollowUpDate),
                            { addSuffix: true, locale: ptBR }
                          )}
                        </span>
                      </div>
                    )}
                    {patient.journey?.currentCycle &&
                      patient.journey?.totalCycles && (
                        <div className="flex items-center gap-2">
                          <Pill className="h-4 w-4" />
                          <span>
                            Ciclo {patient.journey.currentCycle}/
                            {patient.journey.totalCycles}
                          </span>
                        </div>
                      )}
                    {patient.priorityReason && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5" />
                        <span className="text-xs">
                          {patient.priorityReason}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Informações de score e alertas */}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-1">
                      <span>
                        Score: {patient.priorityScore}/100 (
                        {patient.priorityCategory?.toUpperCase() || 'N/A'})
                      </span>
                      <ScoreBreakdownTooltip patient={patient} />
                    </div>
                    {patient.lastInteraction && (
                      <span className="hidden sm:inline">
                        Última interação:{' '}
                        {formatDistanceToNow(
                          new Date(patient.lastInteraction),
                          { addSuffix: true, locale: ptBR }
                        )}
                      </span>
                    )}
                    {(patient.pendingAlertsCount ?? patient._count?.alerts ?? 0) > 0 && (
                      <span className="text-red-600 font-semibold">
                        {patient.pendingAlertsCount ?? patient._count?.alerts} alerta(s)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Botão "Carregar Mais" */}
            {filteredPatients.length > visibleCount && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    setVisibleCount((prev) =>
                      Math.min(prev + 20, filteredPatients.length)
                    )
                  }
                >
                  Carregar mais ({filteredPatients.length - visibleCount}{' '}
                  restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
