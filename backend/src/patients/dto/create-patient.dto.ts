import {
  IsString,
  IsEmail,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsPhoneNumber,
  MinLength,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCancerDiagnosisDto } from './create-cancer-diagnosis.dto';
import { FamilyHistoryDto } from './family-history.dto';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum CancerType {
  BREAST = 'breast',
  LUNG = 'lung',
  COLORECTAL = 'colorectal',
  PROSTATE = 'prostate',
  KIDNEY = 'kidney', // Câncer de Rim (Renal)
  BLADDER = 'bladder', // Câncer de Bexiga
  TESTICULAR = 'testicular', // Câncer de Testículo
  OTHER = 'other',
}

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  cpf?: string; // Criptografado (LGPD)

  @IsDateString()
  @IsNotEmpty()
  birthDate: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsPhoneNumber('BR')
  @IsOptional()
  phone?: string; // WhatsApp - Criptografado (LGPD)

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(CancerType)
  @IsOptional()
  cancerType?: CancerType;

  @IsString()
  @IsOptional()
  cancerSubtype?: string;

  @IsString()
  @IsOptional()
  stage?: string; // Ex: "IIIA", "IV"

  @IsDateString()
  @IsOptional()
  diagnosisDate?: string; // Data do diagnóstico

  @IsString()
  @IsOptional()
  currentTreatment?: string;

  @IsString()
  @IsOptional()
  currentStage?: string; // SCREENING, NAVIGATION, DIAGNOSIS, TREATMENT, FOLLOW_UP

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(4)
  performanceStatus?: number; // ECOG (0-4)

  @IsString()
  @IsOptional()
  ehrId?: string; // ID no sistema EHR externo

  @IsString()
  @IsOptional()
  ehrSystem?: string; // Nome do sistema EHR (ex: "Tasy", "MV")

  // Diagnósticos de câncer
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateCancerDiagnosisDto)
  cancerDiagnoses?: CreateCancerDiagnosisDto[];

  // Fatores de Risco
  @IsString()
  @IsOptional()
  smokingHistory?: string; // nunca fumou, ex-fumante, fumante atual (anos-maço)

  @IsString()
  @IsOptional()
  alcoholHistory?: string; // nunca, ocasional, moderado, pesado (g/dia)

  @IsString()
  @IsOptional()
  occupationalExposure?: string; // Exposições ocupacionais conhecidas

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FamilyHistoryDto)
  familyHistory?: FamilyHistoryDto[];

  // Nota: comorbidades e medicamentos são gerenciados via endpoints dedicados
  // POST /patients/:id/comorbidities e POST /patients/:id/medications
}