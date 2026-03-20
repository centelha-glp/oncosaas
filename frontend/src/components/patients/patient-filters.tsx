'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';
import { JOURNEY_STAGE_LABELS } from '@/lib/utils/journey-stage';
import { useEnabledCancerTypes } from '@/hooks/useEnabledCancerTypes';

interface PatientFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  cancerTypeFilter: string;
  onCancerTypeChange: (value: string) => void;
  stageFilter: string;
  onStageChange: (value: string) => void;
  priorityFilter: string;
  onPriorityChange: (value: string) => void;
  navigationStageFilter: string;
  onNavigationStageChange: (value: string) => void;
}

export function PatientFilters({
  searchTerm,
  onSearchChange,
  cancerTypeFilter,
  onCancerTypeChange,
  stageFilter,
  onStageChange,
  priorityFilter,
  onPriorityChange,
  navigationStageFilter,
  onNavigationStageChange,
}: PatientFiltersProps) {
  const { labels: enabledLabels } = useEnabledCancerTypes();

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Select value={cancerTypeFilter} onValueChange={onCancerTypeChange}>
          <SelectTrigger>
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Tipo de câncer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(enabledLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={onStageChange}>
          <SelectTrigger>
            <SelectValue placeholder="Estágio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estágios</SelectItem>
            <SelectItem value="I">Estágio I</SelectItem>
            <SelectItem value="II">Estágio II</SelectItem>
            <SelectItem value="III">Estágio III</SelectItem>
            <SelectItem value="IV">Estágio IV</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={onPriorityChange}>
          <SelectTrigger>
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            <SelectItem value="CRITICAL">Crítica</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="MEDIUM">Média</SelectItem>
            <SelectItem value="LOW">Baixa</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={navigationStageFilter}
          onValueChange={onNavigationStageChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status de navegação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="SCREENING">{JOURNEY_STAGE_LABELS['SCREENING']}</SelectItem>
            <SelectItem value="DIAGNOSIS">{JOURNEY_STAGE_LABELS['DIAGNOSIS']}</SelectItem>
            <SelectItem value="TREATMENT">{JOURNEY_STAGE_LABELS['TREATMENT']}</SelectItem>
            <SelectItem value="FOLLOW_UP">{JOURNEY_STAGE_LABELS['FOLLOW_UP']}</SelectItem>
            <SelectItem value="PALLIATIVE">{JOURNEY_STAGE_LABELS['PALLIATIVE']}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
