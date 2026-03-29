'use client';

import React, { useState, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { PatientDetail } from '@/lib/api/patients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertCircle, Edit, Plus, Trash2, ChevronRight, Check } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NavigationStep, navigationApi } from '@/lib/api/navigation';
import { NavigationStepDialog } from './navigation-step-dialog';
import { CreateNavigationStepDialog } from './create-navigation-step-dialog';
import { toast } from 'sonner';
import {
  JOURNEY_STAGE_LABELS,
  JOURNEY_STAGES,
  type JourneyStage,
} from '@/lib/utils/journey-stage';
import { CANCER_TYPE_LABELS as BASE_CANCER_TYPE_LABELS } from '@/lib/utils/patient-cancer-type';

interface PatientNavigationTabProps {
  patient: PatientDetail;
}

interface StepTemplate {
  stepKey: string;
  stepName: string;
  stepDescription?: string | null;
  isRequired: boolean;
  existingCount: number;
}

function WizardStepPicker({
  patientId,
  stage,
  onBack,
  onSelect,
}: {
  patientId: string;
  stage: string;
  onBack: () => void;
  onSelect: (stepKey: string | null) => void;
}) {
  const [templates, setTemplates] = useState<StepTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    setLoading(true);
    navigationApi
      .getStepTemplates(patientId, stage)
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [patientId, stage]);

  return (
    <>
      <div className="flex items-center gap-1 mb-1">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded">
          <ChevronRight className="h-4 w-4 rotate-180 text-gray-500" />
        </button>
        <p className="text-sm font-medium">
          {JOURNEY_STAGE_LABELS[stage as JourneyStage] ?? stage}
        </p>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground px-2 py-2">Carregando...</p>
      ) : (
        <>
          {templates.some((t) => t.existingCount === 0) && (
            <Button
              variant="ghost"
              className="w-full justify-start text-blue-600"
              size="sm"
              onClick={() => onSelect(null)}
            >
              Criar todas as etapas faltantes
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            size="sm"
            onClick={() => onSelect('__custom__')}
          >
            + Etapa personalizada...
          </Button>
          {templates.length > 0 && <div className="border-t my-1" />}
          {templates.map((t) => (
            <Button
              key={t.stepKey}
              variant="ghost"
              className="w-full justify-start text-sm"
              size="sm"
              onClick={() => onSelect(t.stepKey)}
              title={t.stepDescription ?? undefined}
            >
              <span className="truncate">{t.stepName}</span>
              <span className="ml-auto flex items-center gap-1 shrink-0">
                {t.existingCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({t.existingCount})
                  </span>
                )}
                {t.isRequired && (
                  <span className="text-xs text-purple-600">obr.</span>
                )}
              </span>
            </Button>
          ))}
          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">
              Nenhum template disponível para esta fase.
            </p>
          )}
        </>
      )}
    </>
  );
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

