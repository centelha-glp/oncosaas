'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatientBasic } from '@/hooks/use-patient-detail';
import { usePatientRegistrationUpdate } from '@/hooks/use-patient-update';
import type { UpdatePatientRegistrationDto } from '@/lib/api/patients';
import {
  patientRegistrationEditSchema,
  type PatientRegistrationFormData,
} from '@/lib/validations/patient-registration';
import { cn } from '@/lib/utils';

const HEALTH_COVERAGE_NONE = '__health_coverage_none__';

interface PatientRegistrationEditProps {
  patientId: string;
}

function toRegistrationPayload(
  values: PatientRegistrationFormData
): UpdatePatientRegistrationDto {
  const payload: UpdatePatientRegistrationDto = {
    name: values.name.trim(),
    birthDate: values.birthDate,
  };

  if (values.gender) {
    payload.gender = values.gender;
  }

  const cpf = values.cpf?.trim();
  if (cpf) {
    payload.cpf = cpf;
  }

  const phone = values.phone?.trim();
  if (phone) {
    payload.phone = phone;
  }

  const email = values.email?.trim();
  if (email) {
    payload.email = email;
  }

  payload.medicalRecordNumber = values.medicalRecordNumber?.trim() ?? '';
  payload.occupation = values.occupation?.trim() ?? '';
  payload.ehrId = values.ehrId?.trim() ?? '';

  const cov = values.healthCoverageType;
  payload.healthCoverageType =
    cov === 'PRIVATE' || cov === 'HEALTH_PLAN' ? cov : null;
  if (cov === 'HEALTH_PLAN') {
    payload.healthPlanName = values.healthPlanName?.trim();
    payload.insuranceMemberId = values.insuranceMemberId?.trim() || null;
  } else {
    payload.healthPlanName = null;
    payload.insuranceMemberId = null;
  }

  return payload;
}

