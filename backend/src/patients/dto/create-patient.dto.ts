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
  MaxLength,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCancerDiagnosisDto } from './create-cancer-diagnosis.dto';
import { FamilyHistoryDto } from './family-history.dto';
import { PriorSurgeryDto } from './prior-surgery.dto';
import { PriorHospitalizationDto } from './prior-hospitalization.dto';
import { CreateComorbidityDto } from '../../comorbidities/dto/create-comorbidity.dto';
import { CreateMedicationDto } from '../../medications/dto/create-medication.dto';

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
  currentStage?: string; // SCREENING, DIAGNOSIS, TREATMENT, FOLLOW_UP, PALLIATIVE

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PriorSurgeryDto)
  priorSurgeries?: PriorSurgeryDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PriorHospitalizationDto)
  priorHospitalizations?: PriorHospitalizationDto[];

  @IsString()
  @IsOptional()
  @MaxLength(16000)
  allergies?: string;

  /** Tabagismo estruturado (JSON). Mantém-se smokingHistory para legado. */
  @IsOptional()
  @IsObject()
  smokingProfile?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  alcoholProfile?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  occupationalExposureEntries?: Record<string, unknown>[];

  /** Alergias por catálogo (substanceKey); validado no serviço. */
  @IsOptional()
  @IsArray()
  allergyEntries?: Record<string, unknown>[];

  /** Também aceitos no cadastro inicial; mesma regra dos endpoints dedicados. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateComorbidityDto)
  comorbidities?: CreateComorbidityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMedicationDto)
  currentMedications?: CreateMedicationDto[];
}