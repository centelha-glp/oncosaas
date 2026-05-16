import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
