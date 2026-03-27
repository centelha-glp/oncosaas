import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportSpreadsheetRowDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  medicalRecordNumber?: string;

  @IsString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsString()
  @IsOptional()
  smokingHistory?: string;

  @IsString()
  @IsOptional()
  cpf?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  surgeryDate?: string;

  @IsString()
  @IsOptional()
  surgeryType?: string;

  @IsString()
  @IsOptional()
  admissionDate?: string;

  @IsString()
  @IsOptional()
  dischargeDate?: string;

  @IsString()
  @IsOptional()
  aihEmissionDate?: string;

  @IsBoolean()
  @IsOptional()
  isReadmission?: boolean;

  @IsString()
  @IsOptional()
  readmissionReason?: string;

  @IsBoolean()
  @IsOptional()
  isReoperation?: boolean;

  @IsBoolean()
  @IsOptional()
  hadNeoadjuvantChemo?: boolean;

  @IsString()
  @IsOptional()
  neoadjuvantChemoDetail?: string;

  @IsBoolean()
  @IsOptional()
  hadUrinaryDiversion?: boolean;

  @IsBoolean()
  @IsOptional()
  intraoperativeMortality?: boolean;

  @IsBoolean()
  @IsOptional()
  mortality30Days?: boolean;

  @IsBoolean()
  @IsOptional()
  mortality90Days?: boolean;

  @IsString()
  @IsOptional()
  mortality90DaysDetail?: string;

  @IsString()
  @IsOptional()
  diagnosis?: string;

  @IsString()
  @IsOptional()
  referenceDate?: string;
}

export class ImportSpreadsheetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSpreadsheetRowDto)
  rows: ImportSpreadsheetRowDto[];
}
