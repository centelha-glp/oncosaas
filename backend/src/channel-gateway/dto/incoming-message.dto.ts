import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
} from 'class-validator';
import { ChannelType, MessageType } from '@generated/prisma/client';

export class IncomingMessageDto {
  @IsString()
  @IsNotEmpty()
  patientPhone: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(ChannelType)
  channel: ChannelType;

  @IsString()
  @IsNotEmpty()
  externalMessageId: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @IsEnum(MessageType)
  type: MessageType;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsInt()
  audioDuration?: number;
}

export class OutgoingMessageDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(ChannelType)
  @IsOptional()
  channel?: ChannelType;

  @IsOptional()
  @IsString()
  mediaUrl?: string;
}
