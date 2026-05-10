'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Patient, UpdatePatientDto } from '@/lib/api/patients';
import {
  getPatientCancerType,
  getCancerTypeKey,
} from '@/lib/utils/patient-cancer-type';
import { usePatientUpdate } from '@/hooks/use-patient-update';
import { toast } from 'sonner';
import { JOURNEY_STAGE_LABELS } from '@/lib/utils/journey-stage';
import { useEnabledCancerTypes } from '@/hooks/useEnabledCancerTypes';

const patientQuickEditSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    cpf: z.string().optional(),
    phone: z.string().min(10, 'Telefone é obrigatório (mín. 10 dígitos)'),
    birthDate: z.string().min(1, 'Data de nascimento é obrigatória'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    currentStage: z.enum([
      'SCREENING',
      'DIAGNOSIS',
      'TREATMENT',
      'FOLLOW_UP',
      'PALLIATIVE',
    ]),
    cancerType: z
      .enum([
        'breast',
        'lung',
        'colorectal',
        'prostate',
        'kidney',
        'bladder',
        'testicular',
        'other',
      ])
      .optional()
      .nullable(),
    healthCoverageType: z.enum(['PRIVATE', 'HEALTH_PLAN']).optional(),
    healthPlanName: z.string().max(255).optional(),
    insuranceMemberId: z.string().max(128).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.healthCoverageType === 'HEALTH_PLAN' &&
      !data.healthPlanName?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['healthPlanName'],
        message: 'Informe o nome do plano de saúde.',
      });
    }
    if (
      !data.healthCoverageType &&
      (data.healthPlanName?.trim() || data.insuranceMemberId?.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['healthCoverageType'],
        message:
          'Selecione "Plano de saúde" para informar nome do plano ou carteirinha.',
      });
    }
  });

type PatientQuickEditFormData = z.infer<typeof patientQuickEditSchema>;

const CURRENT_STAGE_OPTIONS: {
  value: PatientQuickEditFormData['currentStage'];
  label: string;
}[] = [
  { value: 'SCREENING', label: JOURNEY_STAGE_LABELS['SCREENING'] },
  { value: 'DIAGNOSIS', label: JOURNEY_STAGE_LABELS['DIAGNOSIS'] },
  { value: 'TREATMENT', label: JOURNEY_STAGE_LABELS['TREATMENT'] },
  { value: 'FOLLOW_UP', label: JOURNEY_STAGE_LABELS['FOLLOW_UP'] },
  { value: 'PALLIATIVE', label: JOURNEY_STAGE_LABELS['PALLIATIVE'] },
];

/** Valor usado no Select para "nenhum tipo"; Radix não permite value="" em SelectItem */
const CANCER_TYPE_NONE_VALUE = '__none__';
const HEALTH_COVERAGE_NONE = '__health_coverage_none__';

// CANCER_TYPE_OPTIONS agora é dinâmico, gerado dentro do componente via useEnabledCancerTypes

function formatBirthDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

interface PatientEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient | null;
  onSuccess?: () => void;
}

