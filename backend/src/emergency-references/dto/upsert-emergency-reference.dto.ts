import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertEmergencyReferenceDto {
  @IsString()
  @IsNotEmpty()
  hospitalName: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  distanceKm?: number;

  @IsBoolean()
  @IsOptional()
  hasOncologyER?: boolean;

  @IsBoolean()
  @IsOptional()
  hasHematologyER?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
