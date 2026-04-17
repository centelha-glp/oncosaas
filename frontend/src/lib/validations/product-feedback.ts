import { z } from 'zod';

export const productFeedbackFormSchema = z.object({
  type: z.enum(['BUG', 'FEATURE']),
  title: z.string().min(3, 'Mínimo 3 caracteres').max(200),
  description: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .max(8000, 'Máximo 8000 caracteres'),
});

export type ProductFeedbackFormValues = z.infer<typeof productFeedbackFormSchema>;
