import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MaxLength,
  IsInt,
} from 'class-validator';

export class PriorSurgeryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  procedureName: string;

  @IsInt()
  @IsOptional()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  institution?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
