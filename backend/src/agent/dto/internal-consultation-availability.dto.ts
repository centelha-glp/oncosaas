import { IsISO8601, IsIn, IsOptional, IsUUID } from 'class-validator';
import { CONSULTATION_STEP_KEYS } from '../../oncology-navigation/consultation-step-keys';

export class InternalConsultationAvailabilityDto {
  @IsUUID()
  @IsOptional()
  professionalId?: string;

  @IsUUID()
  @IsOptional()
  scheduledProfessionalId?: string;

  @IsIn([...CONSULTATION_STEP_KEYS])
  stepKey!: string;

  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;
}
