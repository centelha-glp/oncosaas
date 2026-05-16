import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ConfirmComplementaryExamItemDto {
  @IsString()
  @MaxLength(64)
  type!: string;

  @IsString()
  @MaxLength(400)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string | null;

  @IsOptional()
  result?: Record<string, unknown> | null;
}

export class ConfirmComplementaryExamsDto {
  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmComplementaryExamItemDto)
  items!: ConfirmComplementaryExamItemDto[];
}

export class CreateExamIngestSessionDto {
  @IsOptional()
  @IsUUID()
  clinicalNoteId?: string;
}

export class ExamIngestExtractDto {
  @IsOptional()
  @IsString()
  @MaxLength(500000)
  plainText?: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
