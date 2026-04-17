'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Bug } from 'lucide-react';
import { toast } from 'sonner';
import { isPublicPathname } from '@/lib/auth/public-paths';
import { productFeedbackApi } from '@/lib/api/product-feedback';
import {
  productFeedbackFormSchema,
  type ProductFeedbackFormValues,
} from '@/lib/validations/product-feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';

export function ProductFeedbackFab() {
  const pathname = usePathname();
  const titleId = useId();
  const descId = useId();
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);

  const form = useForm<ProductFeedbackFormValues>({
    resolver: zodResolver(productFeedbackFormSchema),
    defaultValues: {
      type: 'BUG',
      title: '',
      description: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProductFeedbackFormValues) =>
      productFeedbackApi.create({
        ...values,
        pageUrl:
          typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    onSuccess: () => {
      toast.success('Feedback enviado. Obrigado!');
      form.reset({ type: 'BUG', title: '', description: '' });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Não foi possível enviar o feedback.');
    },
  });

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!pathname || isPublicPathname(pathname)) {
    return null;
  }

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
        <Button
          type="button"
          size="icon"
          className={cn(
            'pointer-events-auto h-12 w-12 min-h-12 min-w-12 rounded-full shadow-lg',
            'bg-indigo-600 text-white hover:bg-indigo-700',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
          onClick={() => setOpen(true)}
          aria-label="Enviar feedback ou reportar problema"
        >
          <Bug className="h-6 w-6 shrink-0 stroke-[2.25]" aria-hidden />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <DialogClose onClose={() => setOpen(false)} />
          <DialogHeader>
            <DialogTitle id={titleId}>Feedback do produto</DialogTitle>
            <DialogDescription id={descId}>
              Reporte um bug ou sugira uma melhoria. A sua mensagem fica
              registada para a equipa ONCONAV.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <FormControl>
                      <select
                        ref={firstFieldRef}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={field.value}
                        name={field.name}
                        onBlur={field.onBlur}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value as ProductFeedbackFormValues['type']
                          )
                        }
                      >
                        <option value="BUG">Bug / problema</option>
                        <option value="FEATURE">Sugestão de funcionalidade</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <input
                        type="text"
                        autoComplete="off"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="Resumo curto"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="O que aconteceu ou o que gostaria de ver?"
                        rows={5}
                        className="resize-y"
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
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? 'A enviar…' : 'Enviar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
