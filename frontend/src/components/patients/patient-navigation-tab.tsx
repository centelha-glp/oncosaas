'use client';

import { useState, useMemo } from 'react';
import { PatientDetail } from '@/lib/api/patients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertCircle, Edit } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { NavigationStep } from '@/lib/api/navigation';
import { NavigationStepDialog } from './navigation-step-dialog';

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

const JOURNEY_STAGE_LABELS: Record<string, string> = {
  SCREENING: 'Rastreamento',
  DIAGNOSIS: 'Diagnóstico',
  TREATMENT: 'Tratamento',
  FOLLOW_UP: 'Seguimento',
  NAVIGATION: 'Navegação',
};

const JOURNEY_STAGE_ORDER: string[] = [
  'SCREENING',
  'DIAGNOSIS',
  'TREATMENT',
  'FOLLOW_UP',
];

export function PatientNavigationTab({
  patient,
}: PatientNavigationTabProps): JSX.Element {
  const [selectedStep, setSelectedStep] = useState<NavigationStep | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Agrupar etapas por journeyStage
  const stepsByStage = useMemo((): Map<string, NavigationStep[]> => {
    const grouped = new Map<string, NavigationStep[]>();
    const steps = patient.navigationSteps || [];

    steps.forEach((step) => {
      // Normalizar o journeyStage para uppercase para garantir consistência
      const stage = (step.journeyStage || 'NAVIGATION').toUpperCase();
      if (!grouped.has(stage)) {
        grouped.set(stage, []);
      }
      grouped.get(stage)!.push(step as NavigationStep);
    });

    // Ordenar etapas dentro de cada estágio
    grouped.forEach((steps) => {
      steps.sort((a, b) => {
        // Ordenar por isRequired (obrigatórias primeiro), depois por expectedDate
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

    return grouped;
  }, [patient.navigationSteps]);

  const handleEditStep = (step: NavigationStep): void => {
    setSelectedStep(step);
    setIsDialogOpen(true);
  };

  // Sempre mostrar todos os estágios da jornada, mesmo que vazios
  // Isso dá uma visão completa da jornada do paciente
  const availableStages = useMemo(() => {
    return JOURNEY_STAGE_ORDER;
  }, []);

  if (!patient.navigationSteps || patient.navigationSteps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Etapas de Navegação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Nenhuma etapa de navegação registrada
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Etapas de Navegação</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {availableStages.map((stage) => {
              // Normalizar stage para uppercase para comparação
              const normalizedStage = stage.toUpperCase();
              const steps = stepsByStage.get(normalizedStage) || [];
              const stageLabel = JOURNEY_STAGE_LABELS[stage] || stage;

              return (
                <AccordionItem key={stage} value={stage}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{stageLabel}</span>
                      <Badge variant="outline" className="ml-2">
                        {steps.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {steps.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          Nenhuma etapa registrada para esta fase da jornada.
                        </p>
                      ) : (
                        steps.map((step) => (
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
                        ))
                      )}
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
    </div>
  );
}
