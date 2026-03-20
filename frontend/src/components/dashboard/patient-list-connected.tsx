'use client';

import { usePatients } from '@/hooks/usePatients';
import { PatientList } from './patient-list';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { sortPatientsByPriority } from '@/lib/utils/patient-sorting';
import { filterPatients, PatientFilters } from '@/lib/utils/patient-filtering';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Users, Search, Filter, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mapPriorityToDisplay } from '@/lib/utils/priority';
import { getPatientCancerType } from '@/lib/utils/patient-cancer-type';

interface PatientListConnectedProps {
  onPatientSelect?: (patientId: string) => void;
  searchTerm?: string; // Mantido para compatibilidade
  filters?: PatientFilters; // Novo: filtros completos
  selectedPatientId?: string | null; // ID do paciente selecionado para highlight
  onClearFilters?: () => void; // Callback para limpar filtros
  hideActionButtons?: boolean; // Esconder botões "Ver Conversa" e "Assumir"
}

export function PatientListConnected({
  onPatientSelect,
  searchTerm = '',
  filters,
  selectedPatientId,
  onClearFilters,
  hideActionButtons = false,
}: PatientListConnectedProps) {
  const router = useRouter();
  const { data: patients, isLoading, error } = usePatients();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg border border-gray-200 bg-white"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-48" />
                <div className="flex items-center gap-3 mt-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
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
        icon={<AlertCircle className="h-12 w-12 text-red-500" />}
        title="Erro ao carregar pacientes"
        description={`Não foi possível carregar a lista de pacientes. ${error.message}`}
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

  if (!patients || patients.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12 text-gray-400" />}
        title="Nenhum paciente encontrado"
        description="Não há pacientes cadastrados no sistema ainda. Os pacientes serão exibidos aqui quando começarem a interagir via WhatsApp."
      />
    );
  }

  // Preparar filtros: usar filters se fornecido, senão usar searchTerm para compatibilidade
  const activeFilters: PatientFilters = filters || {
    searchTerm: searchTerm || undefined,
  };

  // Filtrar pacientes usando a função completa de filtros
  const filteredPatients = filterPatients(patients, activeFilters);

  // Contar quantos filtros estão ativos
  const activeFiltersCount =
    (activeFilters.searchTerm ? 1 : 0) +
    (activeFilters.priorityCategory ? 1 : 0) +
    (activeFilters.cancerType ? 1 : 0) +
    (activeFilters.unreadOnly ? 1 : 0);

  // Se após filtrar não houver resultados, mostrar mensagem
  if (filteredPatients.length === 0) {
    const hasAnyFilter = activeFiltersCount > 0;

    return (
      <EmptyState
        icon={
          hasAnyFilter ? (
            <Filter className="h-12 w-12 text-gray-400" />
          ) : (
            <Search className="h-12 w-12 text-gray-400" />
          )
        }
        title={
          hasAnyFilter
            ? 'Nenhum paciente encontrado com os filtros aplicados'
            : 'Nenhum paciente encontrado'
        }
        description={
          hasAnyFilter
            ? 'Tente ajustar os filtros ou limpar todos os filtros para ver todos os pacientes.'
            : 'Não há pacientes que correspondam à sua busca. Tente usar termos diferentes.'
        }
        action={
          hasAnyFilter && onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          ) : null
        }
      />
    );
  }

  // Ordenar pacientes por prioridade (CRITICAL > HIGH > MEDIUM > LOW)
  // A ordenação é aplicada após o filtro para manter casos críticos no topo mesmo após buscar
  const sortedPatients = sortPatientsByPriority(filteredPatients);

  // Transformar dados da API para o formato esperado pelo componente
  const transformedPatients = sortedPatients.map((patient) => ({
    id: patient.id,
    name: patient.name,
    cancerType: getPatientCancerType(patient) ?? '',
    stage: patient.stage ?? '',
    priorityScore: patient.priorityScore,
    priorityCategory: mapPriorityToDisplay(
      patient.priorityCategory || 'MEDIUM'
    ),
    lastInteraction: patient.lastInteraction
      ? formatDistanceToNow(new Date(patient.lastInteraction), {
          addSuffix: true,
          locale: ptBR,
        })
      : undefined,
    alertCount: patient.pendingAlertsCount ?? patient._count?.alerts ?? 0,
  }));

  const handlePatientClick = (patientId: string) => {
    if (onPatientSelect) {
      onPatientSelect(patientId);
    } else {
      router.push(`/chat?patient=${patientId}`);
    }
  };

  return (
    <div className="space-y-3">
      {/* Contador de resultados quando filtros aplicados */}
      {activeFiltersCount > 0 && (
        <div className="px-2 py-1.5 bg-indigo-50 border border-indigo-200 rounded-md text-sm text-indigo-700">
          <span className="font-semibold">{filteredPatients.length}</span>{' '}
          {filteredPatients.length === 1
            ? 'paciente encontrado'
            : 'pacientes encontrados'}
          {activeFiltersCount > 0 && (
            <span className="text-indigo-600 ml-1">
              ({activeFiltersCount}{' '}
              {activeFiltersCount === 1 ? 'filtro' : 'filtros'} aplicado
              {activeFiltersCount > 1 ? 's' : ''})
            </span>
          )}
        </div>
      )}

      <PatientList
        patients={transformedPatients}
        onPatientClick={handlePatientClick}
        onTakeOver={(patientId) => {
          // TODO: Implementar lógica de assumir conversa
          // Por enquanto, apenas redireciona para a conversa
          handlePatientClick(patientId);
        }}
        selectedPatientId={selectedPatientId}
        hideActionButtons={hideActionButtons}
      />
    </div>
  );
}
