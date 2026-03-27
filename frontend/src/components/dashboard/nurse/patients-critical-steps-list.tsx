'use client';

import { useState } from 'react';
import { usePatientsCriticalSteps } from '@/hooks/usePatientsCriticalSteps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  User,
  Filter,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PatientWithCriticalStep } from '@/lib/api/patients-critical-steps';

const JOURNEY_STAGE_LABELS: Record<string, string> = {
  SCREENING: 'Rastreio',
  DIAGNOSIS: 'Diagnóstico',
  TREATMENT: 'Tratamento',
  FOLLOW_UP: 'Seguimento',
  PALLIATIVE: 'Cuidados paliativos',
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 border-red-300 text-red-800',
  HIGH: 'bg-orange-100 border-orange-300 text-orange-800',
  MEDIUM: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  LOW: 'bg-blue-100 border-blue-300 text-blue-800',
};

interface PatientsCriticalStepsListProps {
  onPatientSelect?: (patientId: string) => void;
  selectedPatientId?: string | null;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
  hideButtons?: boolean;
}

export function PatientsCriticalStepsList({
  onPatientSelect,
  selectedPatientId,
  onMinimize,
  onMaximize,
  isMaximized = false,
  hideButtons = false,
}: PatientsCriticalStepsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [journeyStageFilter, setJourneyStageFilter] = useState<string>('all');
  const [cancerTypeFilter, setCancerTypeFilter] = useState<string>('all');

  const filters = {
    journeyStage: journeyStageFilter !== 'all' ? journeyStageFilter : undefined,
    cancerType: cancerTypeFilter !== 'all' ? cancerTypeFilter : undefined,
    maxResults: 50,
  };

  const {
    data: patients,
    isLoading,
    error,
  } = usePatientsCriticalSteps(filters);

  // Filtrar por termo de busca
  const filteredPatients = patients?.filter((patient) =>
    patient.patientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUrgencyBadge = (patient: PatientWithCriticalStep) => {
    const daysOverdue = patient.criticalStep.daysOverdue;
    if (daysOverdue === null) {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700">
          <Clock className="h-3 w-3 mr-1" />
          Próximo do prazo
        </Badge>
      );
    }
    if (daysOverdue > 14) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {daysOverdue} dias atrasado
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {daysOverdue} dias atrasado
      </Badge>
    );
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-red-500">
            Erro ao carregar pacientes: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader
        className={`flex-shrink-0 relative pb-3 ${hideButtons ? '' : 'pr-20'}`}
      >
        <div className="flex items-center justify-between w-full gap-2">
          <CardTitle className="flex items-center gap-2 flex-1 min-w-0 text-lg">
            <User className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">Pacientes com Etapas Críticas</span>
          </CardTitle>
        </div>
        {!hideButtons && (
          <div className="absolute top-4 right-4 flex gap-1 z-10">
            {onMaximize && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onMaximize}
                className="h-8 w-8 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm"
                title={
                  isMaximized ? 'Restaurar tamanho' : 'Expandir para tela toda'
                }
              >
                {isMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            )}
            {onMinimize && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onMinimize}
                className="h-8 w-8 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm"
                title="Minimizar painéis para o fundo"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Filtros */}
        <div className="space-y-3 mb-4 flex-shrink-0 pb-2 border-b">
          <Input
            placeholder="Buscar paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={journeyStageFilter}
              onValueChange={setJourneyStageFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Fase da jornada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fases</SelectItem>
                {Object.entries(JOURNEY_STAGE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={cancerTypeFilter}
              onValueChange={setCancerTypeFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de câncer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {/* TODO: Buscar tipos de câncer únicos do backend */}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista de pacientes */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-2">
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </>
          ) : filteredPatients && filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => (
              <div
                key={patient.patientId}
                className={`p-4 border rounded-lg cursor-pointer hover:shadow-md transition-shadow ${
                  selectedPatientId === patient.patientId
                    ? 'ring-2 ring-indigo-500 ring-offset-2'
                    : ''
                } ${PRIORITY_COLORS[patient.priorityCategory] || 'bg-white'}`}
                onClick={() => onPatientSelect?.(patient.patientId)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {patient.patientName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{patient.patientAge} anos</Badge>
                      {patient.cancerType && (
                        <Badge variant="outline">{patient.cancerType}</Badge>
                      )}
                      <Badge variant="outline">
                        {JOURNEY_STAGE_LABELS[patient.currentStage] ||
                          patient.currentStage}
                      </Badge>
                    </div>
                  </div>
                  {getUrgencyBadge(patient)}
                </div>

                {/* Etapa crítica */}
                <div className="mt-3 p-3 bg-white rounded border-l-4 border-red-500">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {patient.criticalStep.stepName}
                      </p>
                      {patient.criticalStep.stepDescription && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {patient.criticalStep.stepDescription}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {patient.criticalStep.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Prazo:{' '}
                            {format(
                              new Date(patient.criticalStep.dueDate),
                              'dd/MM/yyyy',
                              { locale: ptBR }
                            )}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {patient.completedSteps}/{patient.totalSteps} etapas (
                          {patient.completionRate}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alertas */}
                {patient.navigationAlertsCount > 0 && (
                  <div className="mt-2">
                    <Badge variant="destructive" className="text-xs">
                      {patient.navigationAlertsCount} alerta
                      {patient.navigationAlertsCount > 1 ? 's' : ''} de
                      navegação
                    </Badge>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum paciente com etapas críticas encontrado.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
