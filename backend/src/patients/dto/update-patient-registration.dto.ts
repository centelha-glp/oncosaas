import {
  IsString,
  IsEmail,
  IsDateString,
  IsOptional,
  IsEnum,
  IsPhoneNumber,
  MinLength,
  MaxLength,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { Gender } from './create-patient.dto';
import { HealthCoverageType } from '@generated/prisma/client';

/**
 * Campos administrativos de cadastro — sem dados clínicos.
 * Usado por perfis restritos (ex.: SECRETARY) via PATCH .../registration.
 */
export class UpdatePatientRegistrationDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  name?: string;

  @IsString()
  @IsOptional()
  cpf?: string;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsPhoneNumber('BR')
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  medicalRecordNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  occupation?: string;

  /** ID do paciente no EHR/PMS externo (mapeado para ehrPatientId). */
  @IsString()
  @IsOptional()
  @MaxLength(255)
  ehrId?: string;

  @IsOptional()
  @IsEnum(HealthCoverageType)
  healthCoverageType?: HealthCoverageType | null;

  @ValidateIf(
    (o: UpdatePatientRegistrationDto) =>
      o.healthCoverageType === HealthCoverageType.HEALTH_PLAN,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  healthPlanName?: string;

  @ValidateIf(
    (o: UpdatePatientRegistrationDto) =>
      o.healthCoverageType === HealthCoverageType.HEALTH_PLAN,
  )
  @IsOptional()
  @IsString()
  @MaxLength(128)
  insuranceMemberId?: string;
}
