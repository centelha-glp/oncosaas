'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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

  const form = useForm<CreateComplementaryExamResultFormData>({
    resolver: zodResolver(createComplementaryExamResultSchema),
    defaultValues: {
      performedAt: new Date().toISOString().slice(0, 10),
      valueNumeric: undefined,
      valueText: '',
      unit: exam.unit ?? '',
      referenceRange: exam.referenceRange ?? '',
      isAbnormal: false,
      report: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateComplementaryExamResultFormData) =>
      patientsApi.createComplementaryExamResult(patientId, exam.id, {
        performedAt: new Date(data.performedAt).toISOString(),
        valueNumeric: data.valueNumeric,
        valueText: data.valueText || undefined,
        unit: data.unit || undefined,
        referenceRange: data.referenceRange || undefined,
        isAbnormal: data.isAbnormal,
        report: data.report || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      toast.success('Resultado adicionado.');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao adicionar resultado.');
    },
  });

  function resetForm() {
    form.reset({
      performedAt: new Date().toISOString().slice(0, 10),
      valueNumeric: undefined,
      valueText: '',
      unit: exam.unit ?? '',
      referenceRange: exam.referenceRange ?? '',
      isAbnormal: false,
      report: '',
    });
  }

  useEffect(() => {
    if (open) {
      form.reset({
        performedAt: new Date().toISOString().slice(0, 10),
        valueNumeric: undefined,
        valueText: '',
        unit: exam.unit ?? '',
        referenceRange: exam.referenceRange ?? '',
        isAbnormal: false,
        report: '',
      });
    }
  }, [open, exam.id, exam.unit, exam.referenceRange, form]);

  const onSubmit = (data: CreateComplementaryExamResultFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Adicionar resultado — {exam.name}</DialogTitle>
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
            <FormField
              control={form.control}
              name="valueText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor texto (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Positivo, Negativo"
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
            <FormField
              control={form.control}
              name="report"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Laudo / observações (opcional)</FormLabel>
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
