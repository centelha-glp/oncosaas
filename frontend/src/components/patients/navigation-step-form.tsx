'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  updateNavigationStepSchema,
  UpdateNavigationStepFormData,
  navigationStepStatusSchema,
} from '@/lib/validations/navigation-step';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { NavigationStep } from '@/lib/api/navigation';
import { NAVIGATION_STEP_UI_DATE_LABEL } from '@/lib/utils/navigation-step-dates';

const STEP_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluída',
  OVERDUE: 'Atrasada',
  CANCELLED: 'Cancelada',
  NOT_APPLICABLE: 'Não Aplicável',
};

interface NavigationStepFormProps {
  step: NavigationStep;
  onSubmit: (data: UpdateNavigationStepFormData) => Promise<void>;
  onCancel?: () => void;
}

export function NavigationStepForm({
  step,
  onSubmit,
  onCancel,
}: NavigationStepFormProps) {
  // Valida e converte o status para o tipo esperado
  const getValidStatus = (
    status: string | undefined
  ): UpdateNavigationStepFormData['status'] => {
    if (!status) return undefined;
    const result = navigationStepStatusSchema.safeParse(status);
    return result.success ? result.data : undefined;
  };

  const form = useForm<UpdateNavigationStepFormData>({
    resolver: zodResolver(updateNavigationStepSchema),
    defaultValues: {
      status: getValidStatus(step.status),
      isCompleted: step.isCompleted || undefined,
      completedAt: step.completedAt
        ? typeof step.completedAt === 'string' && step.completedAt.includes('T')
          ? step.completedAt
          : new Date(step.completedAt).toISOString()
        : undefined,
      actualDate: step.actualDate
        ? typeof step.actualDate === 'string' && step.actualDate.includes('T')
          ? step.actualDate
          : new Date(step.actualDate).toISOString()
        : undefined,
      dueDate: step.dueDate
        ? typeof step.dueDate === 'string' && step.dueDate.includes('T')
          ? step.dueDate
          : new Date(step.dueDate).toISOString()
        : undefined,
      expectedDate: step.expectedDate
        ? typeof step.expectedDate === 'string' && step.expectedDate.includes('T')
          ? step.expectedDate
          : new Date(step.expectedDate).toISOString()
        : undefined,
      institutionName: step.institutionName || undefined,
      professionalName: step.professionalName || undefined,
      result: step.result || undefined,
      findings: step.findings || undefined,
      notes: step.notes || undefined,
    },
  });

  const handleSubmit = async (data: UpdateNavigationStepFormData) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(STEP_STATUS_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Concluída */}
          <FormField
            control={form.control}
            name="isCompleted"
            render={({ field }) => (
              <FormItem className="flex flex-col justify-end">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isCompleted"
                    checked={field.value || false}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <FormLabel htmlFor="isCompleted" className="cursor-pointer">
                    Etapa Concluída
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Data agendada (expectedDate) */}
          <FormField
            control={form.control}
            name="expectedDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data agendada</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                        aria-label={`${NAVIGATION_STEP_UI_DATE_LABEL.agendada}, opcional`}
                      >
                        {field.value ? (
                          format(new Date(field.value), 'dd/MM/yyyy', {
                            locale: ptBR,
                          })
                        ) : (
                          <span>Selecione a data</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" aria-hidden />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) =>
                        field.onChange(date ? date.toISOString() : undefined)
                      }
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Data limite (dueDate) */}
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data limite</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                        aria-label={`${NAVIGATION_STEP_UI_DATE_LABEL.limite}`}
                      >
                        {field.value ? (
                          format(new Date(field.value), 'dd/MM/yyyy', {
                            locale: ptBR,
                          })
                        ) : (
                          <span>Selecione a data</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" aria-hidden />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) =>
                        field.onChange(date ? date.toISOString() : undefined)
                      }
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Data realizada (actualDate) */}
          <FormField
            control={form.control}
            name="actualDate"
            render={({ field }) => (
              <FormItem className="flex flex-col md:col-span-2">
                <FormLabel>Data realizada</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                        aria-label={`${NAVIGATION_STEP_UI_DATE_LABEL.realizada}, opcional`}
                      >
                        {field.value ? (
                          format(new Date(field.value), 'dd/MM/yyyy', {
                            locale: ptBR,
                          })
                        ) : (
                          <span>Selecione a data</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" aria-hidden />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) =>
                        field.onChange(date ? date.toISOString() : undefined)
                      }
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Instituição */}
          <FormField
            control={form.control}
            name="institutionName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instituição</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Nome da instituição" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Profissional */}
          <FormField
            control={form.control}
            name="professionalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profissional</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Nome do profissional" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Resultado */}
          <FormField
            control={form.control}
            name="result"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Resultado</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Resultado da etapa" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notas */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Observações sobre a etapa..."
                  rows={4}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Botões */}
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : 'Atualizar'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
