'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useForm, useWatch } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  filterCatalogByTypeAndSearch,
  type CatalogExamEntry,
} from '@/lib/data/complementary-exams-catalog';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

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
  const [comboboxOpenState, setComboboxOpen] = useState(false);
  const comboboxOpen = open && comboboxOpenState;
  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateComplementaryExamFormData>({
    resolver: zodResolver(createComplementaryExamSchema),
    defaultValues: {
      type: 'LABORATORY',
      name: '',
      code: '',
      unit: '',
      referenceRange: '',
      initialResult: {
        performedAt: new Date().toISOString().slice(0, 10),
        valueNumeric: undefined,
        valueText: '',
        isAbnormal: false,
        report: '',
      },
    },
  });

  const examType = useWatch({ control: form.control, name: 'type' });
  const searchQuery = useWatch({ control: form.control, name: 'name' });
  const catalogOptions = filterCatalogByTypeAndSearch(
    examType,
    searchQuery ?? ''
  );

  const createMutation = useMutation({
    mutationFn: async (data: CreateComplementaryExamFormData) => {
      const exam = await patientsApi.createComplementaryExam(patientId, {
        type: data.type,
        name: data.name,
        code: data.code || undefined,
        unit: data.unit || undefined,
        referenceRange: data.referenceRange || undefined,
      });
      const ir = data.initialResult;
      const hasInitialResult =
        ir &&
        (ir.performedAt ?? '').trim() !== '' &&
        (typeof ir.valueNumeric === 'number' ||
          (ir.valueText ?? '').trim() !== '' ||
          (ir.report ?? '').trim() !== '');
      if (hasInitialResult && ir) {
        const performedAt =
          (ir.performedAt ?? '').trim() !== ''
            ? new Date(ir.performedAt!).toISOString()
            : new Date().toISOString();
        await patientsApi.createComplementaryExamResult(patientId, exam.id, {
          performedAt,
          valueNumeric: ir.valueNumeric,
          valueText: ir.valueText || undefined,
          isAbnormal: ir.isAbnormal,
          report: ir.report || undefined,
        });
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
    form.reset({
      type: 'LABORATORY',
      name: '',
      code: '',
      unit: '',
      referenceRange: '',
      initialResult: {
        performedAt: new Date().toISOString().slice(0, 10),
        valueNumeric: undefined,
        valueText: '',
        isAbnormal: false,
        report: '',
      },
    });
  }, [form]);

  useEffect(() => {
    if (!open) {
      resetForm();
    } else {
      const current = form.getValues('initialResult.performedAt');
      if (!current || (typeof current === 'string' && current.trim() === '')) {
        form.setValue(
          'initialResult.performedAt',
          new Date().toISOString().slice(0, 10)
        );
      }
    }
  }, [open, form, resetForm]);

  const onSelectCatalogEntry = (entry: CatalogExamEntry) => {
    form.setValue('name', entry.name);
    form.setValue('code', entry.code ?? '');
    form.setValue('unit', entry.unit ?? '');
    form.setValue('referenceRange', entry.referenceRange ?? '');
    setComboboxOpen(false);
    inputRef.current?.blur();
  };

  const onSubmit = (data: CreateComplementaryExamFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                      form.setValue('name', '');
                      form.setValue('code', '');
                      form.setValue('unit', '');
                      form.setValue('referenceRange', '');
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
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="Pesquisar por nome ou código..."
                            {...field}
                            ref={inputRef}
                            onChange={(e) => field.onChange(e.target.value)}
                            onFocus={() => setComboboxOpen(true)}
                            className="pr-8"
                          />
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <ul className="max-h-48 overflow-auto py-1">
                        {catalogOptions.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-muted-foreground">
                            Nenhum exame encontrado. Digite para buscar ou use
                            um nome livre.
                          </li>
                        ) : (
                          catalogOptions.map((entry) => (
                            <li
                              key={`${entry.type}-${entry.name}-${entry.code ?? ''}`}
                            >
                              <button
                                type="button"
                                className={cn(
                                  'w-full text-left px-3 py-2 text-sm hover:bg-accent focus:bg-accent focus:outline-none'
                                )}
                                onClick={() => onSelectCatalogEntry(entry)}
                              >
                                {catalogDisplayLabel(entry)}
                                {(entry.unit || entry.referenceRange) && (
                                  <span className="block text-xs text-muted-foreground mt-0.5">
                                    {[entry.unit, entry.referenceRange]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </PopoverContent>
                  </Popover>
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
                  <FormControl>
                    <Input placeholder="Ex: g/dL, mm" {...field} />
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

            {/* Resultado inicial (opcional) */}
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
                      : new Date().toISOString().slice(0, 10);
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
                      <FormLabel>Fora da referência</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
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
