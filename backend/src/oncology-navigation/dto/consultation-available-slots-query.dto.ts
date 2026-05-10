import { IsIn, IsISO8601, IsUUID } from 'class-validator';
import { CONSULTATION_STEP_KEYS } from '../consultation-step-keys';

export class ConsultationAvailableSlotsQueryDto {
  @IsUUID()
  professionalId!: string;

  @IsIn([...CONSULTATION_STEP_KEYS])
  stepKey!: string;

  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;
}
