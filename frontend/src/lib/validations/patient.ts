import { z } from 'zod';
import {
  T_STAGE_VALUES,
  N_STAGE_VALUES,
  M_STAGE_VALUES,
  GRADE_VALUES,
} from './cancer-diagnosis';
import { requiresCurrentTreatmentField, requiresOncologyCoreFields } from '@/lib/utils/journey-stage';

/** Linha de comorbidade: pode estar em branco até o usuário preencher tipo/gravidade/nome. */
export const comorbiditySchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  severity: z.string().optional(),
  controlled: z.boolean().optional(),
});

// Schema para histórico familiar
export const familyHistorySchema = z.object({
  relationship: z.string().min(1, 'Relação familiar é obrigatória'),
  cancerType: z.string().min(1, 'Tipo de câncer é obrigatório'),
  ageAtDiagnosis: z.number().positive().optional(),
});

export const priorSurgeryItemSchema = z.object({
  procedureName: z.string().optional(),
  year: z.number().min(1900).max(2100).optional(),
  institution: z.string().optional(),
  notes: z.string().optional(),
});

export const priorHospitalizationItemSchema = z.object({
  summary: z.string().optional(),
  year: z.number().min(1900).max(2100).optional(),
  durationDays: z.number().min(1).max(3650).optional(),
  notes: z.string().optional(),
});

const smokingProfileObjectSchema = z.object({
  status: z.enum(['never', 'former', 'current', 'unknown']).optional(),
  packYears: z.number().optional(),
  yearsQuit: z.number().optional(),
  notes: z.string().optional(),
});

const smokingProfileSchema = z
  .preprocess(
    (v) => (v === null ? undefined : v),
    smokingProfileObjectSchema
  )
  .optional();

const alcoholProfileObjectSchema = z.object({
  status: z
    .enum(['never', 'occasional', 'moderate', 'heavy', 'unknown'])
    .optional(),
  drinksPerWeek: z.number().optional(),
  notes: z.string().optional(),
});

const alcoholProfileSchema = z
  .preprocess(
    (v) => (v === null ? undefined : v),
    alcoholProfileObjectSchema
  )
  .optional();

const occupationalExposureEntrySchema = z.object({
  agent: z.string().optional(),
  yearsApprox: z.number().optional(),
  notes: z.string().optional(),
});

const allergyEntrySchema = z.object({
  substanceKey: z.string().optional(),
  customLabel: z.string().optional(),
  reactionNotes: z.string().optional(),
});

