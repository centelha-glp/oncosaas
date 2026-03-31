import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsArray,
} from 'class-validator';
import { NavigationStepStatus } from '@generated/prisma/client';

export class UpdateNavigationStepDto {
  @IsEnum(NavigationStepStatus)
  @IsOptional()
  status?: NavigationStepStatus;

  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @IsDateString()
  @IsOptional()
  completedAt?: string;

  @IsString()
  @IsOptional()
  completedBy?: string;

  @IsDateString()
  @IsOptional()
  actualDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string; // Data limite para gerar alarmes de atraso

  @IsString()
  @IsOptional()
  institutionName?: string; // Instituição de saúde onde foi realizada

  @IsString()
  @IsOptional()
  professionalName?: string; // Profissional que realizou

  @IsString()
  @IsOptional()
  result?: string; // Resultado da etapa

  @IsArray()
  @IsOptional()
  findings?: string[]; // Lista de achados/alterações

  @IsObject()
  @IsOptional()
  metadata?: any;

  @IsString()
  @IsOptional()
  notes?: string;
}