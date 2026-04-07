'use client';

import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ComplementaryExamCompositeResultTable } from '@/components/patients/complementary-exam-composite-result-table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  createComplementaryExamResultSchema,
  type CreateComplementaryExamResultFormData,
} from '@/lib/validations/complementary-exam';
import { patientsApi } from '@/lib/api/patients';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ComplementaryExam, ComplementaryExamResult } from '@/lib/api/patients';
import {
  COMPLEMENTARY_EXAMS_CATALOG,
  EXAM_TYPE_FIELD_CONFIG,
  defaultCompositeComponentRows,
} from '@/lib/data/complementary-exams-catalog';

interface ComplementaryExamResultEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  exam: ComplementaryExam;
  result: ComplementaryExamResult;
  onSuccess?: () => void;
}

function findCatalogEntry(exam: ComplementaryExam) {
  return (
    COMPLEMENTARY_EXAMS_CATALOG.find(
      (e) =>
        (exam.code && e.code && e.code.toLowerCase() === exam.code.toLowerCase()) ||
        e.name.toLowerCase() === exam.name.toLowerCase()
    ) ?? null
  );
}

function buildEditValues(
  exam: ComplementaryExam,
  result: ComplementaryExamResult,
  catalogEntry: ReturnType<typeof findCatalogEntry>
): CreateComplementaryExamResultFormData {
  const isComposite = catalogEntry?.isComposite === true;
  const compositeComponents = catalogEntry?.components ?? [];

  let components: CreateComplementaryExamResultFormData['components'] = [];
  if (isComposite) {
    if (result.components && result.components.length > 0) {
      components = result.components.map((c) => ({
        name: c.name,
        unit: c.unit,
        referenceRange: c.referenceRange,
        valueNumeric: c.valueNumeric,
        valueText: c.valueText ?? '',
        isAbnormal: c.isAbnormal ?? false,
      }));
    } else {
      components = defaultCompositeComponentRows(compositeComponents);
    }
  }

  const performedAt = result.performedAt.includes('T')
    ? result.performedAt.slice(0, 10)
    : result.performedAt;

  return {
    performedAt,
    valueNumeric: result.valueNumeric ?? undefined,
    valueText: result.valueText ?? '',
    unit: result.unit ?? exam.unit ?? '',
    referenceRange: result.referenceRange ?? exam.referenceRange ?? '',
    isAbnormal: result.isAbnormal ?? false,
    report: result.report ?? '',
    components,
  };
}

export function ComplementaryExamResultEditDialog({
  open,
  onOpenChange,
  patientId,
  exam,
  result,
  onSuccess,
}: ComplementaryExamResultEditDialogProps): React.ReactElement {
  const queryClient = useQueryClient();

  const catalogEntry = findCatalogEntry(exam);
  const isComposite = catalogEntry?.isComposite === true;
  const compositeComponents = catalogEntry?.components ?? [];
  const fieldConfig = EXAM_TYPE_FIELD_CONFIG[exam.type];

  const form = useForm<CreateComplementaryExamResultFormData>({
    resolver: zodResolver(createComplementaryExamResultSchema),
    defaultValues: buildEditValues(exam, result, catalogEntry),
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: 'components',
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateComplementaryExamResultFormData) => {
      const payload: Parameters<typeof patientsApi.updateComplementaryExamResult>[3] = {
        performedAt: new Date(data.performedAt).toISOString(),
        isAbnormal: data.isAbnormal,
        report: data.report || undefined,
      };

      if (isComposite && data.components && data.components.length > 0) {
        payload.components = data.components.map((c) => ({
          name: c.name,
          unit: c.unit,
          referenceRange: c.referenceRange,
          valueNumeric: c.valueNumeric,
          valueText: c.valueText || undefined,
          isAbnormal: c.isAbnormal,
        }));
      } else {
        payload.valueNumeric = data.valueNumeric;
        payload.valueText = data.valueText || undefined;
        payload.unit = data.unit || undefined;
        payload.referenceRange = data.referenceRange || undefined;
      }

      return patientsApi.updateComplementaryExamResult(
        patientId,
        exam.id,
        result.id,
        payload
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      toast.success('Resultado atualizado.');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar resultado.');
    },
  });

  useEffect(() => {
    if (open && result) {
      form.reset(buildEditValues(exam, result, catalogEntry));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, result?.id, exam.id, exam.unit, exam.referenceRange]);

  const onSubmit = (data: CreateComplementaryExamResultFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Editar resultado — {exam.name}</DialogTitle>
          {exam.specimen && (
            <div className="mt-1">
              <Badge variant="outline" className="text-xs">
                {exam.specimen}
              </Badge>
            </div>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="performedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data da realização</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isComposite && fields.length > 0 ? (
              <ComplementaryExamCompositeResultTable
                control={form.control}
                fields={fields}
                compositeComponents={compositeComponents}
                namePrefix="components"
              />
            ) : (
              <>
                {fieldConfig.showNumeric && (
                  <FormField
                    control={form.control}
                    name="valueNumeric"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor numérico (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="Ex: 12.5"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              field.onChange(v === '' ? undefined : Number(v));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {fieldConfig.showText && (
                  <FormField
                    control={form.control}
                    name="valueText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{fieldConfig.textLabel} (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={fieldConfig.textPlaceholder}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {!fieldConfig.showNumeric && !fieldConfig.showText && (
                  <FormField
                    control={form.control}
                    name="valueText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor texto (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Positivo, Negativo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidade (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: g/dL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="referenceRange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Faixa de referência (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 4.5-5.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isAbnormal"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Fora da referência</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="report"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {fieldConfig.reportIsPrimary
                      ? 'Laudo / conclusão diagnóstica'
                      : 'Laudo / observações (opcional)'}
                  </FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Texto livre do laudo"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
