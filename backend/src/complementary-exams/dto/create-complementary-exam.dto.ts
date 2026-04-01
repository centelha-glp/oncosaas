import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ComplementaryExamType, LabCategory } from '@generated/prisma/client';

export class CreateComplementaryExamDto {
  @IsEnum(ComplementaryExamType)
  @IsNotEmpty()
  type: ComplementaryExamType;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  loincCode?: string; // Código LOINC padronizado

  @IsEnum(LabCategory)
  @IsOptional()
  labCategory?: LabCategory; // Categoria clínica para agrupamento e scoring de risco

  @IsBoolean()
  @IsOptional()
  isCriticalMetric?: boolean; // true para ANC, Hgb, Plaquetas, Creatinina, etc.

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  referenceRange?: string;
}
