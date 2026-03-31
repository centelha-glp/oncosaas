import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ChannelType, ConversationStatus, HandledBy } from '@generated/prisma/client';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsEnum(ChannelType)
  @IsOptional()
  channel?: ChannelType;
}

export class UpdateConversationDto {
  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: ConversationStatus;

  @IsEnum(HandledBy)
  @IsOptional()
  handledBy?: HandledBy;
}
