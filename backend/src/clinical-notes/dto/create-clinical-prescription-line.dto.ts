import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClinicalPrescriptionLineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  medicationName: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  catalogKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  presentationCatalogCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  frequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  route?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  indication?: string;
}
