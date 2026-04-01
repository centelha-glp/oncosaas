import { IsInt, IsEnum, IsOptional, IsString, Min, Max } from 'class-validator';
import { PriorityCategory } from '@generated/prisma/client';

export class UpdatePriorityDto {
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @IsEnum(PriorityCategory)
  category: PriorityCategory;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  modelVersion?: string; // Versão do modelo ML usado
}