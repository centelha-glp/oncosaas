import { z } from 'zod';

const timeHHmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe o horário (HH:mm)');

export const consultationAppointmentFormSchema = z.object({
  patientId: z.string().uuid('Selecione um paciente'),
  stepKey: z.enum(['specialist_consultation', 'navigation_consultation']),
  expectedDate: z.date({ required_error: 'Informe a data da consulta' }),
  appointmentTime: timeHHmm,
  scheduledProfessionalId: z
    .string()
    .min(1, 'Selecione o profissional responsável pelo horário')
    .uuid('Selecione o profissional responsável pelo horário'),
  /** Usado quando o paciente ainda não tem `cancerType` no cadastro. */
  cancerTypeFallback: z.string().optional(),
});

export type ConsultationAppointmentFormData = z.infer<
  typeof consultationAppointmentFormSchema
>;
