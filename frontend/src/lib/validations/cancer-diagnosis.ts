import { z } from 'zod';

// Valores permitidos para estadiamento TNM
export const T_STAGE_VALUES = ['T1', 'T2', 'T3', 'T4', 'Tis', 'Tx'] as const;
export const N_STAGE_VALUES = ['N0', 'N1', 'N2', 'N3', 'Nx'] as const;
export const M_STAGE_VALUES = ['M0', 'M1', 'Mx'] as const;
export const GRADE_VALUES = ['G1', 'G2', 'G3', 'G4', 'Gx'] as const;

// Valores permitidos para biomarcadores
export const HER2_STATUS_VALUES = [
  'positivo',
  'negativo',
  'indeterminado',
] as const;
export const ER_PR_STATUS_VALUES = ['positivo', 'negativo'] as const;
export const MUTATION_STATUS_VALUES = [
  'mutado',
  'wild-type',
  'indeterminado',
] as const;
export const REARRANGEMENT_STATUS_VALUES = ['positivo', 'negativo'] as const;
export const MSI_STATUS_VALUES = ['MSI-H', 'MSS', 'indeterminado'] as const;

// Schema para comorbidade
export const comorbiditySchema = z.object({
  name: z.string().min(1, 'Nome da comorbidade é obrigatório'),
  severity: z.string().min(1, 'Gravidade é obrigatória'),
  controlled: z.boolean(),
});

// Schema para história familiar
export const familyHistorySchema = z.object({
  relationship: z.string().min(1, 'Parentesco é obrigatório'),
  cancerType: z.string().min(1, 'Tipo de câncer é obrigatório'),
  ageAtDiagnosis: z.number().int().positive().optional(),
});

// Schema principal para CancerDiagnosis
export const cancerDiagnosisSchema = z.object({
  // Tipo de câncer
  cancerType: z.string().min(1, 'Tipo de câncer é obrigatório'),
  icd10Code: z.string().optional(),

  // Estadiamento TNM Estruturado
  tStage: z.enum(T_STAGE_VALUES).optional(),
  nStage: z.enum(N_STAGE_VALUES).optional(),
  mStage: z.enum(M_STAGE_VALUES).optional(),
  grade: z.enum(GRADE_VALUES).optional(),
  stagingDate: z.string().optional(),

  // Tipo Histológico
  histologicalType: z.string().optional(),

  // Diagnóstico
  diagnosisDate: z.string().min(1, 'Data de diagnóstico é obrigatória'),
  diagnosisConfirmed: z.boolean().optional().default(true),
  pathologyReport: z.string().optional(),
  confirmedBy: z.string().optional(),

  // Biomarcadores - Câncer de Mama
  her2Status: z.enum(HER2_STATUS_VALUES).optional(),
  erStatus: z.enum(ER_PR_STATUS_VALUES).optional(),
  prStatus: z.enum(ER_PR_STATUS_VALUES).optional(),
  ki67Percentage: z
    .number()
    .min(0, 'Ki-67 deve ser entre 0 e 100')
    .max(100, 'Ki-67 deve ser entre 0 e 100')
    .optional(),

  // Biomarcadores - Câncer de Pulmão/Colorretal
  egfrMutation: z.enum(MUTATION_STATUS_VALUES).optional(),
  alkRearrangement: z.enum(REARRANGEMENT_STATUS_VALUES).optional(),
  ros1Rearrangement: z.enum(REARRANGEMENT_STATUS_VALUES).optional(),
  brafMutation: z.enum(MUTATION_STATUS_VALUES).optional(),
  krasMutation: z.enum(MUTATION_STATUS_VALUES).optional(),
  nrasMutation: z.enum(MUTATION_STATUS_VALUES).optional(),
  pdl1Expression: z
    .number()
    .min(0, 'PD-L1 deve ser entre 0 e 100')
    .max(100, 'PD-L1 deve ser entre 0 e 100')
    .optional(),
  msiStatus: z.enum(MSI_STATUS_VALUES).optional(),

  // Biomarcadores - Câncer de Próstata
  psaBaseline: z.number().min(0, 'PSA deve ser positivo').optional(),
  gleasonScore: z.string().optional(), // ex: "3+4=7"

  // Marcadores Tumorais
  ceaBaseline: z.number().min(0, 'CEA deve ser positivo').optional(),
  ca199Baseline: z.number().min(0, 'CA 19-9 deve ser positivo').optional(),
  ca125Baseline: z.number().min(0, 'CA 125 deve ser positivo').optional(),
  ca153Baseline: z.number().min(0, 'CA 15-3 deve ser positivo').optional(),
  afpBaseline: z.number().min(0, 'AFP deve ser positivo').optional(),
  hcgBaseline: z.number().min(0, 'β-HCG deve ser positivo').optional(),

  // Status do diagnóstico
  isPrimary: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
  // Câncer metastático: ID do diagnóstico primário ao qual este está vinculado
  primaryDiagnosisId: z.string().uuid().optional(),
});

export type CancerDiagnosisFormData = z.infer<typeof cancerDiagnosisSchema>;
