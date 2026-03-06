import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsIn,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

// DTO para comorbidade
export class ComorbidityDto {
  @IsString()
  name: string;

  @IsString()
  severity: string; // leve, moderada, grave

  @IsBoolean()
  controlled: boolean;
}

// DTO para história familiar
export class FamilyHistoryDto {
  @IsString()
  relationship: string; // pai, mãe, irmão, etc.

  @IsString()
  cancerType: string;

  @IsNumber()
  @IsOptional()
  ageAtDiagnosis?: number;
}

export class CreateCancerDiagnosisDto {
  // Tipo de câncer
  @IsString()
  cancerType: string;

  @IsString()
  @IsOptional()
  icd10Code?: string;

  // Estadiamento TNM Estruturado
  @IsString()
  @IsOptional()
  @IsIn(T_STAGE_VALUES)
  tStage?: string;

  @IsString()
  @IsOptional()
  @IsIn(N_STAGE_VALUES)
  nStage?: string;

  @IsString()
  @IsOptional()
  @IsIn(M_STAGE_VALUES)
  mStage?: string;

  @IsString()
  @IsOptional()
  @IsIn(GRADE_VALUES)
  grade?: string;

  @IsDateString()
  @IsOptional()
  stagingDate?: string;

  // Tipo Histológico
  @IsString()
  @IsOptional()
  histologicalType?: string;

  // Diagnóstico
  @IsDateString()
  diagnosisDate: string;

  @IsBoolean()
  @IsOptional()
  diagnosisConfirmed?: boolean;

  @IsString()
  @IsOptional()
  pathologyReport?: string;

  @IsString()
  @IsOptional()
  confirmedBy?: string;

  // Biomarcadores - Câncer de Mama
  @IsString()
  @IsOptional()
  @IsIn(HER2_STATUS_VALUES)
  her2Status?: string;

  @IsString()
  @IsOptional()
  @IsIn(ER_PR_STATUS_VALUES)
  erStatus?: string;

  @IsString()
  @IsOptional()
  @IsIn(ER_PR_STATUS_VALUES)
  prStatus?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  ki67Percentage?: number;

  // Biomarcadores - Câncer de Pulmão/Colorretal
  @IsString()
  @IsOptional()
  @IsIn(MUTATION_STATUS_VALUES)
  egfrMutation?: string;

  @IsString()
  @IsOptional()
  @IsIn(REARRANGEMENT_STATUS_VALUES)
  alkRearrangement?: string;

  @IsString()
  @IsOptional()
  @IsIn(REARRANGEMENT_STATUS_VALUES)
  ros1Rearrangement?: string;

  @IsString()
  @IsOptional()
  @IsIn(MUTATION_STATUS_VALUES)
  brafMutation?: string;

  @IsString()
  @IsOptional()
  @IsIn(MUTATION_STATUS_VALUES)
  krasMutation?: string;

  @IsString()
  @IsOptional()
  @IsIn(MUTATION_STATUS_VALUES)
  nrasMutation?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  pdl1Expression?: number;

  @IsString()
  @IsOptional()
  @IsIn(MSI_STATUS_VALUES)
  msiStatus?: string;

  // Biomarcadores - Câncer de Próstata
  @IsNumber()
  @IsOptional()
  @Min(0)
  psaBaseline?: number;

  @IsString()
  @IsOptional()
  gleasonScore?: string; // ex: "3+4=7"

  // Marcadores Tumorais
  @IsNumber()
  @IsOptional()
  @Min(0)
  ceaBaseline?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  ca199Baseline?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  ca125Baseline?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  ca153Baseline?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  afpBaseline?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  hcgBaseline?: number;

  // Status do diagnóstico
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Câncer metastático: vinculado ao diagnóstico primário
  @IsString()
  @IsOptional()
  primaryDiagnosisId?: string;
}
