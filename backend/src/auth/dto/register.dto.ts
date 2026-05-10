import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  MaxLength,
  IsEnum,
  IsIn,
} from 'class-validator';
import { ClinicalSubrole } from '@generated/prisma/client';
import { BRAZIL_UF_SIGLAS } from '@/common/constants/brazil-ufs';

const UF_LIST = BRAZIL_UF_SIGLAS as unknown as string[];

export class RegisterDto {
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

  /** Token de convite emitido por um ADMIN via POST /auth/invite */
  @IsString()
  @IsNotEmpty()
  inviteToken: string;

  /** Obrigatório quando o convite for para médico — validado no serviço conforme role do convite */
  @IsOptional()
  @IsString()
  @IsIn(UF_LIST)
  crmUf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  crmNumber?: string;

  /** Obrigatório quando o convite for para enfermeiro — validado no serviço conforme role do convite */
  @IsOptional()
  @IsString()
  @IsIn(UF_LIST)
  corenUf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  corenNumber?: string;

  /** Para convites com role COORDINATOR ou ADMIN — define competência clínica e conselho obrigatório */
  @IsOptional()
  @IsEnum(ClinicalSubrole)
  clinicalSubrole?: ClinicalSubrole | null;
}
