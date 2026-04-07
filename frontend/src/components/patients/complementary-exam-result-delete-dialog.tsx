'use client';

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { patientsApi } from '@/lib/api/patients';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ComplementaryExamResultDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  examId: string;
  examName: string;
  performedAt: string;
  resultId: string;
  onSuccess?: () => void;
}

export function ComplementaryExamResultDeleteDialog({
  open,
  onOpenChange,
  patientId,
  examId,
  examName,
  performedAt,
  resultId,
  onSuccess,
}: ComplementaryExamResultDeleteDialogProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const deleteMutation = useMutation({
    mutationFn: () =>
      patientsApi.deleteComplementaryExamResult(patientId, examId, resultId, {
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      toast.success('Resultado removido.');
      setReason('');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao remover resultado.');
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason('');
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover resultado?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                O registro de <span className="font-medium text-foreground">{examName}</span> em{' '}
                <span className="font-medium text-foreground">
                  {format(new Date(performedAt), 'dd/MM/yyyy', { locale: ptBR })}
                </span>{' '}
                será ocultado. Apenas administradores podem restaurar depois.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-reason">Motivo (opcional)</Label>
                <textarea
                  id="delete-reason"
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Ex.: laudo duplicado, valor incorreto..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteMutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
