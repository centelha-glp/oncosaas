import { z } from 'zod';
import {
  T_STAGE_VALUES,
  N_STAGE_VALUES,
  M_STAGE_VALUES,
  GRADE_VALUES,
} from './cancer-diagnosis';

// Schema para comorbidade
export const comorbiditySchema = z.object({
  name: z.string().min(1, 'Nome da comorbidade é obrigatório'),
  severity: z.string().min(1, 'Severidade é obrigatória'),
  controlled: z.boolean(),
});

// Schema para histórico familiar
export const familyHistorySchema = z.object({
  relationship: z.string().min(1, 'Relação familiar é obrigatória'),
  cancerType: z.string().min(1, 'Tipo de câncer é obrigatório'),
  ageAtDiagnosis: z.number().positive().optional(),
});

// Schema para medicamento em uso (nome opcional no item para permitir linhas em branco; filtrar no submit)
export const currentMedicationSchema = z.object({
  name: z.string().optional(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  indication: z.string().optional(),
});

export const createPatientSchema = z
  .object({
    // Etapa 1 - Dados Básicos
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    cpf: z.string().optional(),
    birthDate: z.string().min(1, 'Data de nascimento é obrigatória'),
    gender: z.enum(['male', 'female', 'other']).optional(),
    phone: z
      .string()
      .min(10, 'Telefone é obrigatório e deve ter pelo menos 10 dígitos'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),

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
    smokingHistory: z.string().optional(),
    alcoholHistory: z.string().optional(),
    occupationalExposure: z.string().optional(),
    familyHistory: z.array(familyHistorySchema).optional(),

    // Etapa 3 - Integração EHR
    ehrPatientId: z.string().optional(),
  })
  .refine(
    (data) => {
      // Em tratamento, seguimento ou paliativo: diagnóstico obrigatório (tipo, estágio TNM, data, ECOG)
      const needsDiagnosis =
        data.currentStage === 'TREATMENT' ||
        data.currentStage === 'FOLLOW_UP' ||
        data.currentStage === 'PALLIATIVE';
      if (!needsDiagnosis) return true;
      if (!data.cancerType?.trim()) return false;
      if (!data.diagnosisDate?.trim()) return false;
      if (!data.stage?.trim()) return false;
      if (data.performanceStatus === undefined || data.performanceStatus === null)
        return false;
      return true;
    },
    {
      message:
        'Para pacientes em Tratamento ou Seguimento, preencha Tipo de Câncer, Estágio TNM, Data do Diagnóstico e Performance Status (ECOG).',
      path: ['cancerType'],
    }
  )
  .refine(
    (data) => {
      // Em tratamento, seguimento ou paliativo: tratamento obrigatório (em tratamento pode ser "A definir")
      const needsTreatment =
        data.currentStage === 'TREATMENT' ||
        data.currentStage === 'FOLLOW_UP' ||
        data.currentStage === 'PALLIATIVE';
      if (!needsTreatment) return true;
      return !!data.currentTreatment?.trim();
    },
    {
      message:
        'Para pacientes em Tratamento ou Seguimento, informe o tratamento (ou "A definir").',
      path: ['currentTreatment'],
    }
  );

export type CreatePatientFormData = z.infer<typeof createPatientSchema>;
