import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsObject,
  IsUUID,
} from 'class-validator';
import { JourneyStage } from '@prisma/client';

export class CreateNavigationStepDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  cancerType: string; // Ex: "colorectal"

  @IsEnum(JourneyStage)
  @IsNotEmpty()
  journeyStage: JourneyStage;

  @IsString()
  @IsNotEmpty()
  stepKey: string; // Ex: "colonoscopy", "biopsy"

  @IsString()
  @IsNotEmpty()
  stepName: string; // Ex: "Colonoscopia"

  @IsString()
  @IsOptional()
  stepDescription?: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsDateString()
  @IsOptional()
  expectedDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsObject()
  @IsOptional()
  metadata?: any;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  diagnosisId?: string; // Vincula a etapa a um diagnóstico (excluída em cascata com o diagnóstico)
}
