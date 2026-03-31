import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
  IsUUID,
} from 'class-validator';
import { AlertType, AlertSeverity } from '@generated/prisma/client';

export class CreateAlertDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsEnum(AlertType)
  @IsNotEmpty()
  type: AlertType;

  @IsEnum(AlertSeverity)
  @IsNotEmpty()
  severity: AlertSeverity;

  @IsString()
  @IsNotEmpty()
  message: string; // Mensagem do alerta

  @IsObject()
  @IsOptional()
  context?: any; // JSON com metadados (conversationId, symptom, scores, etc.)
}
