import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsBoolean,
  ValidateIf,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ClinicalSubrole, UserRole } from '@generated/prisma/client';
import { BRAZIL_UF_SIGLAS } from '@/common/constants/brazil-ufs';

const UF_LIST = BRAZIL_UF_SIGLAS as unknown as string[];

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  /// COORDINATOR ou ADMIN — define competência para evoluções de enfermagem vs médica no prontuário
  @ValidateIf(
    (o: CreateUserDto) =>
      o.role === UserRole.COORDINATOR || o.role === UserRole.ADMIN
  )
  @IsOptional()
  @IsEnum(ClinicalSubrole)
  clinicalSubrole?: ClinicalSubrole | null;

  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;

  @ValidateIf(
    (o: CreateUserDto) =>
      o.role === UserRole.ONCOLOGIST ||
      o.role === UserRole.DOCTOR ||
      ((o.role === UserRole.COORDINATOR || o.role === UserRole.ADMIN) &&
        o.clinicalSubrole === ClinicalSubrole.MEDICAL)
  )
  @IsString()
  @IsNotEmpty()
  @IsIn(UF_LIST)
  crmUf?: string;

  @ValidateIf(
    (o: CreateUserDto) =>
      o.role === UserRole.ONCOLOGIST ||
      o.role === UserRole.DOCTOR ||
      ((o.role === UserRole.COORDINATOR || o.role === UserRole.ADMIN) &&
        o.clinicalSubrole === ClinicalSubrole.MEDICAL)
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  crmNumber?: string;

  @ValidateIf(
    (o: CreateUserDto) =>
      o.role === UserRole.NURSE ||
      o.role === UserRole.NURSE_CHIEF ||
      ((o.role === UserRole.COORDINATOR || o.role === UserRole.ADMIN) &&
        o.clinicalSubrole === ClinicalSubrole.NURSING)
  )
  @IsString()
  @IsNotEmpty()
  @IsIn(UF_LIST)
  corenUf?: string;

  @ValidateIf(
    (o: CreateUserDto) =>
      o.role === UserRole.NURSE ||
      o.role === UserRole.NURSE_CHIEF ||
      ((o.role === UserRole.COORDINATOR || o.role === UserRole.ADMIN) &&
        o.clinicalSubrole === ClinicalSubrole.NURSING)
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  corenNumber?: string;
}
