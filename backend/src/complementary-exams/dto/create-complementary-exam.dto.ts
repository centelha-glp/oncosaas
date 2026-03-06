import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ComplementaryExamType } from '@prisma/client';

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
  unit?: string;

  @IsString()
  @IsOptional()
  referenceRange?: string;
}
