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
import { Transform } from 'class-transformer';
import { JourneyStage } from '@generated/prisma/client';
import { IsPlainText } from '../../common/validators/is-plain-text.decorator';

export class CreateNavigationStepDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  /** Se omitido ou vazio, o serviço resolve a partir do paciente, diagnóstico ativo ou `"other"`. */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value
  )
  @IsString()
  @IsPlainText()
  cancerType?: string; // Ex: "colorectal"

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
  @IsPlainText()
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
  @IsPlainText()
  notes?: string;

  @IsUUID()
  @IsOptional()
  diagnosisId?: string; // Vincula a etapa a um diagnóstico (excluída em cascata com o diagnóstico)

  /** Obrigatório quando stepKey é consulta clínica e expectedDate está definida */
  @IsUUID()
  @IsOptional()
  scheduledProfessionalId?: string;
}