import { z } from 'zod';

export const csvRowSchema = z.object({
  name: z.string().min(2),
  cpf: z.string().min(11),
  dataNascimento: z.string(),
  sexo: z.enum(['male', 'female', 'other']),
  telefone: z.string().min(10, 'Telefone é obrigatório'),
  email: z.string().email().optional().or(z.literal('')),
  tipoCancer: z.enum([
    'breast',
    'lung',
    'colorectal',
    'prostate',
    'kidney',
    'bladder',
    'testicular',
    'other',
  ]),
  dataDiagnostico: z.string().optional(),
  estagio: z.string().optional(),
  oncologistaResponsavel: z.string().optional(),
  // Campo opcional para especificar o estágio da jornada
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
