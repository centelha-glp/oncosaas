'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePatientDetail } from '@/hooks/use-patient-detail';
import { usePatientUpdate } from '@/hooks/use-patient-update';
import {
  patientsApi,
  type ComorbiditySeverity,
  type ComorbidityType,
} from '@/lib/api/patients';
import {
  Controller,
  useForm,
  type FieldErrors,
  type Path,
} from 'react-hook-form';
import {
  collectAllFormErrorMessages,
  messagesFromZodError,
} from '@/lib/utils/form-field-errors';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  editPatientSchema,
  EditPatientFormData,
} from '@/lib/validations/patient';
import { getTreatmentOptionsForCancerType } from '@/lib/utils/patient-cancer-type';
import {
  JOURNEY_STAGE_LABELS,
  requiresCurrentTreatmentField,
  requiresOncologyCoreFields,
} from '@/lib/utils/journey-stage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
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
import { format } from 'date-fns';
import { useEffect } from 'react';
import { ComorbiditiesForm } from './comorbidities-form';
import { CurrentMedicationsForm } from './current-medications-form';
import { FamilyHistoryForm } from './family-history-form';
import { PriorClinicalHistoryForm } from './prior-clinical-history-form';
import { StructuredClinicalRisksForm } from './structured-clinical-risks-form';
import {
  T_STAGE_VALUES,
  N_STAGE_VALUES,
  M_STAGE_VALUES,
  GRADE_VALUES,
} from '@/lib/validations/cancer-diagnosis';
import { getCancerTypeKey } from '@/lib/utils/patient-cancer-type';
import { useEnabledCancerTypes } from '@/hooks/useEnabledCancerTypes';
import { cn } from '@/lib/utils';
import {
  patientEditFieldId,
  scrollFieldPathIntoView,
} from '@/lib/utils/patient-form-anchors';
import type {
  PriorHospitalizationItem,
  PriorSurgeryItem,
} from '@/lib/api/patients';

function normalizePriorSurgeries(raw: unknown): PriorSurgeryItem[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        procedureName:
          typeof o.procedureName === 'string' ? o.procedureName : '',
        year: typeof o.year === 'number' ? o.year : undefined,
        institution:
          typeof o.institution === 'string' ? o.institution : undefined,
        notes: typeof o.notes === 'string' ? o.notes : undefined,
      };
    });
}

function normalizePriorHospitalizations(
  raw: unknown
): PriorHospitalizationItem[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        summary: typeof o.summary === 'string' ? o.summary : '',
        year: typeof o.year === 'number' ? o.year : undefined,
        durationDays:
          typeof o.durationDays === 'number' ? o.durationDays : undefined,
        notes: typeof o.notes === 'string' ? o.notes : undefined,
      };
    });
}

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

function fieldErrorText(err: { message?: unknown } | undefined): string {
  const m = err?.message;
  return typeof m === 'string' ? m : '';
}

/** Primeiro path com erro, para foco (ex.: comorbidities.0.name). */
function firstErrorFieldPath(
  errs: FieldErrors<EditPatientFormData>
): Path<EditPatientFormData> | undefined {
  function walk(obj: unknown, prefix: string): string | undefined {
    if (obj == null || typeof obj !== 'object') return undefined;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const p = prefix ? `${prefix}.${i}` : String(i);
        const sub = walk(obj[i], p);
        if (sub) return sub;
      }
      return undefined;
    }
    const o = obj as Record<string, unknown>;
    if (
      'message' in o &&
      typeof o.message === 'string' &&
      o.message.length > 0
    ) {
      return prefix || undefined;
    }
    for (const [k, v] of Object.entries(o)) {
      if (k === 'ref') continue;
      const next = prefix ? `${prefix}.${k}` : k;
      const sub = walk(v, next);
      if (sub) return sub;
    }
    return undefined;
  }
  return walk(errs, '') as Path<EditPatientFormData> | undefined;
}

