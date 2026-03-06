import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateComplementaryExamResultDto {
  @IsDateString()
  @IsNotEmpty()
  performedAt: string;

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

  @IsString()
  @IsOptional()
  report?: string;
}
