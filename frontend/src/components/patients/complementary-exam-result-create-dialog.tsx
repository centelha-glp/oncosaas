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
import type { ComplementaryExam } from '@/lib/api/patients';
import {
  todayLocalYyyyMmDd,
  toPerformedAtApiPayload,
} from '@/lib/utils/date-only';
import {
  EXAM_TYPE_FIELD_CONFIG,
  defaultCompositeComponentRows,
  resolveCatalogEntryForExam,
} from '@/lib/data/complementary-exams-catalog';
import { AutoInterpretationPreview } from '@/components/patients/auto-interpretation-preview';

interface ComplementaryExamResultCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  exam: ComplementaryExam;
  onSuccess?: () => void;
}

export function ComplementaryExamResultCreateDialog({
  open,
  onOpenChange,
  patientId,
  exam,
  onSuccess,
}: ComplementaryExamResultCreateDialogProps): React.ReactElement {
  const queryClient = useQueryClient();

  const catalogEntry = resolveCatalogEntryForExam(exam);
  const isComposite = catalogEntry?.isComposite === true;
  const compositeComponents = catalogEntry?.components ?? [];
  const fieldConfig = EXAM_TYPE_FIELD_CONFIG[exam.type];
  const lockUnitFromExam = !!(exam.unit?.trim());
  const lockRefFromExam = !!(exam.referenceRange?.trim());
  const isImaging = exam.type === 'IMAGING';
  const isAnatomo = exam.type === 'ANATOMOPATHOLOGICAL';
  const isLabLike =
    exam.type === 'LABORATORY' || exam.type === 'IMMUNOHISTOCHEMICAL';

  function buildDefaultValues(): CreateComplementaryExamResultFormData {
    return {
      performedAt: todayLocalYyyyMmDd(),
      valueNumeric: undefined,
      valueText: '',
      unit: exam.unit ?? '',
      referenceRange: exam.referenceRange ?? '',
      isAbnormal: false,
      report: '',
      components: isComposite
        ? defaultCompositeComponentRows(compositeComponents)
        : [],
    };
  }

  const form = useForm<CreateComplementaryExamResultFormData>({
    resolver: zodResolver(createComplementaryExamResultSchema),
    defaultValues: buildDefaultValues(),
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: 'components',
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateComplementaryExamResultFormData) => {
      const payload: Parameters<typeof patientsApi.createComplementaryExamResult>[2] = {
        performedAt: toPerformedAtApiPayload(data.performedAt),
        report: data.report || undefined,
      };

      if (isComposite && data.components && data.components.length > 0) {
        payload.components = data.components.map((c) => ({
          name: c.name,
          unit: c.unit,
          referenceRange: c.referenceRange,
          valueNumeric: c.valueNumeric,
          valueText: c.valueText || undefined,
        }));
      } else {
        payload.valueNumeric = data.valueNumeric;
        payload.valueText = data.valueText || undefined;
        payload.unit = data.unit || undefined;
        payload.referenceRange = data.referenceRange || undefined;
        if (isAnatomo) {
          payload.isAbnormal = data.isAbnormal;
        }
      }

      return patientsApi.createComplementaryExamResult(patientId, exam.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      toast.success('Resultado adicionado.');
      form.reset(buildDefaultValues());
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao adicionar resultado.');
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(buildDefaultValues());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exam.id, exam.unit, exam.referenceRange]);

  const onSubmit = (data: CreateComplementaryExamResultFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>
            Adicionar resultado — {exam.name}
          </DialogTitle>
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
            {/* Data da realização */}
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

            {/* Exame composto: tabela de componentes */}
            {isComposite && fields.length > 0 && (
              <ComplementaryExamCompositeResultTable
                control={form.control}
                fields={fields}
                compositeComponents={compositeComponents}
                namePrefix="components"
              />
            )}

            {!isComposite && isImaging && (
              <>
                <FormField
                  control={form.control}
                  name="report"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Laudo / conclusão radiológica</FormLabel>
                      <FormControl>
                        <textarea
                          className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Descreva achados e conclusão principal"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              </>
            )}

            {!isComposite && isAnatomo && (
              <>
                <FormField
                  control={form.control}
                  name="valueText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fieldConfig.textLabel}</FormLabel>
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
                <FormField
                  control={form.control}
                  name="report"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Laudo anatomopatológico completo</FormLabel>
                      <FormControl>
                        <textarea
                          className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Texto integral do laudo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidade (opcional)</FormLabel>
                      {lockUnitFromExam ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                          <Badge variant="secondary">{field.value || '—'}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Definido no cadastro do exame
                          </span>
                        </div>
                      ) : (
                        <FormControl>
                          <Input placeholder="Ex: g/dL" {...field} />
                        </FormControl>
                      )}
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
                      {lockRefFromExam ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                          <span className="font-mono text-xs">
                            {field.value || '—'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Definido no cadastro do exame
                          </span>
                        </div>
                      ) : (
                        <FormControl>
                          <Input placeholder="Ex: 4.5-5.5" {...field} />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <details className="rounded-md border border-dashed p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Avançado
                  </summary>
                  <div className="mt-3">
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
                            <FormLabel>
                              Forçar: fora da referência (interpretação qualitativa)
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </details>
              </>
            )}

            {!isComposite && isLabLike && (
              <>
                {fieldConfig.showNumeric && (
                  <FormField
                    control={form.control}
                    name="valueNumeric"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {exam.type === 'IMMUNOHISTOCHEMICAL'
                            ? 'Valor quantitativo (%) ou índice (opcional)'
                            : 'Valor numérico (opcional)'}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder={
                              exam.type === 'IMMUNOHISTOCHEMICAL'
                                ? 'Ex: 80 ou 1,2'
                                : 'Ex: 12.5'
                            }
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

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidade (opcional)</FormLabel>
                      {lockUnitFromExam ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                          <Badge variant="secondary">{field.value || '—'}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Definido no cadastro do exame
                          </span>
                        </div>
                      ) : (
                        <FormControl>
                          <Input placeholder="Ex: g/dL" {...field} />
                        </FormControl>
                      )}
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
                      {lockRefFromExam ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                          <span className="font-mono text-xs">
                            {field.value || '—'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Definido no cadastro do exame
                          </span>
                        </div>
                      ) : (
                        <FormControl>
                          <Input placeholder="Ex: 4.5-5.5" {...field} />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <AutoInterpretationPreview
                  control={form.control}
                  valueName="valueNumeric"
                  referenceName="referenceRange"
                />
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
              </>
            )}

            {isComposite && fields.length > 0 && (
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
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Salvando...' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
