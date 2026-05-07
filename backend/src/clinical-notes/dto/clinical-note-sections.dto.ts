import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ClinicalNoteType } from '@generated/prisma/client';
import { CLINICAL_NOTE_CONTENT_MARKDOWN_MAX_LENGTH } from '../clinical-notes.constants';

export class CreateClinicalNoteDto {
  @IsEnum(ClinicalNoteType)
  noteType!: ClinicalNoteType;

  /** Etapa de navegação: consulta especializada (MEDICAL) ou consulta de navegação (NURSING) */
  @IsUUID()
  navigationStepId!: string;

  /** Evolução em Markdown (texto livre). */
  @IsString()
  @MaxLength(CLINICAL_NOTE_CONTENT_MARKDOWN_MAX_LENGTH)
  contentMarkdown!: string;
}

export class UpdateClinicalNoteDto {
  @IsString()
  @MaxLength(CLINICAL_NOTE_CONTENT_MARKDOWN_MAX_LENGTH)
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
  @MaxLength(CLINICAL_NOTE_CONTENT_MARKDOWN_MAX_LENGTH)
  contentMarkdown?: string;
}

export class VoidClinicalNoteDto {
  @IsString()
  @MaxLength(2000)
  voidReason!: string;
}
