import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ClinicalNoteType } from '@generated/prisma/client';

export class CreateClinicalNoteDto {
  @IsEnum(ClinicalNoteType)
  noteType!: ClinicalNoteType;

  /** Etapa de navegação: consulta especializada (MEDICAL) ou consulta de navegação (NURSING) */
  @IsUUID()
  navigationStepId!: string;

  /** Evolução em Markdown (texto livre). */
  @IsString()
  contentMarkdown!: string;
}

export class UpdateClinicalNoteDto {
  @IsString()
  contentMarkdown!: string;

  @IsOptional()
  @IsUUID()
  navigationStepId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  changeReason?: string;
}

export class AddendumClinicalNoteDto {
  @IsOptional()
  @IsString()
  contentMarkdown?: string;
}

export class VoidClinicalNoteDto {
  @IsString()
  @MaxLength(2000)
  voidReason!: string;
}
