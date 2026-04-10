import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Min,
  Max,
  MaxLength,
  IsInt,
} from 'class-validator';

export class PriorHospitalizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  summary: string;

  @IsInt()
  @IsOptional()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
