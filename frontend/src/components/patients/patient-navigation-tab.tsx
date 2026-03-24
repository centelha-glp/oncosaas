'use client';

import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PatientDetail } from '@/lib/api/patients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertCircle, Edit, Plus, Trash2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NavigationStep, navigationApi } from '@/lib/api/navigation';
import { NavigationStepDialog } from './navigation-step-dialog';
import { CreateNavigationStepDialog } from './create-navigation-step-dialog';
import { toast } from 'sonner';

interface PatientNavigationTabProps {
  patient: PatientDetail;
}

const STEP_STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800 border-green-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-300',
  PENDING: 'bg-gray-100 text-gray-800 border-gray-300',
  OVERDUE: 'bg-red-100 text-red-800 border-red-300',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-300',
  NOT_APPLICABLE: 'bg-gray-100 text-gray-800 border-gray-300',
};

const STEP_STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Concluída',
  IN_PROGRESS: 'Em Andamento',
  PENDING: 'Pendente',
  OVERDUE: 'Atrasada',
  CANCELLED: 'Cancelada',
  NOT_APPLICABLE: 'Não Aplicável',
};

const STEP_STATUS_ICONS: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle2 className="h-4 w-4" />,
  IN_PROGRESS: <Clock className="h-4 w-4" />,
  PENDING: <Clock className="h-4 w-4" />,
  OVERDUE: <AlertCircle className="h-4 w-4" />,
  CANCELLED: <AlertCircle className="h-4 w-4" />,
  NOT_APPLICABLE: <AlertCircle className="h-4 w-4" />,
};

const CANCER_TYPE_LABELS: Record<string, string> = {
  breast: 'Câncer de Mama',
  lung: 'Câncer de Pulmão',
  colorectal: 'Câncer Colorretal',
  prostate: 'Câncer de Próstata',
  kidney: 'Câncer de Rim',
  bladder: 'Câncer de Bexiga',
  testicular: 'Câncer de Testículo',
  palliative_care: 'Tratamento Paliativo',
  other: 'Outros',
};

const JOURNEY_STAGE_LABELS: Record<string, string> = {
  SCREENING: 'Rastreamento',
  DIAGNOSIS: 'Diagnóstico',
  TREATMENT: 'Tratamento',
  FOLLOW_UP: 'Seguimento',
  PALLIATIVE: 'Cuidados Paliativos',
};

const JOURNEY_STAGE_ORDER: string[] = [
  'SCREENING',
  'DIAGNOSIS',
  'TREATMENT',
  'FOLLOW_UP',
  'PALLIATIVE',
];

