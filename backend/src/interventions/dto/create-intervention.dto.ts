import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { InterventionType } from '@generated/prisma/client';

export class CreateInterventionDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsEnum(InterventionType)
  @IsNotEmpty()
  type: InterventionType;

  @IsUUID()
  @IsOptional()
  messageId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