// Labels derivados do utilitário centralizado; palliative_care é específico de navegação
const CANCER_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(BASE_CANCER_TYPE_LABELS).map(([k, v]) => [k, `Câncer de ${v}`])
  ),
  palliative_care: 'Tratamento Paliativo',
};


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

  // Wizard: fase selecionada no popover principal
    const [wizardStage, setWizardStage] = useState<{
    cancerType: string;
    stage: JourneyStage;
  } | null>(null);
  const [wizardTypeKey, setWizardTypeKey] = useState<string | null>(null);

  // Step picker independente (para botões inline por fase)
  const [stepPickerTarget, setStepPickerTarget] = useState<{
    typeKey: string;
    stage: JourneyStage;
  } | null>(null);
  const [stepPickerTemplates, setStepPickerTemplates] = useState<
    { stepKey: string; stepName: string; stepDescription?: string | null; isRequired: boolean; existingCount: number }[]
  >([]);
  const [stepPickerLoading, setStepPickerLoading] = useState(false);

  const toggleCompleteMutation = useMutation({
    mutationFn: ({ stepId, isCompleted }: { stepId: string; isCompleted: boolean }) =>
      navigationApi.updateStep(stepId, {
        isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['navigation-steps', patient.id] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar etapa: ${error.message}`);
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: ({ journeyStage, stepKey }: { journeyStage: string; stepKey: string }) =>
      navigationApi.createStepFromTemplate(patient.id, journeyStage, stepKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['navigation-steps', patient.id] });
      toast.success('Etapa criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar etapa: ${error.message}`);
    },
  });

  const createMissingStepsMutation = useMutation({
    mutationFn: ({ journeyStage, stepKey }: { journeyStage: string; stepKey?: string }) =>
      navigationApi.createMissingStepsForStage(patient.id, journeyStage, stepKey),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['navigation-steps', patient.id] });
      toast.success(
        data.created > 0
          ? `${data.created} etapa(s) criada(s) com sucesso`
          : 'Todas as etapas já existem para esta fase'
      );
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar etapas: ${error.message}`);
    },
  });

  const loadTemplates = async (typeKey: string, stage: string): Promise<
    { stepKey: string; stepName: string; stepDescription?: string | null; isRequired: boolean; existingCount: number }[]
  > => {
    try {
      return await navigationApi.getStepTemplates(patient.id, stage);
    } catch {
      return [];
    }
  };

  const handleWizardSelectPhase = async (typeKey: string, stage: JourneyStage): Promise<void> => {
    setWizardTypeKey(typeKey);
    setWizardStage({ cancerType: typeKey, stage });
  };

  const handleDeleteStep = async (stepId: string): Promise<void> => {
    setIsDeleting(true);
    try {
      await navigationApi.deleteStep(stepId);
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['navigation-steps', patient.id] });
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

  const handleWizardSelectStep = async (
    selectedStepKey: string | null
  ): Promise<void> => {
    if (!wizardStage) return;

    if (selectedStepKey === '__custom__') {
      setCreateStage({
        cancerType: wizardStage.cancerType,
        journeyStage: wizardStage.stage,
      });
      setAddStepPopoverOpen(false);
      setWizardStage(null);
      return;
    }

    try {
      if (selectedStepKey === null) {
        const result = await navigationApi.createMissingStepsForStage(
          patient.id,
          wizardStage.stage
        );
        toast.success(
          result.created > 0
            ? `${result.created} etapa(s) criada(s).`
            : 'Nenhuma etapa faltante para criar.'
        );
      } else {
        await navigationApi.createStepFromTemplate(
          patient.id,
          wizardStage.stage,
          selectedStepKey
        );
        toast.success('Etapa adicionada com sucesso.');
      }

      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      queryClient.invalidateQueries({
        queryKey: ['navigation-steps', patient.id],
      });
      setAddStepPopoverOpen(false);
      setWizardStage(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar etapa');
    }
  };

  const openStepPicker = async (typeKey: string, stage: JourneyStage): Promise<void> => {
    setStepPickerLoading(true);
    setStepPickerTarget({ typeKey, stage });
    const templates = await loadTemplates(typeKey, stage);
    setStepPickerTemplates(templates);
    setStepPickerLoading(false);
  };

  const handleStepPickerSelect = (stepKey: string | null): void => {
    const target = stepPickerTarget!;
    setStepPickerTarget(null);
    setStepPickerTemplates([]);
    if (stepKey === '__custom__') {
      setCreateStage({ cancerType: target.typeKey, journeyStage: target.stage });
    } else if (stepKey === null) {
      createMissingStepsMutation.mutate({ journeyStage: target.stage });
    } else {
      createFromTemplateMutation.mutate({ journeyStage: target.stage, stepKey });
    }
  };

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
            <Popover
              open={addStepPopoverOpen}
              onOpenChange={(open) => {
                setAddStepPopoverOpen(open);
                if (!open) { setWizardStage(null); setWizardTypeKey(null); }
              }}
            >
              <PopoverTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar etapa
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                {wizardStage === null ? (
                  /* Passo 1: selecionar tipo de câncer + fase */
                  <>
                    <p className="text-sm font-medium text-muted-foreground px-2 py-1 mb-1">
                      Escolha a fase
                    </p>
                    {cancerTypes.map((typeKey) => (
                      <div key={typeKey} className="mb-2 last:mb-0">
                        {cancerTypes.length > 1 && (
                          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                            {CANCER_TYPE_LABELS[typeKey] ?? typeKey}
                          </p>
                        )}
                        {JOURNEY_STAGES.map((stage) => (
                          <Button
                            key={`${typeKey}-${stage}`}
                            variant="ghost"
                            className="w-full justify-start"
                            size="sm"
                            onClick={() => handleWizardSelectPhase(typeKey, stage)}
                          >
                            {JOURNEY_STAGE_LABELS[stage] ?? stage}
                          </Button>
                        ))}
                      </div>
                    ))}
                  </>
                ) : (
                  /* Passo 2: selecionar etapa dentro da fase */
                  <WizardStepPicker
                    patientId={patient.id}
                    stage={wizardStage.stage}
                    onBack={() => { setWizardStage(null); setWizardTypeKey(null); }}
                    onSelect={handleWizardSelectStep}
                  />
                )}
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
                      {JOURNEY_STAGES.map((stage) => {
                        const steps = stageMap?.get(stage) || [];
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
                                    onClick={() => openStepPicker(typeKey, stage)}
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
                                  <button
                                    onClick={() =>
                                      toggleCompleteMutation.mutate({
                                        stepId: step.id,
                                        isCompleted: !step.isCompleted,
                                      })
                                    }
                                    disabled={toggleCompleteMutation.isPending}
                                    className={`p-1.5 rounded transition-colors disabled:opacity-50 ${
                                      step.isCompleted
                                        ? 'bg-green-100 hover:bg-green-200 text-green-700'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                    }`}
                                    title={step.isCompleted ? 'Desmarcar como concluída' : 'Marcar como concluída'}
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
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
                                    onClick={() => openStepPicker(typeKey, stage)}
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

      {/* Dialog step picker inline (botões por fase) */}
      <Dialog
        open={stepPickerTarget !== null}
        onOpenChange={(open) => { if (!open) { setStepPickerTarget(null); setStepPickerTemplates([]); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {stepPickerTarget
                ? `${JOURNEY_STAGE_LABELS[stepPickerTarget.stage] ?? stepPickerTarget.stage} — escolha a etapa`
                : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 pt-1">
            {stepPickerLoading ? (
              <p className="text-sm text-muted-foreground py-2">Carregando...</p>
            ) : (
              <>
                {stepPickerTemplates.some((t) => t.existingCount === 0) && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-blue-600"
                    size="sm"
                    onClick={() => handleStepPickerSelect(null)}
                  >
                    Criar todas as etapas faltantes
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground"
                  size="sm"
                  onClick={() => handleStepPickerSelect('__custom__')}
                >
                  + Etapa personalizada...
                </Button>
                {stepPickerTemplates.length > 0 && <div className="border-t my-1" />}
                {stepPickerTemplates.map((t) => (
                  <Button
                    key={t.stepKey}
                    variant="ghost"
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => handleStepPickerSelect(t.stepKey)}
                    title={t.stepDescription ?? undefined}
                  >
                    <span className="truncate">{t.stepName}</span>
                    <span className="ml-auto flex items-center gap-1 shrink-0">
                      {t.existingCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({t.existingCount})
                        </span>
                      )}
                      {t.isRequired && (
                        <span className="text-xs text-purple-600">obr.</span>
                      )}
                    </span>
                  </Button>
                ))}
                {stepPickerTemplates.length === 0 && !stepPickerLoading && (
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    Nenhum template disponível para esta fase.
                  </p>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                if (stepToDelete) handleDeleteStep(stepToDelete.id);
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
