import { PartialType } from '@nestjs/mapped-types';
import { CreateAlertDto } from './create-alert.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AlertStatus } from '@generated/prisma/client';

export class UpdateAlertDto extends PartialType(CreateAlertDto) {
  @IsEnum(AlertStatus)
  @IsOptional()
  status?: AlertStatus;

  @IsString()
  @IsOptional()
  acknowledgedBy?: string; // ID do usuário que reconheceu

  @IsString()
  @IsOptional()
  resolvedBy?: string; // ID do usuário que resolveu
}
