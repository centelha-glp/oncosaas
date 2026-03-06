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
      .enum(['SCREENING', 'NAVIGATION', 'DIAGNOSIS', 'TREATMENT', 'FOLLOW_UP'])
      .default('SCREENING'),

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
      // Se não está em SCREENING, dataDiagnostico é obrigatória
      if (data.currentStage !== 'SCREENING' && !data.diagnosisDate) {
        return false;
      }
      return true;
    },
    {
      message:
        'Data de diagnóstico é obrigatória quando o paciente não está em rastreio',
      path: ['diagnosisDate'],
    }
  );

export type CreatePatientFormData = z.infer<typeof createPatientSchema>;