export function PatientRegistrationEdit({ patientId }: PatientRegistrationEditProps) {
  const router = useRouter();
  const { data: patient, isLoading, error } = usePatientBasic(patientId);
  const registrationUpdate = usePatientRegistrationUpdate();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PatientRegistrationFormData>({
    resolver: zodResolver(patientRegistrationEditSchema),
    defaultValues: {
      name: '',
      cpf: '',
      birthDate: '',
      phone: '',
      email: '',
      medicalRecordNumber: '',
      occupation: '',
      ehrId: '',
      healthPlanName: '',
      insuranceMemberId: '',
    },
  });

  const genderValue = watch('gender');
  const healthCoverageTypeWatch = watch('healthCoverageType');

  useEffect(() => {
    if (!patient) return;
    reset({
      name: patient.name,
      cpf: patient.cpf ?? '',
      birthDate: patient.birthDate?.slice(0, 10) ?? '',
      gender:
        patient.gender === 'male' ||
        patient.gender === 'female' ||
        patient.gender === 'other'
          ? patient.gender
          : undefined,
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      medicalRecordNumber: patient.medicalRecordNumber ?? '',
      occupation: patient.occupation ?? '',
      ehrId: patient.ehrPatientId ?? '',
      healthCoverageType:
        patient.healthCoverageType === 'PRIVATE' ||
        patient.healthCoverageType === 'HEALTH_PLAN'
          ? patient.healthCoverageType
          : undefined,
      healthPlanName: patient.healthPlanName ?? '',
      insuranceMemberId: patient.insuranceMemberId ?? '',
    });
  }, [patient, reset]);

  const onSubmit = async (values: PatientRegistrationFormData) => {
    try {
      await registrationUpdate.mutateAsync({
        id: patientId,
        data: toRegistrationPayload(values),
      });
      toast.success('Cadastro atualizado.');
      router.push('/patients');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Não foi possível salvar o cadastro.'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          Carregando dados do paciente...
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6">
        <div className="text-destructive">
          Erro ao carregar paciente:{' '}
          {error instanceof Error ? error.message : 'Paciente não encontrado'}
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/patients')}
          className="mt-4"
        >
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => router.push('/patients')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Cadastro do paciente</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Apenas dados administrativos — informações clínicas não podem ser
              alteradas neste perfil.
            </p>
          </div>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identificação e contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Nome completo *
                </label>
                <Input
                  {...register('name')}
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  className={cn(errors.name && 'border-destructive')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">CPF</label>
                <Input
                  {...register('cpf')}
                  autoComplete="off"
                  aria-invalid={!!errors.cpf}
                  className={cn(errors.cpf && 'border-destructive')}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Data de nascimento *
                </label>
                <Input
                  type="date"
                  {...register('birthDate')}
                  aria-invalid={!!errors.birthDate}
                  className={cn(errors.birthDate && 'border-destructive')}
                />
                {errors.birthDate && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.birthDate.message}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Género</label>
                <Select
                  value={genderValue ?? ''}
                  onValueChange={(v) =>
                    setValue('gender', v as PatientRegistrationFormData['gender'], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger
                    aria-invalid={!!errors.gender}
                    className={cn(errors.gender && 'border-destructive')}
                  >
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Feminino</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Telefone</label>
                <Input
                  {...register('phone')}
                  placeholder="+5511999999999"
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                  className={cn(errors.phone && 'border-destructive')}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">E-mail</label>
                <Input
                  type="email"
                  {...register('email')}
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  className={cn(errors.email && 'border-destructive')}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cobertura de saúde</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">
                  Tipo de cobertura
                </label>
                <Select
                  value={
                    healthCoverageTypeWatch === 'PRIVATE' ||
                    healthCoverageTypeWatch === 'HEALTH_PLAN'
                      ? healthCoverageTypeWatch
                      : HEALTH_COVERAGE_NONE
                  }
                  onValueChange={(value) => {
                    if (value === HEALTH_COVERAGE_NONE) {
                      setValue('healthCoverageType', undefined, {
                        shouldValidate: true,
                      });
                      setValue('healthPlanName', '', { shouldValidate: true });
                      setValue('insuranceMemberId', '', {
                        shouldValidate: true,
                      });
                      return;
                    }
                    setValue(
                      'healthCoverageType',
                      value as PatientRegistrationFormData['healthCoverageType'],
                      { shouldValidate: true }
                    );
                    if (value === 'PRIVATE') {
                      setValue('healthPlanName', '', { shouldValidate: true });
                      setValue('insuranceMemberId', '', {
                        shouldValidate: true,
                      });
                    }
                  }}
                >
                  <SelectTrigger
                    aria-invalid={!!errors.healthCoverageType}
                    className={cn(
                      errors.healthCoverageType && 'border-destructive'
                    )}
                  >
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={HEALTH_COVERAGE_NONE}>
                      Não informado
                    </SelectItem>
                    <SelectItem value="PRIVATE">Particular</SelectItem>
                    <SelectItem value="HEALTH_PLAN">Plano de saúde</SelectItem>
                  </SelectContent>
                </Select>
                {errors.healthCoverageType && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.healthCoverageType.message}
                  </p>
                )}
              </div>
              {healthCoverageTypeWatch === 'HEALTH_PLAN' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Nome do plano *
                    </label>
                    <Input
                      {...register('healthPlanName')}
                      autoComplete="off"
                      aria-invalid={!!errors.healthPlanName}
                      className={cn(
                        errors.healthPlanName && 'border-destructive'
                      )}
                    />
                    {errors.healthPlanName && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.healthPlanName.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      N.º da carteirinha
                    </label>
                    <Input
                      {...register('insuranceMemberId')}
                      autoComplete="off"
                      aria-invalid={!!errors.insuranceMemberId}
                      className={cn(
                        errors.insuranceMemberId && 'border-destructive'
                      )}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registos hospitalares</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  N.º do prontuário
                </label>
                <Input {...register('medicalRecordNumber')} autoComplete="off" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Ocupação</label>
                <Input {...register('occupation')} autoComplete="organization-title" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">
                  ID no sistema externo (EHR/PMS)
                </label>
                <Input {...register('ehrId')} autoComplete="off" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/patients')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || registrationUpdate.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Guardar cadastro
          </Button>
        </div>
      </form>
    </div>
  );
}
