'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  Calendar,
  FileText,
  ClipboardList,
  Pencil,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NavigationStep } from '@/lib/api/oncology-navigation';
import {
  usePatientNavigationSteps,
  useUpdateNavigationStep,
} from '@/hooks/useOncologyNavigation';
import { Button } from '@/components/ui/button';
import { NavigationStepForm } from '@/components/patients/navigation-step-form';
import type { UpdateNavigationStepFormData } from '@/lib/validations/navigation-step';

interface OncologyNavigationPanelProps {
  patientId: string;
  cancerType: string | null;
  currentStage: string;
}

const JOURNEY_STAGE_LABELS: Record<string, string> = {
  SCREENING: '🔍 Rastreio',
  DIAGNOSIS: '📋 Diagnóstico',
  TREATMENT: '💊 Tratamento',
  FOLLOW_UP: '📅 Seguimento',
  PALLIATIVE: '🤝 Cuidados paliativos',
};

const JOURNEY_STAGE_LABELS_SHORT: Record<string, string> = {
  SCREENING: 'Rastreio',
  DIAGNOSIS: 'Diagnóstico',
  TREATMENT: 'Tratamento',
  FOLLOW_UP: 'Seguimento',
  PALLIATIVE: 'Paliativos',
};

const STAGE_ORDER: Array<
  'SCREENING' | 'DIAGNOSIS' | 'TREATMENT' | 'FOLLOW_UP' | 'PALLIATIVE'
> = ['SCREENING', 'DIAGNOSIS', 'TREATMENT', 'FOLLOW_UP', 'PALLIATIVE'];

