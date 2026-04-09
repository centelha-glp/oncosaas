'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  createComplementaryExamSchema,
  type CreateComplementaryExamFormData,
} from '@/lib/validations/complementary-exam';
import { patientsApi } from '@/lib/api/patients';
import type { ComplementaryExamType } from '@/lib/api/patients';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  COMPLEMENTARY_EXAMS_CATALOG,
  getCatalogByType,
  EXAM_TYPE_FIELD_CONFIG,
  SPECIMEN_OPTIONS,
  defaultCompositeComponentRows,
  type CatalogExamEntry,
} from '@/lib/data/complementary-exams-catalog';
import { ExamCatalogCombobox } from '@/components/shared/exam-catalog-combobox';
import { ComplementaryExamCompositeResultTable } from '@/components/patients/complementary-exam-composite-result-table';
import { AutoInterpretationPreview } from '@/components/patients/auto-interpretation-preview';
import { cn } from '@/lib/utils';
import {
  todayLocalYyyyMmDd,
  toPerformedAtApiPayload,
} from '@/lib/utils/date-only';
import { examCatalogApi } from '@/lib/api/exam-catalog';
import { useDebounce } from '@/lib/utils/use-debounce';

/** Itens retornados pela API ao abrir o diálogo / sem termo de busca (alinhar ao teto do backend). */
const EXAM_CATALOG_BROWSE_LIMIT = 10_000;
/** Com termo de busca, bastam menos linhas (filtro server-side). */
const EXAM_CATALOG_SEARCH_LIMIT = 800;
const EXAM_TYPE_OPTIONS: { value: ComplementaryExamType; label: string }[] = [
  { value: 'LABORATORY', label: 'Laboratorial' },
  { value: 'ANATOMOPATHOLOGICAL', label: 'Anatomopatológico' },
  { value: 'IMMUNOHISTOCHEMICAL', label: 'Imuno-histoquímico' },
  { value: 'IMAGING', label: 'Imagem' },
];

function catalogDisplayLabel(entry: CatalogExamEntry): string {
  return entry.code ? `${entry.name} (${entry.code})` : entry.name;
}

interface ComplementaryExamCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onSuccess?: () => void;
}