// Schema para medicamento em uso (nome opcional no item para permitir linhas em branco; filtrar no submit)
export const currentMedicationSchema = z.object({
  catalogKey: z.string().optional(),
  name: z.string().optional(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  indication: z.string().optional(),
});

/** Campos comuns (cadastro e edição); `phone` é definido em cada schema final. */
const patientFormSharedFields = {
  // Etapa 1 - Dados Básicos
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf: z.string().optional(),
  birthDate: z.string().min(1, 'Data de nascimento é obrigatória'),
  gender: z.enum(['male', 'female', 'other']).optional(),
  email: z.preprocess(
    (v) => (v === null || v === undefined ? '' : v),
    z.union([z.literal(''), z.string().email('Email inválido')])
  ),

  // Etapa 2 - Dados Oncológicos Essenciais
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
    .optional(),
  stage: z.string().optional(),
  // Campos TNM estruturados
  tStage: z.enum(T_STAGE_VALUES).optional(),
  nStage: z.enum(N_STAGE_VALUES).optional(),
  mStage: z.enum(M_STAGE_VALUES).optional(),
  grade: z.enum(GRADE_VALUES).optional(),
  diagnosisDate: z.string().optional(),
  performanceStatus: z.preprocess(
    (val) =>
      typeof val === 'number' && Number.isNaN(val) ? undefined : val,
    z
      .number()
      .min(0)
      .max(4, 'ECOG deve ser entre 0 e 4')
      .optional()
  ),
  currentStage: z
    .enum(['SCREENING', 'DIAGNOSIS', 'TREATMENT', 'FOLLOW_UP', 'PALLIATIVE'])
    .default('SCREENING'),

  // Tratamento atual (obrigatório em seguimento)
  currentTreatment: z.string().optional(),

  // Comorbidades e Fatores de Risco
  comorbidities: z.array(comorbiditySchema).optional(),
  currentMedications: z.array(currentMedicationSchema).optional(),
  smokingProfile: smokingProfileSchema,
  alcoholProfile: alcoholProfileSchema,
  occupationalExposureEntries: z
    .array(occupationalExposureEntrySchema)
    .optional(),
  allergyEntries: z.array(allergyEntrySchema).optional(),
  smokingHistory: z.string().optional(),
  alcoholHistory: z.string().optional(),
  occupationalExposure: z.string().optional(),
  familyHistory: z.array(familyHistorySchema).optional(),
  priorSurgeries: z.array(priorSurgeryItemSchema).optional(),
  priorHospitalizations: z.array(priorHospitalizationItemSchema).optional(),
  allergies: z.string().max(16000).optional(),

  // Etapa 3 - Integração EHR
  ehrPatientId: z.string().optional(),
};

const patientFormRefines = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .superRefine((data, ctx) => {
      if (!requiresOncologyCoreFields(data.currentStage)) return;
      const d = data as {
        cancerType?: string | null;
        diagnosisDate?: string | null;
        stage?: string | null;
        performanceStatus?: number | null | undefined;
      };
      if (!d.cancerType?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cancerType'],
          message: 'Selecione o tipo de câncer.',
        });
      }
      if (!d.diagnosisDate?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['diagnosisDate'],
          message: 'Informe a data do diagnóstico.',
        });
      }
      if (!d.stage?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stage'],
          message:
            'Preencha o estadiamento TNM (T, N e M) para gerar o estágio, ou informe o estágio quando aplicável.',
        });
      }
      if (d.performanceStatus === undefined || d.performanceStatus === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['performanceStatus'],
          message: 'Selecione o Performance Status (ECOG).',
        });
      }
    })
  .refine(
    (data) => {
      if (!requiresCurrentTreatmentField(data.currentStage)) return true;
      return !!data.currentTreatment?.trim();
    },
    {
      message:
        'Em Tratamento, Seguimento ou Cuidados Paliativos, informe o tratamento atual (ou "A definir").',
      path: ['currentTreatment'],
    }
  )
  .refine(
    (data) => {
      const rows = data.comorbidities ?? [];
      for (const c of rows) {
        const touched =
          (c.name?.trim()?.length ?? 0) > 0 ||
          (c.type?.trim()?.length ?? 0) > 0 ||
          (c.severity?.trim()?.length ?? 0) > 0;
        const complete =
          (c.name?.trim()?.length ?? 0) > 0 &&
          (c.type?.trim()?.length ?? 0) > 0 &&
          (c.severity?.trim()?.length ?? 0) > 0;
        if (touched && !complete) return false;
      }
      return true;
    },
    {
      message:
        'Em cada comorbidade iniciada, preencha tipo, nome/detalhe e gravidade.',
      path: ['comorbidities'],
    }
  )
  .refine(
    (data) => {
      for (const a of data.allergyEntries ?? []) {
        const touched =
          (a.substanceKey?.trim()?.length ?? 0) > 0 ||
          (a.customLabel?.trim()?.length ?? 0) > 0 ||
          (a.reactionNotes?.trim()?.length ?? 0) > 0;
        const sk = a.substanceKey?.trim() ?? '';
        const complete =
          sk.length > 0 && (sk !== 'OTHER' || (a.customLabel?.trim()?.length ?? 0) > 0);
        if (touched && !complete) return false;
      }
      return true;
    },
    {
      message:
        'Em cada alergia iniciada, selecione a substância; em "Outra", especifique o nome.',
      path: ['allergyEntries'],
    }
  )
  .refine(
    (data) => {
      const rows = data.currentMedications ?? [];
      for (const m of rows) {
        const touched =
          Boolean(m.catalogKey?.trim()) ||
          (m.name?.trim()?.length ?? 0) > 0 ||
          (m.dosage?.trim()?.length ?? 0) > 0 ||
          (m.frequency?.trim()?.length ?? 0) > 0 ||
          (m.indication?.trim()?.length ?? 0) > 0;
        if (!touched) continue;
        const key = m.catalogKey?.trim();
        const nameOk = (m.name?.trim()?.length ?? 0) > 0;
        if (key) {
          if (key === 'OTHER' && !nameOk) return false;
        } else if (!nameOk) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        'Em cada medicamento, escolha um item do catálogo ou informe o nome livre; em "Outro", o nome é obrigatório.',
      path: ['currentMedications'],
    }
  );

/** Cadastro: telefone obrigatório (mín. 10 caracteres no campo). */
export const createPatientSchema = patientFormRefines(
  z.object({
    ...patientFormSharedFields,
    phone: z
      .string()
      .min(10, 'Telefone é obrigatório e deve ter pelo menos 10 dígitos'),
  })
);

/** Edição: permite telefone vazio (paciente sem telefone no cadastro legado). */
export const editPatientSchema = patientFormRefines(
  z.object({
    ...patientFormSharedFields,
    // Normaliza null/undefined para '' — union sem preprocess falha com "Required" (Zod) quando o valor vem ausente.
    phone: z.preprocess(
      (v) => (v === null || v === undefined ? '' : v),
      z.union([
        z.literal(''),
        z.string().min(
          10,
          'Telefone deve ter pelo menos 10 dígitos quando informado'
        ),
      ])
    ),
  })
);

export type CreatePatientFormData = z.infer<typeof createPatientSchema>;
export type EditPatientFormData = z.infer<typeof editPatientSchema>;
