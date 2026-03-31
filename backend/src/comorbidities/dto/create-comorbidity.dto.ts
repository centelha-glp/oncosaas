import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ComorbidityType, ComorbiditySeverity } from '@generated/prisma/client';

export class CreateComorbidityDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ComorbidityType)
  @IsOptional()
  type?: ComorbidityType;

  @IsEnum(ComorbiditySeverity)
  @IsOptional()
  severity?: ComorbiditySeverity;

  @IsBoolean()
  @IsOptional()
  controlled?: boolean;

  @IsDateString()
  @IsOptional()
  diagnosedAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
