'use client';

import { useState, useMemo } from 'react';
import { usePatients } from '@/hooks/usePatients';
import { PatientFilters } from './patient-filters';
import { PatientTable } from './patient-table';
import { Button } from '@/components/ui/button';
import { QueryErrorRetry } from '@/components/shared/query-error-retry';
import { Plus, Upload } from 'lucide-react';
import { PatientImportDialog } from './patient-import-dialog';
import { PatientCreateDialog } from './patient-create-dialog';
import { Patient } from '@/lib/api/patients';

export function PatientListPage() {
  const {
    data: patients = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = usePatients();
  const [searchTerm, setSearchTerm] = useState('');
  const [cancerTypeFilter, setCancerTypeFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [navigationStageFilter, setNavigationStageFilter] = useState('all');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filteredPatients = useMemo(() => {
    if (!patients) return [];

    return patients.filter((patient: Patient) => {
      // Busca por nome ou CPF
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = patient.name.toLowerCase().includes(searchLower);
        const matchesCpf = patient.cpf?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesCpf) return false;
      }

      // Filtro por tipo de câncer
      if (
        cancerTypeFilter !== 'all' &&
        patient.cancerType !== cancerTypeFilter
      ) {
        return false;
      }

      // Filtro por estágio
      if (stageFilter !== 'all' && patient.stage) {
        const stageMatch = patient.stage.includes(stageFilter);
        if (!stageMatch) return false;
      }

      // Filtro por prioridade
      if (
        priorityFilter !== 'all' &&
        patient.priorityCategory !== priorityFilter
      ) {
        return false;
      }

      // Filtro por estágio de navegação
      if (
        navigationStageFilter !== 'all' &&
        patient.currentStage !== navigationStageFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    patients,
    searchTerm,
    cancerTypeFilter,
    stageFilter,
    priorityFilter,
    navigationStageFilter,
  ]);

  if (error) {
    return (
      <div className="p-6 max-w-lg">
        <QueryErrorRetry
          title="Não foi possível carregar os pacientes"
          onRetry={refetch}
          isFetching={isFetching}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pacientes</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie e monitore pacientes oncológicos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Paciente
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <PatientFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        cancerTypeFilter={cancerTypeFilter}
        onCancerTypeChange={setCancerTypeFilter}
        stageFilter={stageFilter}
        onStageChange={setStageFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        navigationStageFilter={navigationStageFilter}
        onNavigationStageChange={setNavigationStageFilter}
      />

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando pacientes...
        </div>
      ) : (
        <div>
          <div className="mb-4 text-sm text-muted-foreground">
            {filteredPatients.length} paciente(s) encontrado(s)
          </div>
          <PatientTable patients={filteredPatients} />
        </div>
      )}

      {/* Dialogs */}
      <PatientImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />
      <PatientCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
