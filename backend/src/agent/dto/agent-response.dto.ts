import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  AgentDecisionType,
  ScheduledActionType,
  ChannelType,
} from '@generated/prisma/client';

export class AgentProcessRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsEnum(ChannelType)
  @IsOptional()
  channel?: ChannelType;
}

export class ScheduleActionDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsEnum(ScheduledActionType)
  actionType: ScheduledActionType;

  @IsEnum(ChannelType)
  @IsOptional()
  channel?: ChannelType;

  @IsString()
  @IsNotEmpty()
  scheduledAt: string;

  @IsObject()
  payload: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsString()
  @IsOptional()
  recurrenceRule?: string;

  @IsString()
  @IsOptional()
  conversationId?: string;
}

export class ApproveDecisionDto {
  @IsString()
  @IsNotEmpty()
  decisionId: string;

  @IsBoolean()
  approved: boolean;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
