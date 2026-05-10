import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { ClinicalSubrole } from '@generated/prisma/client';

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
  crmUf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  crmNumber?: string;

  /** Obrigatório quando o convite for para enfermeiro — validado no serviço conforme role do convite */
  @IsOptional()
  @IsString()
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
