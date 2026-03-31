import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ClinicalDisposition } from '@generated/prisma/client';
import { CreatePatientDto } from './create-patient.dto';

export class UpdatePatientDto extends PartialType(CreatePatientDto) {
  @IsEnum(ClinicalDisposition)
  @IsOptional()
  clinicalDisposition?: ClinicalDisposition;

  @IsDateString()
  @IsOptional()
  clinicalDispositionAt?: string;

  @IsString()
  @IsOptional()
  clinicalDispositionReason?: string;

  @IsString()
  @IsOptional()
  preferredEmergencyHospital?: string;
}