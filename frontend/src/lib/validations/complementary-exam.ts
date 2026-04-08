import { z } from 'zod';

const examTypeEnum = z.enum([
  'LABORATORY',
  'ANATOMOPATHOLOGICAL',
  'IMMUNOHISTOCHEMICAL',
  'IMAGING',
]);

const examResultComponentRowSchema = z.object({
  name: z.string().min(1),
  valueNumeric: z.number().optional(),
  valueText: z.string().optional(),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  isAbnormal: z.boolean().optional(),
});

const initialResultSchema = z.object({
  performedAt: z.string().optional(),
  valueNumeric: z.number().optional(),
  valueText: z.string().optional(),
  isAbnormal: z.boolean().optional(),
  report: z.string().optional(),
  components: z.array(examResultComponentRowSchema).optional(),
});

export const createComplementaryExamSchema = z.object({
  type: examTypeEnum,
  name: z.string().min(1, 'Nome do exame é obrigatório'),
  code: z.string().optional(),
  specimen: z.string().optional(),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  initialResult: initialResultSchema.optional(),
});

export const createComplementaryExamResultSchema = z
  .object({
    performedAt: z.string().min(1, 'Data da realização é obrigatória'),
    valueNumeric: z.number().optional(),
    valueText: z.string().optional(),
    unit: z.string().optional(),
    referenceRange: z.string().optional(),
    isAbnormal: z.boolean().optional(),
    report: z.string().optional(),
    components: z.array(examResultComponentRowSchema).optional(),
  })
  .refine(
    (data) => {
      const hasNum =
        typeof data.valueNumeric === 'number' && !Number.isNaN(data.valueNumeric);
      const hasText = (data.valueText ?? '').trim().length > 0;
      const hasReport = (data.report ?? '').trim().length > 0;
      const hasComponentValues =
        data.components?.some(
          (c) =>
            (typeof c.valueNumeric === 'number' && !Number.isNaN(c.valueNumeric)) ||
            (c.valueText ?? '').trim().length > 0,
        ) ?? false;
      return hasNum || hasText || hasReport || hasComponentValues;
    },
    {
      message: 'Informe ao menos um valor (numérico, texto, laudo ou parâmetros do painel).',
      path: ['valueText'],
    },
  );

export type CreateComplementaryExamFormData = z.infer<
  typeof createComplementaryExamSchema
>;
export type InitialResultFormData = z.infer<typeof initialResultSchema>;
export type CreateComplementaryExamResultFormData = z.infer<
  typeof createComplementaryExamResultSchema
>;
