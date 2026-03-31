import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { MessageDirection, MessageType, ProcessedBy } from '@generated/prisma/client';

export class CreateMessageDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsOptional()
  conversationId?: string; // Agrupa mensagens da mesma conversa

  @IsString()
  @IsNotEmpty()
  whatsappMessageId: string; // ID único do WhatsApp

  @IsDateString()
  @IsNotEmpty()
  whatsappTimestamp: string; // Timestamp original do WhatsApp

  @IsEnum(MessageType)
  @IsNotEmpty()
  type: MessageType;

  @IsEnum(MessageDirection)
  @IsNotEmpty()
  direction: MessageDirection;

  @IsString()
  @IsNotEmpty()
  content: string; // Texto ou transcrição do áudio

  @IsString()
  @IsOptional()
  audioUrl?: string; // URL do áudio no S3

  @IsNumber()
  @IsOptional()
  audioDuration?: number; // Duração em segundos

  @IsString()
  @IsOptional()
  transcribedText?: string; // Texto transcrito (STT)

  @IsEnum(ProcessedBy)
  @IsOptional()
  processedBy?: ProcessedBy; // AGENT ou NURSING

  @IsOptional()
  structuredData?: any; // JSON com dados estruturados extraídos

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  criticalSymptomsDetected?: string[]; // Sintomas críticos detectados

  @IsBoolean()
  @IsOptional()
  alertTriggered?: boolean;

  @IsString()
  @IsOptional()
  assumedBy?: string; // userId que assumiu (handoff manual)
}
