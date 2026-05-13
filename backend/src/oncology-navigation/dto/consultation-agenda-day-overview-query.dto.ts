import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { CONSULTATION_STEP_KEYS } from '../consultation-step-keys';

export class ConsultationAgendaDayOverviewQueryDto {
  @IsUUID()
  professionalId!: string;

  /** Se omitido, o servidor aceita o profissional se for elegível para qualquer tipo de consulta na agenda. */
  @IsOptional()
  @IsIn([...CONSULTATION_STEP_KEYS])
  stepKey?: string;

  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;
}
