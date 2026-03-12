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

const patientQuickEditSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf: z.string().optional(),
  phone: z.string().min(10, 'Telefone é obrigatório (mín. 10 dígitos)'),
  birthDate: z.string().min(1, 'Data de nascimento é obrigatória'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  currentStage: z.enum(['SCREENING', 'DIAGNOSIS', 'TREATMENT', 'FOLLOW_UP']),
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
});

type PatientQuickEditFormData = z.infer<typeof patientQuickEditSchema>;

const CURRENT_STAGE_OPTIONS: {
  value: PatientQuickEditFormData['currentStage'];
  label: string;
}[] = [
  { value: 'SCREENING', label: 'Em Rastreio' },
  { value: 'DIAGNOSIS', label: 'Diagnóstico' },
  { value: 'TREATMENT', label: 'Tratamento' },
  { value: 'FOLLOW_UP', label: 'Seguimento' },
];

/** Valor usado no Select para "nenhum tipo"; Radix não permite value="" em SelectItem */
const CANCER_TYPE_NONE_VALUE = '__none__';

const CANCER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'breast', label: 'Mama' },
  { value: 'lung', label: 'Pulmão' },
  { value: 'colorectal', label: 'Colorretal' },
  { value: 'prostate', label: 'Próstata' },
  { value: 'kidney', label: 'Rim' },
  { value: 'bladder', label: 'Bexiga' },
  { value: 'testicular', label: 'Testículo' },
  { value: 'other', label: 'Outro' },
];

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
    },
  });

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
                      {CANCER_TYPE_OPTIONS.map((opt) => (
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
