import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ConsultationAgendaMetricsQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsUUID()
  professionalId?: string;
}
