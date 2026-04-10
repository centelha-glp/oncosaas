import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { MedicationCategory } from '@generated/prisma/client';

export class CreateMedicationDto {
  /** Obrigatório se não houver catalogKey (nome livre ou "Outro"). */
  @ValidateIf((o: CreateMedicationDto) => !o.catalogKey?.trim())
  @IsString()
  @IsNotEmpty()
  name?: string;

  /** Se presente, o servidor resolve nome e categoria pelo catálogo (ignora categoria enviada). */
  @IsOptional()
  @IsString()
  catalogKey?: string;

  @IsString()
  @IsOptional()
  dosage?: string;

  @IsString()
  @IsOptional()
  frequency?: string;

  @IsString()
  @IsOptional()
  indication?: string;

  @IsString()
  @IsOptional()
  route?: string;

  @IsEnum(MedicationCategory)
  @IsOptional()
  category?: MedicationCategory;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