export function PatientEditPage({ patientId }: PatientEditPageProps) {
  const { data: patient, isLoading, error } = usePatientDetail(patientId);
  const updateMutation = usePatientUpdate();
  const router = useRouter();
  const { labels: enabledCancerLabels } = useEnabledCancerTypes();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    setFocus,
    control,
    formState: { errors },
    watch,
    setValue,
    reset,
    getValues,
  } = useForm<EditPatientFormData>({
    resolver: zodResolver(editPatientSchema),
    shouldFocusError: true,
    criteriaMode: 'all',
    defaultValues: {
      name: '',
      cpf: '',
      birthDate: '',
      phone: '',
      email: '',
      currentStage: 'SCREENING',
      currentTreatment: '',
      smokingHistory: '',
      alcoholHistory: '',
      occupationalExposure: '',
      allergies: '',
      comorbidities: [],
      currentMedications: [],
      familyHistory: [],
      priorSurgeries: [],
      priorHospitalizations: [],
      occupationalExposureEntries: [],
      allergyEntries: [],
    },
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
    if (patient) {
      // Obter cancerType do primeiro diagnóstico ativo ou do campo legacy (pode vir em PT ou EN)
      const primaryDiagnosis =
        patient.cancerDiagnoses?.find((d) => d.isPrimary && d.isActive) ||
        patient.cancerDiagnoses?.[0];
      const cancerTypeRaw =
        primaryDiagnosis?.cancerType ||
        (patient.cancerType && patient.cancerType.trim() !== ''
          ? patient.cancerType
          : null) ||
        null;
      // Normalizar para chave do Select (ex: "Pulmão" -> "lung")
      const cancerType = getCancerTypeKey(cancerTypeRaw) ?? cancerTypeRaw;

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

      // Normalizar sexo: API pode retornar "MALE", "M", "Masculino", etc.
      const genderRaw = patient.gender?.toString?.()?.trim?.() ?? '';
      const genderNormalized = (() => {
        const g = genderRaw.toLowerCase();
        if (['male', 'female', 'other'].includes(g))
          return g as 'male' | 'female' | 'other';
        if (g === 'm' || g === 'masculino') return 'male' as const;
        if (g === 'f' || g === 'feminino') return 'female' as const;
        return undefined;
      })();

      // Normalizar currentStage: sempre um valor válido para o Select (default SCREENING)
      const STAGES = [
        'SCREENING',
        'DIAGNOSIS',
        'TREATMENT',
        'FOLLOW_UP',
        'PALLIATIVE',
      ] as const;
      const currentStageRaw =
        patient.currentStage?.toString?.()?.trim?.()?.toUpperCase?.() ?? '';
      const currentStageNormalized = (STAGES as readonly string[]).includes(
        currentStageRaw
      )
        ? (currentStageRaw as EditPatientFormData['currentStage'])
        : ('SCREENING' as EditPatientFormData['currentStage']);

      const pExt = patient as typeof patient & {
        smokingProfile?: EditPatientFormData['smokingProfile'];
        alcoholProfile?: EditPatientFormData['alcoholProfile'];
        occupationalExposureEntries?: EditPatientFormData['occupationalExposureEntries'];
        allergyEntries?: EditPatientFormData['allergyEntries'];
      };

      let smokingProfile = pExt.smokingProfile;
      if (!smokingProfile && patient.smokingHistory?.trim()) {
        smokingProfile = { notes: `Texto legado: ${patient.smokingHistory}` };
      }

      let alcoholProfile = pExt.alcoholProfile;
      if (!alcoholProfile && patient.alcoholHistory?.trim()) {
        alcoholProfile = { notes: `Texto legado: ${patient.alcoholHistory}` };
      }

      let occupationalExposureEntries = Array.isArray(
        pExt.occupationalExposureEntries
      )
        ? pExt.occupationalExposureEntries
        : [];
      if (
        occupationalExposureEntries.length === 0 &&
        patient.occupationalExposure?.trim()
      ) {
        occupationalExposureEntries = [
          { agent: patient.occupationalExposure ?? '', notes: 'Texto legado' },
        ];
      }

      const allergyEntriesRaw = Array.isArray(pExt.allergyEntries)
        ? pExt.allergyEntries
        : [];
      const allergyEntries = allergyEntriesRaw.map(
        (e: {
          substanceKey?: string;
          customLabel?: string;
          reactionNotes?: string;
        }) => ({
          substanceKey: e.substanceKey ?? '',
          customLabel: e.customLabel,
          reactionNotes: e.reactionNotes,
        })
      );

      const patientWithTreatment = patient as typeof patient & {
        currentTreatment?: string | null;
      };

      const formData: Partial<EditPatientFormData> = {
        name: patient.name || '',
        cpf: patient.cpf || '',
        birthDate: patient.birthDate
          ? format(new Date(patient.birthDate), 'yyyy-MM-dd')
          : '',
        gender: genderNormalized,
        phone: formatPhoneForDisplay(patient.phone),
        email: patient.email || '',
        currentTreatment: patientWithTreatment.currentTreatment?.trim() || '',
        cancerType: (cancerType ||
          undefined) as EditPatientFormData['cancerType'],
        stage: stage || undefined,
        tStage: (tStage || undefined) as EditPatientFormData['tStage'],
        nStage: (nStage || undefined) as EditPatientFormData['nStage'],
        mStage: (mStage || undefined) as EditPatientFormData['mStage'],
        grade: (grade || undefined) as EditPatientFormData['grade'],
        diagnosisDate: diagnosisDate || undefined,
        currentStage: currentStageNormalized,
        // performanceStatus deve ser um número (não string) para o schema Zod
        performanceStatus: performanceStatusValue,
        smokingHistory: patient.smokingHistory || '',
        alcoholHistory: patient.alcoholHistory || '',
        occupationalExposure: patient.occupationalExposure || '',
        smokingProfile,
        alcoholProfile,
        occupationalExposureEntries,
        allergyEntries,
        allergies: patient.allergies || '',
        comorbidities: Array.isArray(patient.comorbidities)
          ? patient.comorbidities.map((c) => ({
              name: c.name,
              type: String(c.type),
              severity: String(c.severity),
              controlled: c.controlled ?? false,
            }))
          : [],
        currentMedications: Array.isArray(patient.medications)
          ? patient.medications.map((m) => ({
              catalogKey: m.catalogKey ?? '',
              name: m.name,
              dosage: m.dosage ?? '',
              frequency: m.frequency ?? '',
              indication: m.indication ?? '',
            }))
          : [],
        familyHistory: Array.isArray(patient.familyHistory)
          ? patient.familyHistory
          : [],
        priorSurgeries: normalizePriorSurgeries(
          (patient as { priorSurgeries?: unknown }).priorSurgeries
        ),
        priorHospitalizations: normalizePriorHospitalizations(
          (patient as { priorHospitalizations?: unknown }).priorHospitalizations
        ),
        ehrPatientId: patient.ehrPatientId || undefined,
      };

      reset(formData, {
        keepDefaultValues: false,
        keepValues: false,
      });

      // Aplicar valores dos Selects no próximo tick para o Radix Select sincronizar após o reset
      const timer = setTimeout(() => {
        if (formData.gender) {
          setValue('gender', formData.gender, { shouldValidate: false });
        }
        if (formData.cancerType) {
          setValue('cancerType', formData.cancerType, {
            shouldValidate: false,
          });
        }
        setValue('currentStage', formData.currentStage!, {
          shouldValidate: false,
        });
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
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [patient, reset, setValue]);

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

  const onSubmit = async (data: EditPatientFormData) => {
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
    if (data.smokingProfile !== undefined) {
      const sp = data.smokingProfile;
      updateData.smokingProfile =
        sp &&
        (sp.status ||
          sp.packYears != null ||
          sp.yearsQuit != null ||
          (sp.notes?.trim()?.length ?? 0) > 0)
          ? sp
          : undefined;
    }
    if (data.alcoholProfile !== undefined) {
      const ap = data.alcoholProfile;
      updateData.alcoholProfile =
        ap &&
        (ap.status ||
          ap.drinksPerWeek != null ||
          (ap.notes?.trim()?.length ?? 0) > 0)
          ? ap
          : undefined;
    }
    if (data.occupationalExposureEntries !== undefined) {
      updateData.occupationalExposureEntries =
        data.occupationalExposureEntries?.filter(
          (o: { agent?: string }) => (o.agent?.trim()?.length ?? 0) > 0
        ) ?? [];
    }
    if (data.allergyEntries !== undefined) {
      updateData.allergyEntries = data.allergyEntries
        ?.filter((a: { substanceKey?: string }) =>
          (a.substanceKey?.trim()?.length ?? 0) > 0
        )
        .map((a: {
          substanceKey?: string;
          customLabel?: string;
          reactionNotes?: string;
        }) => ({
          substanceKey: a.substanceKey!.trim(),
          customLabel:
            a.substanceKey === 'OTHER' ? a.customLabel?.trim() : undefined,
          reactionNotes: a.reactionNotes?.trim() || undefined,
        }));
    }
    if (data.allergies !== undefined)
      updateData.allergies = data.allergies?.trim() || undefined;
    if (data.ehrPatientId !== undefined)
      updateData.ehrId = data.ehrPatientId || undefined;
    if (data.currentTreatment !== undefined) {
      updateData.currentTreatment = data.currentTreatment?.trim() || undefined;
    }

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
              c.type &&
              typeof c.type === 'string'
          )
          .map((c: any) => ({
            name: c.name.trim(),
            type: c.type as ComorbidityType,
            severity: c.severity as ComorbiditySeverity,
            controlled: c.controlled ?? false,
          }));
        updateData.comorbidities = validComorbidities;
      } else {
        // Array vazio explícito
        updateData.comorbidities = [];
      }
    }

    // Medicamentos em uso
    if (data.currentMedications !== undefined) {
      if (data.currentMedications.length > 0) {
        const validMedications = data.currentMedications
          .filter(
            (m: any) =>
              m &&
              typeof m === 'object' &&
              (m.catalogKey?.trim() || m.name?.trim())
          )
          .map((m: any) => {
            const ck = m.catalogKey?.trim();
            if (ck && ck !== 'OTHER') {
              return {
                catalogKey: ck,
                dosage: m.dosage?.trim() || undefined,
                frequency: m.frequency?.trim() || undefined,
                indication: m.indication?.trim() || undefined,
              };
            }
            if (ck === 'OTHER') {
              return {
                catalogKey: 'OTHER',
                name: m.name.trim(),
                dosage: m.dosage?.trim() || undefined,
                frequency: m.frequency?.trim() || undefined,
                indication: m.indication?.trim() || undefined,
              };
            }
            return {
              name: m.name.trim(),
              dosage: m.dosage?.trim() || undefined,
              frequency: m.frequency?.trim() || undefined,
              indication: m.indication?.trim() || undefined,
            };
          });
        updateData.currentMedications = validMedications;
      } else {
        updateData.currentMedications = [];
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

    if (data.priorSurgeries !== undefined) {
      if (data.priorSurgeries.length > 0) {
        const valid = data.priorSurgeries
          .filter(
            (s: PriorSurgeryItem | { procedureName?: string }) =>
              s &&
              typeof s === 'object' &&
              typeof (s as { procedureName?: string }).procedureName ===
                'string' &&
              (s as { procedureName: string }).procedureName.trim().length > 0
          )
          .map((s: PriorSurgeryItem | { procedureName?: string }) => ({
            procedureName: (s as { procedureName: string }).procedureName.trim(),
            year:
              (s as { year?: number }).year !== undefined &&
              (s as { year?: number }).year !== null
                ? Number((s as { year?: number }).year)
                : undefined,
            institution: (s as { institution?: string }).institution?.trim() || undefined,
            notes: (s as { notes?: string }).notes?.trim() || undefined,
          }));
        updateData.priorSurgeries = valid;
      } else {
        updateData.priorSurgeries = [];
      }
    }

    if (data.priorHospitalizations !== undefined) {
      if (data.priorHospitalizations.length > 0) {
        const validH = data.priorHospitalizations
          .filter(
            (h: PriorHospitalizationItem | { summary?: string }) =>
              h &&
              typeof h === 'object' &&
              typeof (h as { summary?: string }).summary === 'string' &&
              (h as { summary: string }).summary.trim().length > 0
          )
          .map((h: PriorHospitalizationItem | { summary?: string }) => ({
            summary: (h as { summary: string }).summary.trim(),
            year:
              (h as { year?: number }).year !== undefined &&
              (h as { year?: number }).year !== null
                ? Number((h as { year?: number }).year)
                : undefined,
            durationDays:
              (h as { durationDays?: number }).durationDays !== undefined &&
              (h as { durationDays?: number }).durationDays !== null
                ? Number((h as { durationDays?: number }).durationDays)
                : undefined,
            notes: (h as { notes?: string }).notes?.trim() || undefined,
          }));
        updateData.priorHospitalizations = validH;
      } else {
        updateData.priorHospitalizations = [];
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

  /** Alinha Controllers ao Zod: `getValues()` no submit inválido pode omitir/atrasar chaves e o `.default()` do schema mascarar a fase. */
  const mergeWatchIntoValuesForZod = (): EditPatientFormData => {
    const g = getValues();
    return {
      ...g,
      name: watch('name') ?? g.name,
      birthDate: watch('birthDate') ?? g.birthDate,
      phone: watch('phone') ?? g.phone,
      email: watch('email') ?? g.email,
      gender: watch('gender') ?? g.gender,
      cpf: watch('cpf') ?? g.cpf,
      currentStage: (watch('currentStage') ??
        g.currentStage) as EditPatientFormData['currentStage'],
      cancerType: watch('cancerType') ?? g.cancerType,
      diagnosisDate: watch('diagnosisDate') ?? g.diagnosisDate,
      performanceStatus: watch('performanceStatus') ?? g.performanceStatus,
      currentTreatment: watch('currentTreatment') ?? g.currentTreatment,
      stage: watch('stage') ?? g.stage,
      tStage: watch('tStage') ?? g.tStage,
      nStage: watch('nStage') ?? g.nStage,
      mStage: watch('mStage') ?? g.mStage,
      grade: watch('grade') ?? g.grade,
      smokingProfile: watch('smokingProfile') ?? g.smokingProfile,
      alcoholProfile: watch('alcoholProfile') ?? g.alcoholProfile,
      occupationalExposureEntries:
        watch('occupationalExposureEntries') ?? g.occupationalExposureEntries,
      allergyEntries: watch('allergyEntries') ?? g.allergyEntries,
      allergies: watch('allergies') ?? g.allergies,
      comorbidities: watch('comorbidities') ?? g.comorbidities,
      currentMedications: watch('currentMedications') ?? g.currentMedications,
      familyHistory: watch('familyHistory') ?? g.familyHistory,
      priorSurgeries: watch('priorSurgeries') ?? g.priorSurgeries,
      priorHospitalizations:
        watch('priorHospitalizations') ?? g.priorHospitalizations,
      smokingHistory: watch('smokingHistory') ?? g.smokingHistory,
      alcoholHistory: watch('alcoholHistory') ?? g.alcoholHistory,
      occupationalExposure:
        watch('occupationalExposure') ?? g.occupationalExposure,
      ehrPatientId: watch('ehrPatientId') ?? g.ehrPatientId,
    };
  };

  const onValidationError = (errs: FieldErrors<EditPatientFormData>) => {
    const merged = mergeWatchIntoValuesForZod();
    const parsed = editPatientSchema.safeParse(merged);
    const messages = parsed.success
      ? collectAllFormErrorMessages(errs)
      : messagesFromZodError(parsed.error);
    const path = firstErrorFieldPath(errs);
    if (messages.length === 0) {
      toast.error('Corrija os campos destacados antes de salvar.');
    } else {
      toast.error(messages.join('\n'), {
        duration: 12_000,
        className: 'whitespace-pre-wrap text-left max-w-lg',
      });
    }
    if (path) {
      setFocus(path);
      requestAnimationFrame(() => {
        scrollFieldPathIntoView(String(path));
      });
    }
  };

  const handleDeletePatient = async () => {
    if (!patientId) return;
    setIsDeleting(true);
    try {
      await patientsApi.delete(patientId);
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.removeQueries({ queryKey: ['patient', patientId] });
      queryClient.removeQueries({ queryKey: ['patient-detail', patientId] });
      toast.success('Paciente excluído com sucesso.');
      router.replace('/patients');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status === 403
            ? 'Você não tem permissão para excluir pacientes.'
            : ((err as { message?: string }).message ?? 'Erro ao excluir.')
          : 'Erro ao excluir.';
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
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
  const cancerTypeWatch = watch('cancerType');
  const needsOncologyCoreFields = requiresOncologyCoreFields(currentStage);
  const needsTreatmentField = requiresCurrentTreatmentField(currentStage);
  const treatmentOptions = getTreatmentOptionsForCancerType(
    cancerTypeWatch ?? null,
    currentStage === 'TREATMENT'
  );

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
      <form
        key={patientId}
        noValidate
        onSubmit={handleSubmit(onSubmit, onValidationError)}
      >
        <Card>
          <CardHeader>
            <CardTitle>Dados Básicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div id={patientEditFieldId('name')}>
                <label className="text-sm font-medium mb-2 block">
                  Nome Completo *
                </label>
                <Input
                  {...register('name')}
                  placeholder="Nome completo do paciente"
                  aria-invalid={!!errors.name}
                  className={cn(errors.name && 'border-destructive')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.name)}
                  </p>
                )}
              </div>

              <div id={patientEditFieldId('cpf')}>
                <label className="text-sm font-medium mb-2 block">CPF</label>
                <Input
                  {...register('cpf')}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  aria-invalid={!!errors.cpf}
                  className={cn(errors.cpf && 'border-destructive')}
                />
                {errors.cpf && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.cpf)}
                  </p>
                )}
              </div>

              <div id={patientEditFieldId('birthDate')}>
                <label className="text-sm font-medium mb-2 block">
                  Data de Nascimento *
                </label>
                <Input
                  type="date"
                  {...register('birthDate')}
                  aria-invalid={!!errors.birthDate}
                  className={cn(errors.birthDate && 'border-destructive')}
                />
                {errors.birthDate && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.birthDate)}
                  </p>
                )}
              </div>

              <div id={patientEditFieldId('gender')}>
                <label className="text-sm font-medium mb-2 block">Sexo</label>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(value) => {
                        field.onChange(
                          value === ''
                            ? undefined
                            : (value as 'male' | 'female' | 'other')
                        );
                      }}
                    >
                      <SelectTrigger
                        ref={field.ref}
                        name={field.name}
                        onBlur={field.onBlur}
                        aria-invalid={!!errors.gender}
                        className={cn(
                          errors.gender && 'border-destructive ring-1 ring-destructive'
                        )}
                      >
                        <SelectValue placeholder="Selecione o sexo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Masculino</SelectItem>
                        <SelectItem value="female">Feminino</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.gender && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.gender)}
                  </p>
                )}
              </div>

              <div id={patientEditFieldId('phone')}>
                <label className="text-sm font-medium mb-2 block">
                  Telefone{' '}
                  <span className="text-muted-foreground font-normal">
                    (opcional)
                  </span>
                </label>
                <Input
                  {...register('phone')}
                  placeholder="(00) 00000-0000"
                  aria-invalid={!!errors.phone}
                  className={cn(errors.phone && 'border-destructive')}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.phone)}
                  </p>
                )}
              </div>

              <div id={patientEditFieldId('email')}>
                <label className="text-sm font-medium mb-2 block">E-mail</label>
                <Input
                  type="email"
                  {...register('email')}
                  placeholder="email@exemplo.com"
                  aria-invalid={!!errors.email}
                  className={cn(errors.email && 'border-destructive')}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.email)}
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
              <div id={patientEditFieldId('currentStage')}>
                <label className="text-sm font-medium mb-2 block">
                  Estágio da Jornada *
                </label>
                <Controller
                  name="currentStage"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(value) => {
                        const next =
                          (value === ''
                            ? 'SCREENING'
                            : value) as EditPatientFormData['currentStage'];
                        field.onChange(next);
                        if (
                          next !== 'TREATMENT' &&
                          next !== 'FOLLOW_UP' &&
                          next !== 'PALLIATIVE'
                        ) {
                          setValue('currentTreatment', '', {
                            shouldValidate: true,
                          });
                        }
                      }}
                    >
                      <SelectTrigger
                        ref={field.ref}
                        name={field.name}
                        onBlur={field.onBlur}
                        aria-invalid={!!errors.currentStage}
                        className={cn(
                          errors.currentStage &&
                            'border-destructive ring-1 ring-destructive'
                        )}
                      >
                        <SelectValue placeholder="Selecione o estágio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SCREENING">
                          {JOURNEY_STAGE_LABELS.SCREENING}
                        </SelectItem>
                        <SelectItem value="DIAGNOSIS">
                          {JOURNEY_STAGE_LABELS.DIAGNOSIS}
                        </SelectItem>
                        <SelectItem value="TREATMENT">
                          {JOURNEY_STAGE_LABELS.TREATMENT}
                        </SelectItem>
                        <SelectItem value="FOLLOW_UP">
                          {JOURNEY_STAGE_LABELS.FOLLOW_UP}
                        </SelectItem>
                        <SelectItem value="PALLIATIVE">
                          {JOURNEY_STAGE_LABELS.PALLIATIVE}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.currentStage && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.currentStage)}
                  </p>
                )}
              </div>

              <div id={patientEditFieldId('cancerType')}>
                <label className="text-sm font-medium mb-2 block">
                  Tipo de Câncer
                  {needsOncologyCoreFields && ' *'}
                </label>
                <Controller
                  name="cancerType"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(value) => {
                        field.onChange(
                          value === ''
                            ? undefined
                            : (value as EditPatientFormData['cancerType'])
                        );
                      }}
                    >
                      <SelectTrigger
                        ref={field.ref}
                        name={field.name}
                        onBlur={field.onBlur}
                        aria-invalid={!!errors.cancerType}
                        className={cn(
                          errors.cancerType &&
                            'border-destructive ring-1 ring-destructive'
                        )}
                      >
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(enabledCancerLabels).map(
                          ([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.cancerType && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.cancerType)}
                  </p>
                )}
              </div>

              <div id={patientEditFieldId('stage')}>
                <label className="text-sm font-medium mb-2 block">
                  Estágio (calculado automaticamente)
                  {needsOncologyCoreFields && ' *'}
                </label>
                <Input
                  {...register('stage')}
                  placeholder="Preencha os campos TNM abaixo"
                  readOnly
                  aria-readonly="true"
                  aria-invalid={!!errors.stage}
                  className={cn(
                    'bg-muted cursor-not-allowed',
                    errors.stage && 'border-destructive'
                  )}
                />
                {errors.stage && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.stage)}
                  </p>
                )}
              </div>
            </div>

            {/* Campos TNM Estruturados */}
            <div className="mt-3">
              <label className="text-sm font-medium mb-2 block">
                Estadiamento TNM Estruturado
                {needsOncologyCoreFields && ' *'}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div id={patientEditFieldId('tStage')}>
                  <label className="text-sm font-medium mb-1 block">T</label>
                  <Controller
                    name="tStage"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ''}
                        onValueChange={(value) => {
                          field.onChange(
                            value === ''
                              ? undefined
                              : (value as (typeof T_STAGE_VALUES)[number])
                          );
                        }}
                      >
                        <SelectTrigger
                          ref={field.ref}
                          name={field.name}
                          onBlur={field.onBlur}
                          aria-invalid={!!errors.tStage}
                          className={cn(
                            errors.tStage &&
                              'border-destructive ring-1 ring-destructive'
                          )}
                        >
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
                    )}
                  />
                  {errors.tStage && (
                    <p className="text-sm text-destructive mt-1">
                      {fieldErrorText(errors.tStage)}
                    </p>
                  )}
                </div>

                <div id={patientEditFieldId('nStage')}>
                  <label className="text-sm font-medium mb-1 block">N</label>
                  <Controller
                    name="nStage"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ''}
                        onValueChange={(value) => {
                          field.onChange(
                            value === ''
                              ? undefined
                              : (value as (typeof N_STAGE_VALUES)[number])
                          );
                        }}
                      >
                        <SelectTrigger
                          ref={field.ref}
                          name={field.name}
                          onBlur={field.onBlur}
                          aria-invalid={!!errors.nStage}
                          className={cn(
                            errors.nStage &&
                              'border-destructive ring-1 ring-destructive'
                          )}
                        >
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
                    )}
                  />
                  {errors.nStage && (
                    <p className="text-sm text-destructive mt-1">
                      {fieldErrorText(errors.nStage)}
                    </p>
                  )}
                </div>

                <div id={patientEditFieldId('mStage')}>
                  <label className="text-sm font-medium mb-1 block">M</label>
                  <Controller
                    name="mStage"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ''}
                        onValueChange={(value) => {
                          field.onChange(
                            value === ''
                              ? undefined
                              : (value as (typeof M_STAGE_VALUES)[number])
                          );
                        }}
                      >
                        <SelectTrigger
                          ref={field.ref}
                          name={field.name}
                          onBlur={field.onBlur}
                          aria-invalid={!!errors.mStage}
                          className={cn(
                            errors.mStage &&
                              'border-destructive ring-1 ring-destructive'
                          )}
                        >
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
                    )}
                  />
                  {errors.mStage && (
                    <p className="text-sm text-destructive mt-1">
                      {fieldErrorText(errors.mStage)}
                    </p>
                  )}
                </div>

                <div id={patientEditFieldId('grade')}>
                  <label className="text-sm font-medium mb-1 block">Grau</label>
                  <Controller
                    name="grade"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ''}
                        onValueChange={(value) => {
                          field.onChange(
                            value === ''
                              ? undefined
                              : (value as (typeof GRADE_VALUES)[number])
                          );
                        }}
                      >
                        <SelectTrigger
                          ref={field.ref}
                          name={field.name}
                          onBlur={field.onBlur}
                          aria-invalid={!!errors.grade}
                          className={cn(
                            errors.grade &&
                              'border-destructive ring-1 ring-destructive'
                          )}
                        >
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
                    )}
                  />
                  {errors.grade && (
                    <p className="text-sm text-destructive mt-1">
                      {fieldErrorText(errors.grade)}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {`O campo "Estágio" acima será calculado automaticamente a partir dos campos TNM preenchidos.`}
              </p>

              <div id={patientEditFieldId('diagnosisDate')}>
                <label className="text-sm font-medium mb-2 block">
                  Data de Diagnóstico
                  {needsOncologyCoreFields && ' *'}
                </label>
                <Input
                  type="date"
                  {...register('diagnosisDate')}
                  aria-invalid={!!errors.diagnosisDate}
                  className={cn(errors.diagnosisDate && 'border-destructive')}
                />
                {errors.diagnosisDate && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.diagnosisDate)}
                  </p>
                )}
              </div>

              <div id={patientEditFieldId('performanceStatus')}>
                <label className="text-sm font-medium mb-2 block">
                  Performance Status (ECOG)
                  {needsOncologyCoreFields && ' *'}
                </label>
                <Controller
                  name="performanceStatus"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={
                        field.value !== null && field.value !== undefined
                          ? String(field.value)
                          : ''
                      }
                      onValueChange={(value) => {
                        if (value === '' || value === undefined) {
                          field.onChange(undefined);
                        } else {
                          const numValue = parseInt(value, 10);
                          if (!isNaN(numValue)) field.onChange(numValue);
                        }
                      }}
                    >
                      <SelectTrigger
                        ref={field.ref}
                        name={field.name}
                        onBlur={field.onBlur}
                        aria-invalid={!!errors.performanceStatus}
                        className={cn(
                          errors.performanceStatus &&
                            'border-destructive ring-1 ring-destructive'
                        )}
                      >
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
                  )}
                />
                {errors.performanceStatus && (
                  <p className="text-sm text-destructive mt-1">
                    {fieldErrorText(errors.performanceStatus)}
                  </p>
                )}
              </div>

              {needsTreatmentField && (
                <div id={patientEditFieldId('currentTreatment')}>
                  <label className="text-sm font-medium mb-2 block">
                    Tratamento atual *
                  </label>
                  <Controller
                    name="currentTreatment"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ''}
                        onValueChange={(value) => field.onChange(value)}
                      >
                        <SelectTrigger
                          ref={field.ref}
                          name={field.name}
                          onBlur={field.onBlur}
                          aria-invalid={!!errors.currentTreatment}
                          className={cn(
                            errors.currentTreatment &&
                              'border-destructive ring-1 ring-destructive'
                          )}
                        >
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
                    )}
                  />
                  {errors.currentTreatment && (
                    <p className="text-sm text-destructive mt-1">
                      {fieldErrorText(errors.currentTreatment)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Comorbidades e Fatores de Risco</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StructuredClinicalRisksForm
              smokingProfile={watch('smokingProfile')}
              alcoholProfile={watch('alcoholProfile')}
              occupationalExposureEntries={
                watch('occupationalExposureEntries') ?? []
              }
              allergyEntries={watch('allergyEntries') ?? []}
              allergyNotes={watch('allergies') ?? ''}
              onSmokingProfileChange={(v) =>
                setValue('smokingProfile', v, { shouldValidate: true })
              }
              onAlcoholProfileChange={(v) =>
                setValue('alcoholProfile', v, { shouldValidate: true })
              }
              onOccupationalEntriesChange={(v) =>
                setValue('occupationalExposureEntries', v, {
                  shouldValidate: true,
                })
              }
              onAllergyEntriesChange={(v) =>
                setValue('allergyEntries', v, { shouldValidate: true })
              }
              onAllergyNotesChange={(v) =>
                setValue('allergies', v, { shouldValidate: true })
              }
            />

            <div
              id={patientEditFieldId('comorbidities')}
              className={cn(
                errors.comorbidities &&
                  'rounded-md p-1 ring-2 ring-destructive ring-offset-2'
              )}
            >
              <ComorbiditiesForm
                value={watch('comorbidities') as any}
                onChange={(comorbidities) =>
                  setValue('comorbidities', comorbidities as any)
                }
              />
              {errors.comorbidities && (
                <p className="text-sm text-destructive mt-1">
                  {fieldErrorText(errors.comorbidities)}
                </p>
              )}
            </div>

            <div
              id={patientEditFieldId('currentMedications')}
              className={cn(
                errors.currentMedications &&
                  'rounded-md p-1 ring-2 ring-destructive ring-offset-2'
              )}
            >
              <CurrentMedicationsForm
                value={watch('currentMedications') as any}
                onChange={(currentMedications) =>
                  setValue('currentMedications', currentMedications as any)
                }
              />
              {errors.currentMedications && (
                <p className="text-sm text-destructive mt-1">
                  {fieldErrorText(errors.currentMedications)}
                </p>
              )}
            </div>

            <div
              id={patientEditFieldId('familyHistory')}
              className={cn(
                errors.familyHistory &&
                  'rounded-md p-1 ring-2 ring-destructive ring-offset-2'
              )}
            >
              <FamilyHistoryForm
                value={watch('familyHistory') as any}
                onChange={(familyHistory) =>
                  setValue('familyHistory', familyHistory as any)
                }
              />
              {errors.familyHistory && (
                <p className="text-sm text-destructive mt-1">
                  {fieldErrorText(errors.familyHistory)}
                </p>
              )}
            </div>

            <PriorClinicalHistoryForm
              priorSurgeries={watch('priorSurgeries') as any}
              priorHospitalizations={watch('priorHospitalizations') as any}
              onChangeSurgeries={(items) =>
                setValue('priorSurgeries', items as any)
              }
              onChangeHospitalizations={(items) =>
                setValue('priorHospitalizations', items as any)
              }
            />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Integração EHR (Opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div id={patientEditFieldId('ehrPatientId')}>
              <label className="text-sm font-medium mb-2 block">
                ID do Paciente no EHR
              </label>
              <Input
                {...register('ehrPatientId')}
                placeholder="ID do paciente no sistema EHR"
                aria-invalid={!!errors.ehrPatientId}
                className={cn(errors.ehrPatientId && 'border-destructive')}
              />
              {errors.ehrPatientId && (
                <p className="text-sm text-destructive mt-1">
                  {fieldErrorText(errors.ehrPatientId)}
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

        {user?.role === 'ADMIN' && (
          <>
            <Card className="mt-8 border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">
                  Zona de perigo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Excluir este paciente remove todos os dados associados
                  (jornada, etapas, alertas, conversas). Esta ação não pode ser
                  desfeita.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir paciente
                </Button>
              </CardContent>
            </Card>

            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir{' '}
                    <strong>{patient?.name}</strong>? Todos os dados do paciente
                    (jornada, etapas, alertas, mensagens) serão removidos
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
                      handleDeletePatient();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Excluindo...' : 'Excluir'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </form>
    </div>
  );
}
