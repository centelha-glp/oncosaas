import {
  IsUUID,
  IsEnum,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsString,
  IsObject,
} from 'class-validator';
import { ChannelType, ScheduledActionType } from '@generated/prisma/client';

export class CreateScheduledActionDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsEnum(ScheduledActionType)
  actionType: ScheduledActionType;

  @IsEnum(ChannelType)
  @IsOptional()
  channel?: ChannelType;

  @IsDateString()
  scheduledAt: string;

  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;
}
