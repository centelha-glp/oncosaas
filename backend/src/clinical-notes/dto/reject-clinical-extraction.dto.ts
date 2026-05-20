import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectClinicalExtractionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
