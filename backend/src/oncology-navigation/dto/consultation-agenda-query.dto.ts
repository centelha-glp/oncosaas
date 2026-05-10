import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export type ConsultationAgendaScope = 'consultations' | 'all';

/** Query params para GET /oncology-navigation/consultation-agenda */
export class ConsultationAgendaQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsIn(['consultations', 'all'])
  scope?: ConsultationAgendaScope = 'consultations';

  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
