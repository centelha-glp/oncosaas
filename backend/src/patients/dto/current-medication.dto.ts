import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CurrentMedicationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  dosage?: string;

  @IsString()
  @IsOptional()
  frequency?: string;

  @IsString()
  @IsOptional()
  indication?: string;
}
