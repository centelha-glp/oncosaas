'use client';

import { usePatientDetail } from '@/hooks/use-patient-detail';
import { usePatientUpdate } from '@/hooks/use-patient-update';
import { patientsApi } from '@/lib/api/patients';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createPatientSchema,
  CreatePatientFormData,
} from '@/lib/validations/patient';
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
import { ArrowLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { ComorbiditiesForm } from './comorbidities-form';
import { FamilyHistoryForm } from './family-history-form';
import {
  T_STAGE_VALUES,
  N_STAGE_VALUES,
  M_STAGE_VALUES,
  GRADE_VALUES,
} from '@/lib/validations/cancer-diagnosis';

/**
 * Calcula o campo stage a partir dos campos TNM estruturados
 * @param tStage T stage (T1-T4, Tis, Tx)
 * @param nStage N stage (N0-N3, Nx)
 * @param mStage M stage (M0, M1, Mx)
 * @param grade Grade (G1-G4, Gx)
 * @returns String formatada como "T2N1M0 G2" ou null se não houver dados suficientes
 */
function calculateStageFromTNM(
  tStage?: string | null,
  nStage?: string | null,
  mStage?: string | null,
  grade?: string | null
): string | null {
  const parts: string[] = [];

  if (tStage && tStage !== 'Tx') {
    parts.push(tStage);
  }
  if (nStage && nStage !== 'Nx') {
    parts.push(nStage);
  }
  if (mStage && mStage !== 'Mx') {
    parts.push(mStage);
  }

  if (parts.length === 0) {
    return null;
  }

  const tnmString = parts.join('');
  if (grade && grade !== 'Gx') {
    return `${tnmString} ${grade}`;
  }

  return tnmString;
}

interface PatientEditPageProps {
  patientId: string;
}

export function PatientEditPage({ patientId }: PatientEditPageProps) {
  const { data: patient, isLoading, error } = usePatientDetail(patientId);
  const updateMutation = usePatientUpdate();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CreatePatientFormData>({
    resolver: zodResolver(createPatientSchema),
  });

  // Função para formatar telefone para exibição (converte 55XXXXXXXXXXX para formato brasileiro)
  const formatPhoneForDisplay = (phone: string | null | undefined): string => {
    if (!phone) return '';

    // Remover caracteres não numéricos
    const digits = phone.replace(/\D/g, '');

    // Se começa com 55 (código do país), remover
    if (digits.startsWith('55') && digits.length >= 12) {
      const withoutCountryCode = digits.substring(2);

      // Formatar como (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
      if (withoutCountryCode.length === 11) {
        // Celular: (XX) XXXXX-XXXX
        return `(${withoutCountryCode.substring(0, 2)}) ${withoutCountryCode.substring(2, 7)}-${withoutCountryCode.substring(7)}`;
      } else if (withoutCountryCode.length === 10) {
        // Fixo: (XX) XXXX-XXXX
        return `(${withoutCountryCode.substring(0, 2)}) ${withoutCountryCode.substring(2, 6)}-${withoutCountryCode.substring(6)}`;
      }

      return withoutCountryCode;
    }

    // Se já está formatado ou em outro formato, retornar como está
    return phone;
  };

  // Preencher formulário com dados do paciente quando carregar
  useEffect(() => {
    if (patient && !isLoading) {
      // Obter cancerType do primeiro diagnóstico ativo ou do campo legacy
      const primaryDiagnosis =
        patient.cancerDiagnoses?.find((d) => d.isPrimary && d.isActive) ||
        patient.cancerDiagnoses?.[0];
      const cancerType =
        primaryDiagnosis?.cancerType ||
        (patient.cancerType && patient.cancerType.trim() !== ''
          ? patient.cancerType
          : null) ||
        null;

      // Obter stage do primeiro diagnóstico ativo ou do campo legacy
      const stage =
        primaryDiagnosis?.stage ||
        (patient.stage && patient.stage.trim() !== '' ? patient.stage : null) ||
        null;

      // Obter campos TNM estruturados do primeiro diagnóstico ativo
      const tStage = primaryDiagnosis?.tStage || null;
      const nStage = primaryDiagnosis?.nStage || null;
      const mStage = primaryDiagnosis?.mStage || null;
      const grade = primaryDiagnosis?.grade || null;

      // Obter diagnosisDate do primeiro diagnóstico ativo ou do campo legacy
      const diagnosisDate = primaryDiagnosis?.diagnosisDate
        ? format(new Date(primaryDiagnosis.diagnosisDate), 'yyyy-MM-dd')
        : patient.diagnosisDate
          ? format(new Date(patient.diagnosisDate), 'yyyy-MM-dd')
          : null;

      // Converter performanceStatus para número se vier como string
      let performanceStatusValue: number | undefined = undefined;
      if (
        patient.performanceStatus !== null &&
        patient.performanceStatus !== undefined
      ) {
        if (typeof patient.performanceStatus === 'string') {
          const parsed = parseInt(patient.performanceStatus, 10);
          performanceStatusValue = isNaN(parsed) ? undefined : parsed;
        } else if (typeof patient.performanceStatus === 'number') {
          performanceStatusValue = patient.performanceStatus;
        }
      }

      const formData: Partial<CreatePatientFormData> = {
        name: patient.name || '',
        cpf: patient.cpf || '',
        birthDate: patient.birthDate
          ? format(new Date(patient.birthDate), 'yyyy-MM-dd')
          : '',
        // Garantir que gender seja uma string válida ou undefined (não null)
        gender:
          patient.gender && ['male', 'female', 'other'].includes(patient.gender)
            ? (patient.gender as 'male' | 'female' | 'other')
            : undefined,
        phone: formatPhoneForDisplay(patient.phone),
        email: patient.email || '',
        // Manter valores como strings quando existirem
        cancerType: (cancerType ||
          undefined) as CreatePatientFormData['cancerType'],
        stage: stage || undefined,
        // Campos TNM estruturados
        tStage: (tStage || undefined) as CreatePatientFormData['tStage'],
        nStage: (nStage || undefined) as CreatePatientFormData['nStage'],
        mStage: (mStage || undefined) as CreatePatientFormData['mStage'],
        grade: (grade || undefined) as CreatePatientFormData['grade'],
        diagnosisDate: diagnosisDate || undefined,
        // currentStage deve ser uma string válida do enum JourneyStage
        currentStage: (patient.currentStage &&
        typeof patient.currentStage === 'string' &&
        patient.currentStage.trim() !== ''
          ? patient.currentStage
          : undefined) as CreatePatientFormData['currentStage'] | undefined,
        // performanceStatus deve ser um número (não string) para o schema Zod
        performanceStatus: performanceStatusValue,
        smokingHistory: patient.smokingHistory || '',
        alcoholHistory: patient.alcoholHistory || '',
        occupationalExposure: patient.occupationalExposure || '',
        comorbidities: Array.isArray(patient.comorbidities)
          ? patient.comorbidities
          : [],
        familyHistory: Array.isArray(patient.familyHistory)
          ? patient.familyHistory
          : [],
        ehrPatientId: patient.ehrPatientId || undefined,
      };

      // Usar reset com keepDefaultValues: false para garantir que todos os valores sejam aplicados
      reset(formData, {
        keepDefaultValues: false,
        keepValues: false,
      });

      // Garantir que os valores sejam aplicados explicitamente nos campos Select
      // Isso é necessário porque alguns componentes Select podem não sincronizar corretamente com reset
      if (formData.cancerType) {
        setValue('cancerType', formData.cancerType, { shouldValidate: false });
      }
      if (formData.currentStage) {
        setValue('currentStage', formData.currentStage, {
          shouldValidate: false,
        });
      }
      if (formData.performanceStatus !== undefined) {
        setValue('performanceStatus', formData.performanceStatus, {
          shouldValidate: false,
        });
      }
      if (formData.diagnosisDate) {
        setValue('diagnosisDate', formData.diagnosisDate, {
          shouldValidate: false,
        });
      }
      // Campos TNM
      if (formData.tStage) {
        setValue('tStage', formData.tStage, { shouldValidate: false });
      }
      if (formData.nStage) {
        setValue('nStage', formData.nStage, { shouldValidate: false });
      }
      if (formData.mStage) {
        setValue('mStage', formData.mStage, { shouldValidate: false });
      }
      if (formData.grade) {
        setValue('grade', formData.grade, { shouldValidate: false });
      }
    }
  }, [patient, isLoading, reset, setValue]);

  // Atualizar campo stage automaticamente quando campos TNM mudarem
  const tStage = watch('tStage');
  const nStage = watch('nStage');
  const mStage = watch('mStage');
  const grade = watch('grade');

  useEffect(() => {
    const calculatedStage = calculateStageFromTNM(
      tStage,
      nStage,
      mStage,
      grade
    );
    if (calculatedStage !== null) {
      setValue('stage', calculatedStage, { shouldValidate: false });
    } else {
      // Se não houver campos TNM preenchidos, limpar o campo stage
      setValue('stage', undefined, { shouldValidate: false });
    }
  }, [tStage, nStage, mStage, grade, setValue]);

  const onSubmit = async (data: CreatePatientFormData) => {
    // Normalizar telefone para formato aceito pelo validador IsPhoneNumber('BR')
    // O validador aceita formatos como: +5511999999999, 5511999999999, (11) 99999-9999
    // O backend normaliza depois para 55XXXXXXXXXXX
    const normalizePhone = (phone: string): string => {
      // Remover caracteres não numéricos exceto + e espaços/parenteses/hífens
      const cleaned = phone.trim();

      // Se já está no formato E.164 (+55...), manter
      if (cleaned.startsWith('+55')) {
        return cleaned;
      }

      // Se já começa com 55, adicionar +
      if (cleaned.replace(/\D/g, '').startsWith('55')) {
        return '+' + cleaned.replace(/\D/g, '');
      }

      // Para outros formatos brasileiros, converter para E.164
      const digits = cleaned.replace(/\D/g, '');

      // Se começa com 0, remover
      const withoutZero = digits.startsWith('0') ? digits.substring(1) : digits;

      // Validar tamanho (DDD (2) + número (8-9) = 10-11 dígitos)
      if (withoutZero.length < 10 || withoutZero.length > 11) {
        throw new Error('Telefone inválido. Use o formato (XX) XXXXX-XXXX');
      }

      // Adicionar código do país e retornar no formato E.164
      return '+55' + withoutZero;
    };

    const updateData: any = {};

    // Apenas incluir campos que foram alterados ou são obrigatórios
    if (data.name) updateData.name = data.name;
    if (data.cpf !== undefined) updateData.cpf = data.cpf || undefined;
    if (data.birthDate) updateData.birthDate = data.birthDate;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.phone) updateData.phone = normalizePhone(data.phone);
    if (data.email !== undefined) updateData.email = data.email || undefined;
    if (data.cancerType !== undefined)
      updateData.cancerType = data.cancerType || undefined;
    // Permitir valores vazios para stage (converter string vazia para undefined)
    if (data.stage !== undefined) {
      updateData.stage =
        data.stage && data.stage.trim().length > 0
          ? data.stage.trim()
          : undefined;
    }
    if (data.diagnosisDate !== undefined)
      updateData.diagnosisDate = data.diagnosisDate || undefined;
    if (data.smokingHistory !== undefined)
      updateData.smokingHistory = data.smokingHistory || undefined;
    if (data.alcoholHistory !== undefined)
      updateData.alcoholHistory = data.alcoholHistory || undefined;
    if (data.occupationalExposure !== undefined)
      updateData.occupationalExposure = data.occupationalExposure || undefined;
    if (data.ehrPatientId !== undefined)
      updateData.ehrId = data.ehrPatientId || undefined;

    // Comorbidades - apenas se houver itens válidos e completos
    if (data.comorbidities !== undefined) {
      if (data.comorbidities.length > 0) {
        const validComorbidities = data.comorbidities
          .filter(
            (c: any) =>
              c &&
              typeof c === 'object' &&
              c.name &&
              typeof c.name === 'string' &&
              c.name.trim().length > 0 &&
              c.severity &&
              typeof c.severity === 'string' &&
              typeof c.controlled === 'boolean'
          )
          .map((c: any) => ({
            name: c.name.trim(),
            severity: c.severity,
            controlled: c.controlled,
          }));
        updateData.comorbidities = validComorbidities;
      } else {
        // Array vazio explícito
        updateData.comorbidities = [];
      }
    }

    // História familiar - apenas se houver itens válidos e completos
    if (data.familyHistory !== undefined) {
      if (data.familyHistory.length > 0) {
        const validHistory = data.familyHistory
          .filter(
            (h: any) =>
              h &&
              typeof h === 'object' &&
              h.relationship &&
              typeof h.relationship === 'string' &&
              h.relationship.trim().length > 0 &&
              h.cancerType &&
              typeof h.cancerType === 'string' &&
              h.cancerType.trim().length > 0
          )
          .map((h: any) => ({
            relationship: h.relationship.trim(),
            cancerType: h.cancerType.trim(),
            ageAtDiagnosis:
              h.ageAtDiagnosis !== undefined && h.ageAtDiagnosis !== null
                ? Number(h.ageAtDiagnosis)
                : undefined,
          }));
        updateData.familyHistory = validHistory;
      } else {
        // Array vazio explícito
        updateData.familyHistory = [];
      }
    }

    // currentStage e performanceStatus não devem ser atualizados via este endpoint
    // Eles são gerenciados por outros endpoints específicos

    try {
      // Atualizar paciente
      await updateMutation.mutateAsync({ id: patientId, data: updateData });

      // Se houver campos TNM ou outros campos de diagnóstico, atualizar o diagnóstico primário
      const primaryDiagnosis =
        patient?.cancerDiagnoses?.find((d) => d.isPrimary && d.isActive) ||
        patient?.cancerDiagnoses?.[0];

      if (
        primaryDiagnosis &&
        (data.tStage !== undefined ||
          data.nStage !== undefined ||
          data.mStage !== undefined ||
          data.grade !== undefined ||
          data.cancerType !== undefined ||
          data.diagnosisDate !== undefined)
      ) {
        const diagnosisUpdateData: any = {};

        if (data.tStage !== undefined)
          diagnosisUpdateData.tStage = data.tStage || undefined;
        if (data.nStage !== undefined)
          diagnosisUpdateData.nStage = data.nStage || undefined;
        if (data.mStage !== undefined)
          diagnosisUpdateData.mStage = data.mStage || undefined;
        if (data.grade !== undefined)
          diagnosisUpdateData.grade = data.grade || undefined;
        if (data.cancerType !== undefined)
          diagnosisUpdateData.cancerType = data.cancerType || undefined;
        if (data.diagnosisDate !== undefined) {
          diagnosisUpdateData.diagnosisDate = data.diagnosisDate || undefined;
        }

        // Atualizar diagnóstico se houver campos para atualizar
        if (Object.keys(diagnosisUpdateData).length > 0) {
          await patientsApi.updateCancerDiagnosis(
            patientId,
            primaryDiagnosis.id,
            diagnosisUpdateData
          );
        }
      }

      toast.success('Paciente atualizado com sucesso!');
      router.push(`/patients/${patientId}`);
    } catch (error: any) {
      toast.error(`Erro ao atualizar paciente: ${error.message}`);
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
          {error?.message || 'Paciente não encontrado'}
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

  const currentStage = watch('currentStage');

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/patients/${patientId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Paciente</h1>
            <p className="text-muted-foreground mt-1">{patient.name}</p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <form key={patientId} onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Dados Básicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Nome Completo *
                </label>
                <Input
                  {...register('name')}
                  placeholder="Nome completo do paciente"
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
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                {errors.cpf && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.cpf.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
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
                <label className="text-sm font-medium mb-2 block">Sexo *</label>
                <Select
                  value={watch('gender') || ''}
                  onValueChange={(value) => {
                    if (value === '') {
                      setValue('gender', undefined, { shouldValidate: true });
                    } else {
                      setValue('gender', value as 'male' | 'female' | 'other', {
                        shouldValidate: true,
                      });
                    }
                  }}
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
                <label className="text-sm font-medium mb-2 block">
                  Telefone *
                </label>
                <Input {...register('phone')} placeholder="(00) 00000-0000" />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">E-mail</label>
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
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Dados Oncológicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Estágio da Jornada *
                </label>
                <Select
                  value={watch('currentStage') || ''}
                  onValueChange={(value) => {
                    if (value === '') {
                      setValue('currentStage', undefined, {
                        shouldValidate: true,
                      });
                    } else {
                      setValue(
                        'currentStage',
                        value as CreatePatientFormData['currentStage'],
                        { shouldValidate: true }
                      );
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estágio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCREENING">Rastreio</SelectItem>
                    <SelectItem value="NAVIGATION">Navegação</SelectItem>
                    <SelectItem value="DIAGNOSIS">Diagnóstico</SelectItem>
                    <SelectItem value="TREATMENT">Tratamento</SelectItem>
                    <SelectItem value="FOLLOW_UP">Seguimento</SelectItem>
                  </SelectContent>
                </Select>
                {errors.currentStage && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.currentStage.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Tipo de Câncer
                </label>
                <Select
                  value={watch('cancerType') || ''}
                  onValueChange={(value) => {
                    if (value === '') {
                      setValue('cancerType', undefined, {
                        shouldValidate: true,
                      });
                    } else {
                      setValue(
                        'cancerType',
                        value as CreatePatientFormData['cancerType'],
                        { shouldValidate: true }
                      );
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breast">Mama</SelectItem>
                    <SelectItem value="lung">Pulmão</SelectItem>
                    <SelectItem value="colorectal">Colorretal</SelectItem>
                    <SelectItem value="prostate">Próstata</SelectItem>
                    <SelectItem value="kidney">Rim</SelectItem>
                    <SelectItem value="bladder">Bexiga</SelectItem>
                    <SelectItem value="testicular">Testículo</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
                {errors.cancerType && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.cancerType.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Estágio (calculado automaticamente)
                </label>
                <Input
                  {...register('stage')}
                  placeholder="Preencha os campos TNM abaixo"
                  value={watch('stage') ?? ''}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                {errors.stage && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.stage.message}
                  </p>
                )}
              </div>
            </div>

            {/* Campos TNM Estruturados */}
            <div className="mt-3">
              <label className="text-sm font-medium mb-2 block">
                Estadiamento TNM Estruturado
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">T</label>
                  <Select
                    value={watch('tStage') || ''}
                    onValueChange={(value) => {
                      if (value === '') {
                        setValue('tStage', undefined, { shouldValidate: true });
                      } else {
                        setValue(
                          'tStage',
                          value as (typeof T_STAGE_VALUES)[number],
                          { shouldValidate: true }
                        );
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="T" />
                    </SelectTrigger>
                    <SelectContent>
                      {T_STAGE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tStage && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.tStage.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">N</label>
                  <Select
                    value={watch('nStage') || ''}
                    onValueChange={(value) => {
                      if (value === '') {
                        setValue('nStage', undefined, { shouldValidate: true });
                      } else {
                        setValue(
                          'nStage',
                          value as (typeof N_STAGE_VALUES)[number],
                          { shouldValidate: true }
                        );
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="N" />
                    </SelectTrigger>
                    <SelectContent>
                      {N_STAGE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.nStage && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.nStage.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">M</label>
                  <Select
                    value={watch('mStage') || ''}
                    onValueChange={(value) => {
                      if (value === '') {
                        setValue('mStage', undefined, { shouldValidate: true });
                      } else {
                        setValue(
                          'mStage',
                          value as (typeof M_STAGE_VALUES)[number],
                          { shouldValidate: true }
                        );
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="M" />
                    </SelectTrigger>
                    <SelectContent>
                      {M_STAGE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.mStage && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.mStage.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Grau</label>
                  <Select
                    value={watch('grade') || ''}
                    onValueChange={(value) => {
                      if (value === '') {
                        setValue('grade', undefined, { shouldValidate: true });
                      } else {
                        setValue(
                          'grade',
                          value as (typeof GRADE_VALUES)[number],
                          { shouldValidate: true }
                        );
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Grau" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.grade && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.grade.message}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                O campo "Estágio" acima será calculado automaticamente a partir
                dos campos TNM preenchidos.
              </p>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Data de Diagnóstico
                  {currentStage !== 'SCREENING' && ' *'}
                </label>
                <Input type="date" {...register('diagnosisDate')} />
                {errors.diagnosisDate && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.diagnosisDate.message}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Performance Status
                </label>
                <Select
                  value={
                    watch('performanceStatus') !== null &&
                    watch('performanceStatus') !== undefined
                      ? String(watch('performanceStatus'))
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
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">ECOG 0</SelectItem>
                    <SelectItem value="1">ECOG 1</SelectItem>
                    <SelectItem value="2">ECOG 2</SelectItem>
                    <SelectItem value="3">ECOG 3</SelectItem>
                    <SelectItem value="4">ECOG 4</SelectItem>
                  </SelectContent>
                </Select>
                {errors.performanceStatus && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.performanceStatus.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Comorbidades e Fatores de Risco</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Histórico de Tabagismo
              </label>
              <Input
                {...register('smokingHistory')}
                placeholder="Ex: nunca fumou, ex-fumante (10 anos-maço), fumante atual (20 anos-maço)"
              />
              {errors.smokingHistory && (
                <p className="text-sm text-destructive mt-1">
                  {errors.smokingHistory.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Histórico de Álcool
              </label>
              <Input
                {...register('alcoholHistory')}
                placeholder="Ex: nunca, ocasional, moderado (20g/dia), pesado (60g/dia)"
              />
              {errors.alcoholHistory && (
                <p className="text-sm text-destructive mt-1">
                  {errors.alcoholHistory.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Exposição Ocupacional
              </label>
              <Input
                {...register('occupationalExposure')}
                placeholder="Ex: amianto, benzeno, radiação"
              />
              {errors.occupationalExposure && (
                <p className="text-sm text-destructive mt-1">
                  {errors.occupationalExposure.message}
                </p>
              )}
            </div>

            <div>
              <ComorbiditiesForm
                value={watch('comorbidities') as any}
                onChange={(comorbidities) =>
                  setValue('comorbidities', comorbidities as any)
                }
              />
              {errors.comorbidities && (
                <p className="text-sm text-destructive mt-1">
                  {errors.comorbidities.message}
                </p>
              )}
            </div>

            <div>
              <FamilyHistoryForm
                value={watch('familyHistory') as any}
                onChange={(familyHistory) =>
                  setValue('familyHistory', familyHistory as any)
                }
              />
              {errors.familyHistory && (
                <p className="text-sm text-destructive mt-1">
                  {errors.familyHistory.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Integração EHR (Opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm font-medium mb-2 block">
                ID do Paciente no EHR
              </label>
              <Input
                {...register('ehrPatientId')}
                placeholder="ID do paciente no sistema EHR"
              />
              {errors.ehrPatientId && (
                <p className="text-sm text-destructive mt-1">
                  {errors.ehrPatientId.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/patients/${patientId}`)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </div>
  );
}
