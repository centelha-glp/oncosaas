'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createPatientSchema,
  CreatePatientFormData,
} from '@/lib/validations/patient';
import {
  patientsApi,
  CreatePatientDto,
  type ComorbiditySeverity,
} from '@/lib/api/patients';
import { getTreatmentOptionsForCancerType } from '@/lib/utils/patient-cancer-type';
import { useEnabledCancerTypes } from '@/hooks/useEnabledCancerTypes';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { JOURNEY_STAGE_LABELS } from '@/lib/utils/journey-stage';
import { ComorbiditiesForm } from './comorbidities-form';
import { CurrentMedicationsForm } from './current-medications-form';
import { FamilyHistoryForm } from './family-history-form';

interface PatientCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { id: 1, title: 'Dados Básicos' },
  { id: 2, title: 'Dados Oncológicos' },
  { id: 3, title: 'Integração EHR (Opcional)' },
];

export function PatientCreateDialog({
  open,
  onOpenChange,
}: PatientCreateDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const queryClient = useQueryClient();
  const { labels: enabledCancerLabels } = useEnabledCancerTypes();

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    reset,
  } = useForm<CreatePatientFormData>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      gender: undefined,
      cancerType: undefined,
      currentStage: 'SCREENING',
      performanceStatus: undefined,
      currentTreatment: '',
      phone: '',
    },
  });

  const gender = useWatch({ control, name: 'gender' });
  const cancerType = useWatch({ control, name: 'cancerType' });
  const currentStage = useWatch({ control, name: 'currentStage' });
  const performanceStatus = useWatch({ control, name: 'performanceStatus' });
  const comorbidities = useWatch({ control, name: 'comorbidities' });
  const currentMedications = useWatch({ control, name: 'currentMedications' });
  const familyHistory = useWatch({ control, name: 'familyHistory' });
  const currentTreatment = useWatch({ control, name: 'currentTreatment' });

  const needsDiagnosisFields =
    currentStage === 'TREATMENT' || currentStage === 'FOLLOW_UP';
  const needsTreatmentField =
    currentStage === 'TREATMENT' || currentStage === 'FOLLOW_UP';
  const treatmentOptions = getTreatmentOptionsForCancerType(
    cancerType ?? null,
    currentStage === 'TREATMENT'
  );

  const createPatientMutation = useMutation({
    mutationFn: (data: CreatePatientDto) => patientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Paciente criado com sucesso!');
      reset();
      setCurrentStep(1);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar paciente: ${error.message}`);
    },
  });

  const onSubmit = (data: CreatePatientFormData) => {
    // Helper: filtra array e retorna undefined se vazio
    const filterNonEmpty = <T,>(
      arr: T[] | undefined,
      predicate: (item: T) => boolean
    ): T[] | undefined => {
      if (!arr || arr.length === 0) return undefined;
      const filtered = arr.filter(predicate);
      return filtered.length > 0 ? filtered : undefined;
    };

    const filteredFamilyHistory = filterNonEmpty(
      data.familyHistory,
      (h) =>
        (h.relationship?.trim().length ?? 0) > 0 &&
        (h.cancerType?.trim().length ?? 0) > 0
    )?.map((h) => ({
      relationship: h.relationship!,
      cancerType: h.cancerType!,
      ageAtDiagnosis: h.ageAtDiagnosis,
    }));

    // Mapear dados do formulário para o formato esperado pelo backend
    const patientData: CreatePatientDto = {
      name: data.name,
      cpf: data.cpf || undefined,
      birthDate: data.birthDate,
      gender: data.gender,
      phone: data.phone,
      email: data.email || undefined,
      cancerType: data.cancerType,
      stage: data.stage || undefined,
      diagnosisDate: data.diagnosisDate || undefined,
      currentStage: data.currentStage || 'SCREENING',
      smokingHistory: data.smokingHistory || undefined,
      alcoholHistory: data.alcoholHistory || undefined,
      occupationalExposure: data.occupationalExposure || undefined,
      familyHistory: filteredFamilyHistory,
      comorbidities: filterNonEmpty(
        data.comorbidities,
        (c) => (c.name?.trim().length ?? 0) > 0
      )?.map((c) => ({
        name: c.name!,
        severity: c.severity as ComorbiditySeverity | undefined,
        controlled: c.controlled,
      })),
      currentMedications: filterNonEmpty(
        data.currentMedications,
        (m) => (m.name?.trim().length ?? 0) > 0
      )?.map((m) => ({
        name: m.name!,
        dosage: m.dosage,
        frequency: m.frequency,
      })),
      performanceStatus:
        data.performanceStatus !== undefined && data.performanceStatus !== null
          ? data.performanceStatus
          : undefined,
      currentTreatment: data.currentTreatment?.trim() || undefined,
      ehrId: data.ehrPatientId || undefined,
    };
    createPatientMutation.mutate(patientData);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    reset();
    setCurrentStep(1);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Paciente</DialogTitle>
          <DialogDescription>
            Preencha os dados do paciente em 3 etapas
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de progresso */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    currentStep >= step.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-muted-foreground text-muted-foreground'
                  }`}
                >
                  {step.id}
                </div>
                <span className="text-xs mt-1 text-center">{step.title}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 ${
                    currentStep > step.id ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Etapa 1: Dados Básicos */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <Input {...register('name')} placeholder="Nome completo" />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">CPF</label>
                <Input {...register('cpf')} placeholder="000.000.000-00" />
                {errors.cpf && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.cpf.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">
                  Data de Nascimento *
                </label>
                <Input type="date" {...register('birthDate')} />
                {errors.birthDate && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.birthDate.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Sexo *</label>
                <Select
                  value={gender}
                  onValueChange={(value) => setValue('gender', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o sexo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Feminino</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
                {errors.gender && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.gender.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">
                  Telefone WhatsApp *
                </label>
                <Input
                  {...register('phone')}
                  placeholder="(11) 99999-9999"
                  required
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  {...register('email')}
                  placeholder="email@exemplo.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Etapa 2: Dados Oncológicos */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* Estágio da Jornada primeiro — define quais campos aparecem */}
              <div>
                <label className="text-sm font-medium">
                  Estágio da Jornada *
                </label>
                <Select
                  value={currentStage}
                  onValueChange={(value) => {
                    setValue('currentStage', value as any);
                    if (value !== 'TREATMENT' && value !== 'FOLLOW_UP') {
                      setValue('currentTreatment', '', {
                        shouldValidate: true,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estágio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCREENING">{JOURNEY_STAGE_LABELS['SCREENING']}</SelectItem>
                    <SelectItem value="DIAGNOSIS">{JOURNEY_STAGE_LABELS['DIAGNOSIS']}</SelectItem>
                    <SelectItem value="TREATMENT">{JOURNEY_STAGE_LABELS['TREATMENT']}</SelectItem>
                    <SelectItem value="FOLLOW_UP">{JOURNEY_STAGE_LABELS['FOLLOW_UP']}</SelectItem>
                    <SelectItem value="PALLIATIVE">{JOURNEY_STAGE_LABELS['PALLIATIVE']}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Câncer — obrigatório quando em Tratamento ou Seguimento */}
              <div>
                <label className="text-sm font-medium">
                  Tipo de Câncer{' '}
                  {needsDiagnosisFields && (
                    <span className="text-red-600">*</span>
                  )}
                </label>
                <Select
                  value={cancerType}
                  onValueChange={(value) => {
                    setValue('cancerType', value as any);
                    setValue('currentTreatment', '', { shouldValidate: true });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de câncer" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(enabledCancerLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.cancerType && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.cancerType.message}
                  </p>
                )}
              </div>

              {/* Campos de diagnóstico: só em Tratamento ou Seguimento */}
              {needsDiagnosisFields && (
                <>
                  <div>
                    <label className="text-sm font-medium">
                      Estágio TNM ou Estágio *
                    </label>
                    <Input
                      {...register('stage')}
                      placeholder="Ex: T2N1M0 ou Estágio II"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Data do Diagnóstico *
                    </label>
                    <Input type="date" {...register('diagnosisDate')} />
                    {errors.diagnosisDate && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.diagnosisDate.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Performance Status - ECOG (0-4) *
                    </label>
                    <Select
                      value={
                        performanceStatus !== null &&
                        performanceStatus !== undefined
                          ? String(performanceStatus)
                          : ''
                      }
                      onValueChange={(value) => {
                        if (value === '' || value === undefined) {
                          setValue('performanceStatus', undefined, {
                            shouldValidate: true,
                          });
                        } else {
                          const numValue = parseInt(value, 10);
                          if (!isNaN(numValue)) {
                            setValue('performanceStatus', numValue, {
                              shouldValidate: true,
                            });
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o ECOG" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">
                          0 - Ativo, sem restrições
                        </SelectItem>
                        <SelectItem value="1">
                          1 - Restrição a atividades extenuantes
                        </SelectItem>
                        <SelectItem value="2">
                          2 - Capaz de autocuidado, incapaz de trabalhar
                        </SelectItem>
                        <SelectItem value="3">
                          3 - Autocuidado limitado, confinado ao leito/cadeira
                          &gt;50%
                        </SelectItem>
                        <SelectItem value="4">
                          4 - Completamente incapaz, confinado ao leito
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.performanceStatus && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.performanceStatus.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Tratamento atual: em Tratamento (com opção "A definir") ou Seguimento */}
              {needsTreatmentField && (
                <div>
                  <label className="text-sm font-medium">
                    Tratamento atual *
                  </label>
                  <Select
                    value={currentTreatment || ''}
                    onValueChange={(value) =>
                      setValue('currentTreatment', value, {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tratamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {treatmentOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.currentTreatment && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.currentTreatment.message}
                    </p>
                  )}
                </div>
              )}

              {/* Comorbidades e Fatores de Risco */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold mb-3">
                  Comorbidades e Fatores de Risco (Opcional)
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">
                      Histórico de Tabagismo
                    </label>
                    <Input
                      {...register('smokingHistory')}
                      placeholder="Ex: nunca fumou, ex-fumante (10 anos-maço)"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Histórico de Álcool
                    </label>
                    <Input
                      {...register('alcoholHistory')}
                      placeholder="Ex: nunca, ocasional, moderado (20g/dia)"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Exposição Ocupacional
                    </label>
                    <Input
                      {...register('occupationalExposure')}
                      placeholder="Ex: amianto, benzeno, radiação"
                    />
                  </div>

                  <div>
                    <ComorbiditiesForm
                      value={comorbidities as any}
                      onChange={(comorbidities) =>
                        setValue('comorbidities', comorbidities as any)
                      }
                    />
                  </div>

                  <div>
                    <CurrentMedicationsForm
                      value={currentMedications as any}
                      onChange={(currentMedications) =>
                        setValue(
                          'currentMedications',
                          currentMedications as any
                        )
                      }
                    />
                  </div>

                  <div>
                    <FamilyHistoryForm
                      value={familyHistory as any}
                      onChange={(familyHistory) =>
                        setValue('familyHistory', familyHistory as any)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Etapa 3: Integração EHR */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">ID no Sistema EHR</label>
                <Input
                  {...register('ehrPatientId')}
                  placeholder="ID do paciente no EHR"
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Esta etapa é opcional. Você pode preencher depois se necessário.
              </p>
            </div>
          )}

          {/* Botões de navegação */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>

            {currentStep < STEPS.length ? (
              <Button type="button" onClick={handleNext}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={createPatientMutation.isPending}>
                {createPatientMutation.isPending
                  ? 'Criando...'
                  : 'Criar Paciente'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
