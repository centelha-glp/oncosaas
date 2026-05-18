import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
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

  /** Filtro parcial por nome do paciente (case-insensitive). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  q?: string;

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
