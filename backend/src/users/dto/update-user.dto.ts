import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ClinicalSubrole, UserRole } from '@generated/prisma/client';
import { BRAZIL_UF_SIGLAS } from '@/common/constants/brazil-ufs';

const UF_LIST = BRAZIL_UF_SIGLAS as unknown as string[];

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  /// COORDINATOR ou ADMIN — competência clínica no prontuário (enfermagem vs médica)
  @IsOptional()
  @IsEnum(ClinicalSubrole)
  clinicalSubrole?: ClinicalSubrole | null;

  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(UF_LIST)
  crmUf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  crmNumber?: string;

  @IsOptional()
  @IsString()
  @IsIn(UF_LIST)
  corenUf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  corenNumber?: string;
}
