import { z } from 'zod';

/** Formulário de cadastro administrativo (sem campos clínicos). */
export const patientRegistrationEditSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    cpf: z.string().optional(),
    birthDate: z.string().min(1, 'Data de nascimento é obrigatória'),
    gender: z.enum(['male', 'female', 'other']).optional(),
    phone: z.string().optional(),
    email: z
      .string()
      .optional()
      .refine(
        (v) =>
          !v || v.trim() === '' || z.string().email().safeParse(v).success,
        'E-mail inválido'
      ),
    medicalRecordNumber: z.string().optional(),
    occupation: z.string().optional(),
    ehrId: z.string().optional(),
    healthCoverageType: z.enum(['PRIVATE', 'HEALTH_PLAN']).optional(),
    healthPlanName: z.string().max(255).optional(),
    insuranceMemberId: z.string().max(128).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.healthCoverageType === 'HEALTH_PLAN' &&
      !data.healthPlanName?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['healthPlanName'],
        message: 'Informe o nome do plano de saúde.',
      });
    }
    if (
      !data.healthCoverageType &&
      (data.healthPlanName?.trim() || data.insuranceMemberId?.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['healthCoverageType'],
        message:
          'Selecione "Plano de saúde" para informar nome do plano ou carteirinha.',
      });
    }
  });

export type PatientRegistrationFormData = z.infer<
  typeof patientRegistrationEditSchema
>;
