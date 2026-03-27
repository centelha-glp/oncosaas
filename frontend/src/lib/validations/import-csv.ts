import { z } from 'zod';

export const csvRowSchema = z.object({
  name: z.string().min(2),
  cpf: z.string().optional().or(z.literal('')),
  dataNascimento: z.string().optional().or(z.literal('')),
  sexo: z
    .enum(['male', 'female', 'other'])
    .optional()
    .or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  tipoCancer: z
    .enum([
      'breast',
      'lung',
      'colorectal',
      'prostate',
      'kidney',
      'bladder',
      'testicular',
      'other',
    ])
    .optional()
    .or(z.literal('')),
  dataDiagnostico: z.string().optional().or(z.literal('')),
  estagio: z.string().optional(),
  oncologistaResponsavel: z.string().optional(),
  currentStage: z
    .enum([
      'SCREENING',
      'DIAGNOSIS',
      'TREATMENT',
      'FOLLOW_UP',
      'PALLIATIVE',
    ])
    .optional(),
});

export type CsvRow = z.infer<typeof csvRowSchema>;
