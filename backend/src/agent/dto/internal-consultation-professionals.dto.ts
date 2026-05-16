import { IsIn, IsOptional } from 'class-validator';
import { CONSULTATION_STEP_KEYS } from '../../oncology-navigation/consultation-step-keys';

export class InternalConsultationProfessionalsDto {
  @IsIn([...CONSULTATION_STEP_KEYS])
  @IsOptional()
  stepKey?: string;
}
