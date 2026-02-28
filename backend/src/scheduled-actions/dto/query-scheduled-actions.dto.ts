import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { ScheduledActionStatus, ScheduledActionType } from '@prisma/client';

export class QueryScheduledActionsDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsEnum(ScheduledActionStatus)
  status?: ScheduledActionStatus;

  @IsOptional()
  @IsEnum(ScheduledActionType)
  actionType?: ScheduledActionType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
