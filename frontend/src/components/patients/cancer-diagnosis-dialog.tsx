'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CancerDiagnosisForm } from './cancer-diagnosis-form';
import { patientsApi, CancerDiagnosis } from '@/lib/api/patients';
import { CancerDiagnosisFormData } from '@/lib/validations/cancer-diagnosis';
import { toast } from 'sonner';

interface CancerDiagnosisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  diagnosis?: CancerDiagnosis;
  /** Ao preencher sem diagnosis, abre o formulário para adicionar câncer metastático a este primário */
  primaryDiagnosisId?: string;
  /** Nome do câncer primário (para exibir no título quando for metastático) */
  primaryCancerType?: string;
}

export function CancerDiagnosisDialog({
  open,
  onOpenChange,
  patientId,
  diagnosis,
  primaryDiagnosisId,
  primaryCancerType,
}: CancerDiagnosisDialogProps): React.ReactElement {
  const isAddingMetastatic = !!primaryDiagnosisId && !diagnosis;
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: CancerDiagnosisFormData) =>
      patientsApi.createCancerDiagnosis(patientId, data),
    onSuccess: (): void => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({
        queryKey: ['cancer-diagnoses', patientId],
      });
      toast.success('Diagnóstico de câncer criado com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error): void => {
      toast.error(`Erro ao criar diagnóstico: ${error.message}`);
    },
    onSettled: (): void => {
      setIsSubmitting(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      diagnosisId,
      data,
    }: {
      diagnosisId: string;
      data: CancerDiagnosisFormData;
    }) => patientsApi.updateCancerDiagnosis(patientId, diagnosisId, data),
    onSuccess: (): void => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({
        queryKey: ['cancer-diagnoses', patientId],
      });
      toast.success('Diagnóstico de câncer atualizado com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error): void => {
      toast.error(`Erro ao atualizar diagnóstico: ${error.message}`);
    },
    onSettled: (): void => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (data: CancerDiagnosisFormData): Promise<void> => {
    setIsSubmitting(true);
    try {
      if (diagnosis) {
        await updateMutation.mutateAsync({ diagnosisId: diagnosis.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (error) {
      // Erro já tratado no onError do mutation
    }
  };

  const handleCancel = (): void => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {diagnosis
              ? 'Editar Diagnóstico de Câncer'
              : isAddingMetastatic
                ? 'Adicionar Câncer Metastático'
                : 'Adicionar Diagnóstico de Câncer'}
          </DialogTitle>
          <DialogDescription>
            {diagnosis
              ? 'Atualize as informações do diagnóstico de câncer.'
              : isAddingMetastatic
                ? primaryCancerType
                  ? `Registrar metástase associada ao primário: ${primaryCancerType}.`
                  : 'Registrar câncer metastático associado ao diagnóstico primário.'
                : 'Preencha os dados do novo diagnóstico de câncer.'}
          </DialogDescription>
        </DialogHeader>
        <CancerDiagnosisForm
          patientId={patientId}
          diagnosis={diagnosis}
          primaryDiagnosisId={primaryDiagnosisId}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
