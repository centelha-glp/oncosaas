import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsObject } from 'class-validator';
import { ClinicalDisposition } from '@generated/prisma/client';

export class CreateDispositionFeedbackDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsEnum(ClinicalDisposition)
  predictedDisposition: ClinicalDisposition;

  @IsString()
  @IsNotEmpty()
  predictionSource: string;

  @IsNumber()
  @IsOptional()
  predictionConfidence?: number;

  @IsObject()
  @IsOptional()
  rulesFindings?: Record<string, any>[];

  @IsEnum(ClinicalDisposition)
  correctedDisposition: ClinicalDisposition;

  @IsString()
  @IsOptional()
  correctionReason?: string;

  @IsObject()
  featureSnapshot: Record<string, any>;
}
