import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  quantity: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  dosage: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  frequency: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  route: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  duration: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string;
}
