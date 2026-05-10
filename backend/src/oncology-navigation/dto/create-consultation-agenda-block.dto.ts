import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateConsultationAgendaBlockDto {
  /** Omitido ou null = bloqueio global do tenant. */
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