export function PatientEditDialog({
  open,
  onOpenChange,
  patient,
  onSuccess,
}: PatientEditDialogProps) {
  const { labels: enabledLabels } = useEnabledCancerTypes();
  const cancerTypeOptions = Object.entries(enabledLabels).map(([value, label]) => ({
    value,
    label,
  }));
  const updateMutation = usePatientUpdate();

  const form = useForm<PatientQuickEditFormData>({
    resolver: zodResolver(patientQuickEditSchema),
    defaultValues: {
      name: '',
      cpf: '',
      phone: '',
      birthDate: '',
      email: '',
      currentStage: 'SCREENING',
      cancerType: undefined,
      healthPlanName: '',
      insuranceMemberId: '',
    },
  });

  const healthCoverageWatch = form.watch('healthCoverageType');

  useEffect(() => {
    if (patient && open) {
      form.reset({
        name: patient.name ?? '',
        cpf: patient.cpf ?? '',
        phone: patient.phone ?? '',
        birthDate: formatBirthDateForInput(patient.birthDate),
        email: patient.email ?? '',
        currentStage:
          (patient.currentStage as PatientQuickEditFormData['currentStage']) ??
          'SCREENING',
        cancerType: (getCancerTypeKey(
          getPatientCancerType(patient) ?? undefined
        ) ?? undefined) as PatientQuickEditFormData['cancerType'],
        healthCoverageType:
          patient.healthCoverageType === 'PRIVATE' ||
          patient.healthCoverageType === 'HEALTH_PLAN'
            ? patient.healthCoverageType
            : undefined,
        healthPlanName: patient.healthPlanName ?? '',
        insuranceMemberId: patient.insuranceMemberId ?? '',
      });
    }
  }, [patient, open, form]);

  const onSubmit = async (data: PatientQuickEditFormData) => {
    if (!patient) return;
    const payload: UpdatePatientDto = {
      name: data.name,
      cpf: data.cpf || undefined,
      phone: data.phone,
      birthDate: data.birthDate,
      email: data.email || undefined,
      currentStage: data.currentStage,
      cancerType: data.cancerType == null ? undefined : data.cancerType,
      healthCoverageType:
        data.healthCoverageType === 'PRIVATE' ||
        data.healthCoverageType === 'HEALTH_PLAN'
          ? data.healthCoverageType
          : null,
      healthPlanName:
        data.healthCoverageType === 'HEALTH_PLAN'
          ? data.healthPlanName?.trim()
          : null,
      insuranceMemberId:
        data.healthCoverageType === 'HEALTH_PLAN'
          ? data.insuranceMemberId?.trim() || null
          : null,
    };
    try {
      await updateMutation.mutateAsync({ id: patient.id, data: payload });
      toast.success('Dados do paciente atualizados.');
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Erro ao atualizar paciente.'
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar dados do paciente</DialogTitle>
          <DialogDescription>
            Altere os dados exibidos no painel. As alterações são salvas no
            prontuário.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome do paciente" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="000.000.000-00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="(00) 00000-0000" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de nascimento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      {...field}
                      placeholder="email@exemplo.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="healthCoverageType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cobertura de saúde</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      if (v === HEALTH_COVERAGE_NONE) {
                        field.onChange(undefined);
                        form.setValue('healthPlanName', '');
                        form.setValue('insuranceMemberId', '');
                        return;
                      }
                      field.onChange(v as 'PRIVATE' | 'HEALTH_PLAN');
                      if (v === 'PRIVATE') {
                        form.setValue('healthPlanName', '');
                        form.setValue('insuranceMemberId', '');
                      }
                    }}
                    value={
                      field.value === 'PRIVATE' || field.value === 'HEALTH_PLAN'
                        ? field.value
                        : HEALTH_COVERAGE_NONE
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Não informado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={HEALTH_COVERAGE_NONE}>
                        Não informado
                      </SelectItem>
                      <SelectItem value="PRIVATE">Particular</SelectItem>
                      <SelectItem value="HEALTH_PLAN">Plano de saúde</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {healthCoverageWatch === 'HEALTH_PLAN' && (
              <>
                <FormField
                  control={form.control}
                  name="healthPlanName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do plano / operadora</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex.: Unimed, Amil"
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insuranceMemberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da carteirinha</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Opcional"
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <FormField
              control={form.control}
              name="currentStage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fase atual</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fase" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CURRENT_STAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cancerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de câncer</FormLabel>
                  <Select
                    onValueChange={(v) =>
                      field.onChange(
                        v === CANCER_TYPE_NONE_VALUE ? undefined : v
                      )
                    }
                    value={field.value ?? CANCER_TYPE_NONE_VALUE}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={CANCER_TYPE_NONE_VALUE}>
                        Nenhum / Em rastreio
                      </SelectItem>
                      {cancerTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
