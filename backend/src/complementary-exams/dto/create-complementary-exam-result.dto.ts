import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateComplementaryExamResultDto {
  @IsDateString()
  @IsNotEmpty()
  performedAt: string;

  @IsUUID()
  @IsOptional()
  collectionId?: string; // UUID para agrupar resultados da mesma coleta/pedido

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  valueNumeric?: number;

  @IsString()
  @IsOptional()
  valueText?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  referenceRange?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isAbnormal?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  criticalHigh?: boolean; // Valor acima do limite crítico superior

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  criticalLow?: boolean; // Valor abaixo do limite crítico inferior

  @IsString()
  @IsOptional()
  report?: string;
}
