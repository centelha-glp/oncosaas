import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTissSpsadtGuideDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  operatorName: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  operatorANSCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  beneficiaryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  beneficiaryCardNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  requestingProfessionalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  requestingProfessionalCouncil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  requestingProfessionalCouncilUf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  requestingProfessionalRegistration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  requestingFacilityCnes?: string;
}