export function ComplementaryExamCreateDialog({
  open,
  onOpenChange,
  patientId,
  onSuccess,
}: ComplementaryExamCreateDialogProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [selectedCatalogEntry, setSelectedCatalogEntry] = useState<CatalogExamEntry | null>(null);
  const selectedCatalogRef = useRef<CatalogExamEntry | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    selectedCatalogRef.current = selectedCatalogEntry;
  }, [selectedCatalogEntry]);

  const form = useForm<CreateComplementaryExamFormData>({
    resolver: zodResolver(createComplementaryExamSchema),
    defaultValues: {
      type: 'LABORATORY',
      name: '',
      code: '',
      specimen: '',
      unit: '',
      referenceRange: '',
      initialResult: {
        performedAt: todayLocalYyyyMmDd(),
        valueNumeric: undefined,
        valueText: '',
        isAbnormal: false,
        report: '',
        components: [],
      },
    },
  });

  const { fields: compositeFields } = useFieldArray({
    control: form.control,
    name: 'initialResult.components',
  });

  const examType = useWatch({ control: form.control, name: 'type' });
  const examNameInput = useWatch({ control: form.control, name: 'name' });
  const debouncedCatalogQ = useDebounce(examNameInput ?? '', 300);

  const catalogSearchTrimmed = debouncedCatalogQ.trim();
  const { data: catalogRemote, isPending, isError, isSuccess } = useQuery({
    queryKey: ['exam-catalog', examType, catalogSearchTrimmed],
    queryFn: () =>
      examCatalogApi.search({
        type: examType,
        q: catalogSearchTrimmed || undefined,
        limit: catalogSearchTrimmed
          ? EXAM_CATALOG_SEARCH_LIMIT
          : EXAM_CATALOG_BROWSE_LIMIT,
        offset: 0,
      }),
    enabled: open,
    staleTime: 60 * 1000,
  });

  const catalogLoading = isPending && catalogRemote === undefined;

  useEffect(() => {
    if (!open || !isError) return;
    toast.error(
      'Não foi possível carregar o catálogo no servidor. Usando lista local mínima.',
    );
  }, [open, isError]);

  const catalogComboboxOptions = useMemo(() => {
    const staticOpts = getCatalogByType(examType).map((entry) => ({
      id: `static-${entry.type}-${entry.name}-${entry.code ?? ''}`,
      label: catalogDisplayLabel(entry),
      subtitle:
        [entry.unit, entry.referenceRange].filter(Boolean).join(' · ') ||
        undefined,
      data: entry,
    }));

    const rows = catalogRemote?.items ?? [];

    if (catalogLoading) {
      return [];
    }
    if (isError) {
      return staticOpts;
    }
    if (rows.length === 0) {
      return staticOpts;
    }

    const apiCodes = new Set(rows.map((r) => r.code));
    const fromApi = rows.map((row) => {
      const staticMatch = COMPLEMENTARY_EXAMS_CATALOG.find(
        (e) =>
          e.code &&
          row.code &&
          e.code.toLowerCase() === row.code.toLowerCase()
      );
      const entry: CatalogExamEntry = staticMatch
        ? {
            ...staticMatch,
            name: row.name,
            unit: row.unit ?? staticMatch.unit,
            referenceRange: row.referenceRange ?? staticMatch.referenceRange,
            specimen: row.specimenDefault ?? staticMatch.specimen,
          }
        : {
            type: row.type,
            name: row.name,
            code: row.code,
            specimen: row.specimenDefault ?? undefined,
            unit: row.unit ?? undefined,
            referenceRange: row.referenceRange ?? undefined,
            isComposite: false,
          };
      return {
        id: `db-${row.code}`,
        label: catalogDisplayLabel(entry),
        subtitle:
          [row.unit, row.referenceRange].filter(Boolean).join(' · ') ||
          (row.rolItemCode ? `Rol: ${row.rolItemCode}` : undefined),
        data: entry,
      };
    });

    const staticFiltered = staticOpts.filter((o) => {
      const c = o.data.code?.trim();
      if (c && apiCodes.has(c)) {
        return false;
      }
      return true;
    });

    return [...fromApi, ...staticFiltered];
  }, [examType, catalogRemote, catalogLoading, isError]);

  const catalogEmptyOnServer =
    isSuccess && (catalogRemote?.items?.length ?? 0) === 0;
  const isComposite = selectedCatalogEntry?.isComposite === true;
  const specimenOptions = SPECIMEN_OPTIONS[examType] ?? [];
  const fieldConfig = EXAM_TYPE_FIELD_CONFIG[examType];
  const lockUnitFromCatalog = !!(selectedCatalogEntry?.unit?.trim());
  const lockRefFromCatalog = !!(
    selectedCatalogEntry?.referenceRange?.trim()
  );
  const lockSpecimenFromCatalog = !!(
    selectedCatalogEntry?.specimen?.trim()
  );

  const createMutation = useMutation({
    mutationFn: async (data: CreateComplementaryExamFormData) => {
      const exam = await patientsApi.createComplementaryExam(patientId, {
        type: data.type,
        name: data.name,
        code: data.code || undefined,
        specimen: data.specimen || undefined,
        unit: data.unit || undefined,
        referenceRange: data.referenceRange || undefined,
      });
      const ir = data.initialResult;
      const catalogSnapshot = selectedCatalogRef.current;
      const isCompositeCatalog =
        catalogSnapshot?.isComposite === true &&
        ir?.components &&
        ir.components.length > 0;

      if (isCompositeCatalog && ir) {
        const hasPanelData =
          (ir.report ?? '').trim() !== '' ||
          ir.components!.some(
            (c) =>
              (typeof c.valueNumeric === 'number' &&
                !Number.isNaN(c.valueNumeric)) ||
              (c.valueText ?? '').trim() !== ''
          );
        if (hasPanelData) {
          const performedAt =
            (ir.performedAt ?? '').trim() !== ''
              ? toPerformedAtApiPayload(ir.performedAt!)
              : todayLocalYyyyMmDd();
          await patientsApi.createComplementaryExamResult(patientId, exam.id, {
            performedAt,
            report: ir.report || undefined,
            components: ir.components!.map((c) => ({
              name: c.name,
              unit: c.unit,
              referenceRange: c.referenceRange,
              valueNumeric: c.valueNumeric,
              valueText: c.valueText || undefined,
            })),
          });
        }
      } else if (ir) {
        const hasInitialResult =
          (ir.performedAt ?? '').trim() !== '' &&
          (typeof ir.valueNumeric === 'number' ||
            (ir.valueText ?? '').trim() !== '' ||
            (ir.report ?? '').trim() !== '');
        if (hasInitialResult) {
          const performedAt =
            (ir.performedAt ?? '').trim() !== ''
              ? toPerformedAtApiPayload(ir.performedAt!)
              : todayLocalYyyyMmDd();
          await patientsApi.createComplementaryExamResult(patientId, exam.id, {
            performedAt,
            valueNumeric: ir.valueNumeric,
            valueText: ir.valueText || undefined,
            report: ir.report || undefined,
            ...(data.type === 'ANATOMOPATHOLOGICAL' && {
              isAbnormal: ir.isAbnormal,
            }),
          });
        }
      }
      return exam;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      toast.success('Exame complementar adicionado.');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao adicionar exame.');
    },
  });

  const resetForm = useCallback(() => {
    setSelectedCatalogEntry(null);
    form.reset({
      type: 'LABORATORY',
      name: '',
      code: '',
      specimen: '',
      unit: '',
      referenceRange: '',
      initialResult: {
        performedAt: todayLocalYyyyMmDd(),
        valueNumeric: undefined,
        valueText: '',
        isAbnormal: false,
        report: '',
        components: [],
      },
    });
  }, [form]);

  useEffect(() => {
    if (!open) {
      resetForm();
    } else {
      const current = form.getValues('initialResult.performedAt');
      if (!current || (typeof current === 'string' && current.trim() === '')) {
        form.setValue('initialResult.performedAt', todayLocalYyyyMmDd());
      }
    }
  }, [open, form, resetForm]);

  const onSelectCatalogEntry = (entry: CatalogExamEntry) => {
    setSelectedCatalogEntry(entry);
    form.setValue('name', entry.name);
    form.setValue('code', entry.code ?? '');
    form.setValue('specimen', entry.specimen ?? '');
    form.setValue('unit', entry.unit ?? '');
    form.setValue('referenceRange', entry.referenceRange ?? '');
    if (entry.isComposite && entry.components?.length) {
      form.setValue(
        'initialResult.components',
        defaultCompositeComponentRows(entry.components)
      );
    } else {
      form.setValue('initialResult.components', []);
    }
    inputRef.current?.blur();
  };

  const onSubmit = (data: CreateComplementaryExamFormData) => {
    const ir = data.initialResult;
    if (
      selectedCatalogEntry?.isComposite === true &&
      ir?.components &&
      ir.components.length > 0
    ) {
      const hasPanelData =
        (ir.report ?? '').trim() !== '' ||
        ir.components.some(
          (c) =>
            (typeof c.valueNumeric === 'number' &&
              !Number.isNaN(c.valueNumeric)) ||
            (c.valueText ?? '').trim() !== ''
        );
      if (hasPanelData && !(ir.performedAt ?? '').trim()) {
        form.setError('initialResult.performedAt', {
          message:
            'Informe a data da realização para salvar o resultado do painel.',
        });
        form.setFocus('initialResult.performedAt');
        toast.error('Informe a data da realização.');
        return;
      }
    }
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[90vh] overflow-y-auto',
          isComposite && compositeFields.length > 0 ? 'max-w-lg' : 'max-w-md'
        )}
      >
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Adicionar exame complementar</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      setSelectedCatalogEntry(null);
                      form.setValue('name', '');
                      form.setValue('code', '');
                      form.setValue('unit', '');
                      form.setValue('referenceRange', '');
                      form.setValue('initialResult.components', []);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EXAM_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exame</FormLabel>
                  <FormControl>
                    <ExamCatalogCombobox
                      options={catalogComboboxOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      onSelectOption={(opt) =>
                        onSelectCatalogEntry(opt.data)
                      }
                      inputRef={inputRef}
                      emptyText={
                        catalogLoading
                          ? 'Carregando catálogo...'
                          : 'Nenhum exame encontrado. Digite para buscar ou use um nome livre.'
                      }
                    />
                  </FormControl>
                  {catalogEmptyOnServer && (
                    <p className="text-xs text-amber-700 dark:text-amber-500">
                      Catálogo TUSS ainda não foi importado neste ambiente — lista
                      mínima local. Peça a um administrador para importar o arquivo
                      ANS ou rode o seed do banco.
                    </p>
                  )}
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
                  {lockUnitFromCatalog ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                      <Badge variant="secondary">{field.value || '—'}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Definido pelo catálogo
                      </span>
                    </div>
                  ) : (
                    <FormControl>
                      <Input placeholder="Ex: g/dL, mm" {...field} />
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
                  {lockRefFromCatalog ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                      <span className="font-mono text-xs">{field.value || '—'}</span>
                      <span className="text-xs text-muted-foreground">
                        Definido pelo catálogo
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

            {/* Amostra / espécime */}
            {specimenOptions.length > 0 && (
              <FormField
                control={form.control}
                name="specimen"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amostra / espécime (opcional)</FormLabel>
                    {lockSpecimenFromCatalog ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                        <Badge variant="outline">{field.value || '—'}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Definido pelo catálogo
                        </span>
                      </div>
                    ) : (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o material" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {specimenOptions.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Resultado inicial (opcional): painel composto ou exame simples */}
            {isComposite && compositeFields.length > 0 ? (
              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-sm font-medium">
                  Resultado inicial (opcional)
                </h4>
                <p className="text-xs text-muted-foreground">
                  Painel laboratorial: preencha os parâmetros desejados ou deixe
                  em branco para registrar só o pedido.
                </p>
                <FormField
                  control={form.control}
                  name="initialResult.performedAt"
                  render={({ field }) => {
                    const dateValue =
                      field.value && String(field.value).trim() !== ''
                        ? String(field.value).slice(0, 10)
                        : todayLocalYyyyMmDd();
                    return (
                      <FormItem>
                        <FormLabel>Data da realização</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={dateValue}
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <ComplementaryExamCompositeResultTable
                  control={form.control}
                  fields={compositeFields}
                  compositeComponents={
                    selectedCatalogEntry?.components ?? []
                  }
                  namePrefix="initialResult.components"
                />
                <FormField
                  control={form.control}
                  name="initialResult.report"
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
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-sm font-medium">
                  Resultado inicial (opcional)
                </h4>
                <FormField
                  control={form.control}
                  name="initialResult.performedAt"
                  render={({ field }) => {
                    const dateValue =
                      field.value && String(field.value).trim() !== ''
                        ? String(field.value).slice(0, 10)
                        : todayLocalYyyyMmDd();
                    return (
                      <FormItem>
                        <FormLabel>Data da realização</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={dateValue}
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="initialResult.valueNumeric"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor numérico</FormLabel>
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
                  <FormField
                    control={form.control}
                    name="initialResult.valueText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor texto</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Positivo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {examType === 'ANATOMOPATHOLOGICAL' ? (
                  <details className="rounded-md border border-dashed p-3 text-sm">
                    <summary className="cursor-pointer font-medium text-foreground">
                      Avançado
                    </summary>
                    <div className="mt-3">
                      <FormField
                        control={form.control}
                        name="initialResult.isAbnormal"
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
                ) : (
                  <AutoInterpretationPreview
                    control={form.control}
                    valueName="initialResult.valueNumeric"
                    referenceName="referenceRange"
                  />
                )}
                <FormField
                  control={form.control}
                  name="initialResult.report"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Laudo / observações</FormLabel>
                      <FormControl>
                        <textarea
                          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Texto livre do laudo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