export function PatientNavigationTab({
  patient,
}: PatientNavigationTabProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [selectedStep, setSelectedStep] = useState<NavigationStep | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [createStage, setCreateStage] = useState<{
    cancerType: string;
    journeyStage: string;
  } | null>(null);
  const [stepToDelete, setStepToDelete] = useState<NavigationStep | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addStepPopoverOpen, setAddStepPopoverOpen] = useState(false);

  // cancerType e diagnosisId para nova etapa: primeiro diagnóstico ativo ou primeira etapa
  const { cancerType, diagnosisId } = useMemo(() => {
    const diagnoses = patient.cancerDiagnoses ?? [];
    const firstActive = diagnoses.find((d) => d.isActive) ?? diagnoses[0];
    const steps = patient.navigationSteps ?? [];
    const firstStep = steps[0] as NavigationStep | undefined;
    return {
      cancerType:
        firstActive?.cancerType ?? firstStep?.cancerType ?? 'other',
      diagnosisId: firstActive?.id ?? null,
    };
  }, [patient.cancerDiagnoses, patient.navigationSteps]);

  // Tipos de câncer presentes (diagnósticos + etapas) para exibir seções
  const cancerTypes = useMemo((): string[] => {
    const fromDiagnoses =
      patient.cancerDiagnoses?.map((d) =>
        (d.cancerType || 'other').toLowerCase()
      ) ?? [];
    const fromSteps =
      patient.navigationSteps?.map((s) =>
        (s.cancerType || 'other').toLowerCase()
      ) ?? [];
    const set = new Set<string>([...fromDiagnoses, ...fromSteps]);
    const list = Array.from(set);
    return list.length > 0 ? list : ['other'];
  }, [patient.cancerDiagnoses, patient.navigationSteps]);

  // Agrupar etapas por tipo de câncer e depois por journeyStage
  const stepsByCancerTypeAndStage = useMemo((): Map<
    string,
    Map<string, NavigationStep[]>
  > => {
    const byType = new Map<string, Map<string, NavigationStep[]>>();
    const steps = patient.navigationSteps || [];

    steps.forEach((step) => {
      const type = (step.cancerType || 'other').toLowerCase();
      const stage = (step.journeyStage || 'SCREENING').toUpperCase();
      if (!byType.has(type)) {
        byType.set(type, new Map());
      }
      const stageMap = byType.get(type)!;
      if (!stageMap.has(stage)) {
        stageMap.set(stage, []);
      }
      stageMap.get(stage)!.push(step as NavigationStep);
    });

    // Ordenar etapas dentro de cada estágio
    byType.forEach((stageMap) => {
      stageMap.forEach((stepList) => {
        stepList.sort((a, b) => {
          if (a.isRequired !== b.isRequired) {
            return a.isRequired ? -1 : 1;
          }
          if (a.expectedDate && b.expectedDate) {
            return (
              new Date(a.expectedDate).getTime() -
              new Date(b.expectedDate).getTime()
            );
          }
          return 0;
        });
      });
    });

    return byType;
  }, [patient.navigationSteps]);

  const handleEditStep = (step: NavigationStep): void => {
    setSelectedStep(step);
    setIsDialogOpen(true);
  };

  const handleDeleteStep = async (): Promise<void> => {
    if (!stepToDelete) return;
    setIsDeleting(true);
    try {
      await navigationApi.deleteStep(stepToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      queryClient.invalidateQueries({
        queryKey: ['navigation-steps', patient.id],
      });
      toast.success('Etapa excluída.');
      setStepToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao excluir etapa'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const hasStepsOrDiagnosis =
    (patient.navigationSteps?.length ?? 0) > 0 ||
    (patient.cancerDiagnoses?.length ?? 0) > 0;

  if (!hasStepsOrDiagnosis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Etapas de Navegação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Nenhuma etapa de navegação registrada. Adicione um diagnóstico de
            câncer ao paciente para poder criar etapas por fase.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Etapas de Navegação</CardTitle>
            <Popover open={addStepPopoverOpen} onOpenChange={setAddStepPopoverOpen}>
              <PopoverTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar etapa
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2">
                <p className="text-sm font-medium text-muted-foreground px-2 py-1 mb-1">
                  Tipo de câncer e fase
                </p>
                {cancerTypes.map((typeKey) => (
                  <div key={typeKey} className="mb-2 last:mb-0">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                      {CANCER_TYPE_LABELS[typeKey] ?? typeKey}
                    </p>
                    {JOURNEY_STAGE_ORDER.map((stage) => (
                      <Button
                        key={`${typeKey}-${stage}`}
                        variant="ghost"
                        className="w-full justify-start"
                        size="sm"
                        onClick={() => {
                          setCreateStage({ cancerType: typeKey, journeyStage: stage });
                          setAddStepPopoverOpen(false);
                        }}
                      >
                        {JOURNEY_STAGE_LABELS[stage] ?? stage}
                      </Button>
                    ))}
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {cancerTypes.map((typeKey) => {
              const stageMap = stepsByCancerTypeAndStage.get(typeKey);
              const totalSteps = stageMap
                ? Array.from(stageMap.values()).reduce((s, arr) => s + arr.length, 0)
                : 0;
              const typeLabel = CANCER_TYPE_LABELS[typeKey] ?? typeKey;

              return (
                <AccordionItem key={typeKey} value={typeKey}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{typeLabel}</span>
                      <Badge variant="outline" className="ml-2">
                        {totalSteps}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-2">
                      {JOURNEY_STAGE_ORDER.map((stage) => {
                        const normalizedStage = stage.toUpperCase();
                        const steps = stageMap?.get(normalizedStage) || [];
                        const stageLabel = JOURNEY_STAGE_LABELS[stage] || stage;

                        return (
                          <div key={stage}>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">
                              {stageLabel}
                              <span className="ml-2 font-normal">
                                ({steps.length})
                              </span>
                            </h4>
                            <div className="space-y-4">
                              {steps.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 py-4 text-center rounded-lg border border-dashed">
                                  <p className="text-sm text-muted-foreground">
                                    Nenhuma etapa para esta fase.
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setCreateStage({
                                        cancerType: typeKey,
                                        journeyStage: normalizedStage,
                                      })
                                    }
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Adicionar etapa
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  {steps.map((step) => (
                            <div
                              key={step.id}
                              className="border rounded-lg p-4 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold">
                                    {step.stepName}
                                  </div>
                                  {step.isRequired && (
                                    <Badge variant="outline" className="text-xs">
                                      Obrigatória
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={
                                      STEP_STATUS_COLORS[step.status] ||
                                      STEP_STATUS_COLORS.PENDING
                                    }
                                  >
                                    <span className="flex items-center gap-1">
                                      {STEP_STATUS_ICONS[step.status] ||
                                        STEP_STATUS_ICONS.PENDING}
                                      {STEP_STATUS_LABELS[step.status] ||
                                        step.status}
                                    </span>
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditStep(step)}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setStepToDelete(step)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </Button>
                                </div>
                              </div>
                            {step.stepDescription && (
                              <p className="text-sm text-muted-foreground">
                                {step.stepDescription}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm flex-wrap">
                              {step.expectedDate && (
                                <div>
                                  <span className="font-medium">
                                    Prazo esperado:
                                  </span>{' '}
                                  {format(
                                    new Date(step.expectedDate),
                                    'dd/MM/yyyy',
                                    {
                                      locale: ptBR,
                                    }
                                  )}
                                </div>
                              )}
                              {step.completedAt && (
                                <div>
                                  <span className="font-medium">
                                    Concluído em:
                                  </span>{' '}
                                  {format(
                                    new Date(step.completedAt),
                                    'dd/MM/yyyy',
                                    {
                                      locale: ptBR,
                                    }
                                  )}
                                </div>
                              )}
                              {step.dueDate && (
                                <div>
                                  <span className="font-medium">
                                    Prazo final:
                                  </span>{' '}
                                  {format(
                                    new Date(step.dueDate),
                                    'dd/MM/yyyy',
                                    {
                                      locale: ptBR,
                                    }
                                  )}
                                </div>
                              )}
                              {step.actualDate && (
                                <div>
                                  <span className="font-medium">
                                    Data real:
                                  </span>{' '}
                                  {format(
                                    new Date(step.actualDate),
                                    'dd/MM/yyyy',
                                    {
                                      locale: ptBR,
                                    }
                                  )}
                                </div>
                              )}
                            </div>
                            {step.institutionName && (
                              <div className="text-sm">
                                <span className="font-medium">
                                  Instituição:
                                </span>{' '}
                                {step.institutionName}
                              </div>
                            )}
                            {step.professionalName && (
                              <div className="text-sm">
                                <span className="font-medium">
                                  Profissional:
                                </span>{' '}
                                {step.professionalName}
                              </div>
                            )}
                            {step.result && (
                              <div className="mt-2">
                                <span className="text-sm font-medium">
                                  Resultado:
                                </span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {step.result}
                                </p>
                              </div>
                            )}
                            {step.notes && (
                              <div className="mt-2">
                                <span className="text-sm font-medium">
                                  Observações:
                                </span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {step.notes}
                                </p>
                              </div>
                            )}
                            </div>
                          ))}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setCreateStage({
                                        cancerType: typeKey,
                                        journeyStage: normalizedStage,
                                      })
                                    }
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Adicionar etapa
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Dialog para editar etapa */}
      {selectedStep && (
        <NavigationStepDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          step={selectedStep}
          patientId={patient.id}
        />
      )}

      {/* Dialog para criar etapa */}
      <CreateNavigationStepDialog
        open={createStage !== null}
        onOpenChange={(open) => !open && setCreateStage(null)}
        patientId={patient.id}
        cancerType={createStage?.cancerType ?? cancerType}
        journeyStage={createStage?.journeyStage ?? 'SCREENING'}
        diagnosisId={diagnosisId}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={stepToDelete !== null}
        onOpenChange={(open) => !open && setStepToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              A etapa &quot;{stepToDelete?.stepName}&quot; será excluída
              permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteStep();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
