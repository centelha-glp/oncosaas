import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { CreateNavigationStepDto } from './create-navigation-step.dto';

/** Cria etapa de consulta (stepKey deve ser de consulta clínica). Confirmação WhatsApp é agendada pela config da agenda do profissional. */
export class CreateConsultationAppointmentDto extends CreateNavigationStepDto {
  @IsUUID()
  @IsNotEmpty()
  scheduledProfessionalId!: string;
}