export function OncologyNavigationPanel({
  patientId,
  cancerType,
  currentStage,
}: OncologyNavigationPanelProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(
    new Set([currentStage])
  );
  const [editingStep, setEditingStep] = useState<NavigationStep | null>(null);
  const { data: steps, isLoading } = usePatientNavigationSteps(patientId);
  const updateStep = useUpdateNavigationStep();

  const toggleStage = (stage: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stage)) {
      newExpanded.delete(stage);
    } else {
      newExpanded.add(stage);
    }
    setExpandedStages(newExpanded);
  };

  const getStatusIcon = (status: NavigationStep['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'IN_PROGRESS':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'OVERDUE':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'CANCELLED':
        return <XCircle className="h-5 w-5 text-gray-400" />;
      case 'NOT_APPLICABLE':
        return <XCircle className="h-5 w-5 text-gray-300" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (
    status: NavigationStep['status'],
    isRequired: boolean
  ) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'OVERDUE':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'CANCELLED':
      case 'NOT_APPLICABLE':
        return 'bg-gray-50 border-gray-200 text-gray-500';
      default:
        return isRequired
          ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
          : 'bg-gray-50 border-gray-200 text-gray-600';
    }
  };

  const getStatusLabel = (status: NavigationStep['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'Concluída';
      case 'IN_PROGRESS':
        return 'Em Andamento';
      case 'OVERDUE':
        return 'Atrasada';
      case 'CANCELLED':
        return 'Cancelada';
      case 'NOT_APPLICABLE':
        return 'Não Aplicável';
      default:
        return 'Pendente';
    }
  };

  const handleMarkComplete = async (step: NavigationStep) => {
    await updateStep.mutateAsync({
      stepId: step.id,
      data: {
        isCompleted: true,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        actualDate: new Date().toISOString(),
      },
    });
  };

  const handleEditStep = (step: NavigationStep) => {
    setEditingStep(step);
  };

  const handleEditSubmit = async (data: UpdateNavigationStepFormData) => {
    if (!editingStep) return;
    await updateStep.mutateAsync({
      stepId: editingStep.id,
      data: {
        status: data.status,
        isCompleted: data.isCompleted,
        completedAt: data.completedAt,
        actualDate: data.actualDate,
        dueDate: data.dueDate,
        institutionName: data.institutionName,
        professionalName: data.professionalName,
        result: data.result,
        findings: data.findings,
        notes: data.notes,
      },
    });
    setEditingStep(null);
  };

  if (isLoading) {
    return (
      <div className="bg-white p-4 space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return (
      <div className="bg-white p-4 border rounded-lg">
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">
            Nenhuma etapa de navegação configurada para este paciente.
          </p>
          {cancerType && (
            <Button
              onClick={async () => {
                // TODO: Implementar inicialização
                alert('Funcionalidade de inicialização em desenvolvimento');
              }}
              variant="outline"
            >
              Inicializar Etapas
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Agrupar etapas por fase da jornada
  const stepsByStage = steps.reduce(
    (acc, step) => {
      if (!acc[step.journeyStage]) {
        acc[step.journeyStage] = [];
      }
      acc[step.journeyStage].push(step);
      return acc;
    },
    {} as Record<string, NavigationStep[]>
  );

  // Ordenar etapas dentro de cada fase
  Object.keys(stepsByStage).forEach((stage) => {
    stepsByStage[stage].sort((a, b) => {
      // Obrigatórias primeiro
      if (a.isRequired !== b.isRequired) {
        return a.isRequired ? -1 : 1;
      }
      // Por data esperada
      if (a.expectedDate && b.expectedDate) {
        return (
          new Date(a.expectedDate).getTime() -
          new Date(b.expectedDate).getTime()
        );
      }
      return 0;
    });
  });

  return (
    <div className="bg-white space-y-4">
      <div className="space-y-3">
        {STAGE_ORDER.map((stage) => {
          const stageSteps = stepsByStage[stage] || [];
          if (stageSteps.length === 0) return null;

          const isExpanded = expandedStages.has(stage);
          const completedCount = stageSteps.filter((s) => s.isCompleted).length;
          const overdueCount = stageSteps.filter(
            (s) => s.status === 'OVERDUE'
          ).length;
          const isCurrentStage = stage === currentStage;

          return (
            <div key={stage} className="space-y-2">
              {/* Header da seção */}
              <button
                onClick={() => toggleStage(stage)}
                className="w-full text-left hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  )}
                  <ClipboardList className="h-4 w-4 text-gray-600 flex-shrink-0" />
                  <span className="font-semibold text-gray-900">
                    {JOURNEY_STAGE_LABELS_SHORT[stage] || stage}
                  </span>
                  {isCurrentStage && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      Atual
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-1 pl-6">
                  {completedCount}/{stageSteps.length} concluídas
                </div>
              </button>

              {/* Cards das tarefas */}
              {isExpanded && (
                <div className="space-y-3 pl-6">
                  {stageSteps.map((step) => (
                    <div
                      key={step.id}
                      className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 relative"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Título e badge */}
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-lg text-orange-800">
                              {step.stepName}
                            </h4>
                            {step.isRequired && (
                              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs font-medium rounded-full flex-shrink-0">
                                Obrigatória
                              </span>
                            )}
                          </div>

                          {/* Descrição */}
                          {step.stepDescription && (
                            <p className="text-sm text-orange-700 mb-3">
                              {step.stepDescription}
                            </p>
                          )}

                          {/* Prazo */}
                          {step.dueDate && (
                            <div className="flex items-center gap-1.5 text-sm text-orange-700">
                              <Clock className="h-4 w-4" />
                              <span>
                                Prazo:{' '}
                                {format(new Date(step.dueDate), 'dd/MM/yyyy', {
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                          )}

                          {/* Data esperada (se não houver prazo) */}
                          {!step.dueDate && step.expectedDate && (
                            <div className="flex items-center gap-1.5 text-sm text-orange-700">
                              <Clock className="h-4 w-4" />
                              <span>
                                Esperado:{' '}
                                {format(
                                  new Date(step.expectedDate),
                                  'dd/MM/yyyy',
                                  {
                                    locale: ptBR,
                                  }
                                )}
                              </span>
                            </div>
                          )}

                          {/* Status de conclusão */}
                          {step.completedAt && (
                            <div className="flex items-center gap-1.5 text-sm text-green-700 mt-2">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>
                                Concluída em:{' '}
                                {format(
                                  new Date(step.completedAt),
                                  'dd/MM/yyyy',
                                  {
                                    locale: ptBR,
                                  }
                                )}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Botões de ação no canto direito */}
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => handleEditStep(step)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {!step.isCompleted && step.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleMarkComplete(step)}
                              disabled={updateStep.isPending}
                              className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {updateStep.isPending
                                ? 'Salvando...'
                                : 'Marcar como Concluída'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Diálogo de edição da etapa */}
      <Dialog
        open={!!editingStep}
        onOpenChange={(open) => !open && setEditingStep(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar próxima etapa</DialogTitle>
            <DialogDescription>
              {editingStep
                ? `Atualize as informações da etapa: ${editingStep.stepName}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {editingStep && (
            <NavigationStepForm
              step={
                editingStep as Parameters<
                  typeof NavigationStepForm
                >[0]['step']
              }
              onSubmit={handleEditSubmit}
              onCancel={() => setEditingStep(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
