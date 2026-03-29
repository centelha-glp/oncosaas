import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsEnum,
  IsEmail,
  IsPhoneNumber,
  MinLength,
} from 'class-validator';
import { Gender, CancerType } from './create-patient.dto';

export class ImportPatientRowDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  cpf?: string;

  @IsDateString()
  @IsOptional()
  dataNascimento?: string;

  @IsEnum(Gender)
  @IsOptional()
  sexo?: Gender;

  @IsPhoneNumber('BR')
  @IsOptional()
  telefone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(CancerType)
  @IsOptional()
  tipoCancer?: CancerType;

  @IsDateString()
  @IsOptional()
  dataDiagnostico?: string;

  @IsString()
  @IsOptional()
  estagio?: string;

  @IsString()
  @IsOptional()
  oncologistaResponsavel?: string;
}

export class ImportPatientsDto {
  @IsNotEmpty()
  patients: ImportPatientRowDto[];
}
