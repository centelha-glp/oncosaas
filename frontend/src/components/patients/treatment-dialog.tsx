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
import { TreatmentForm } from './treatment-form';
import {
  treatmentsApi,
  Treatment,
  CreateTreatmentData,
} from '@/lib/api/treatments';
import { CreateTreatmentFormData } from '@/lib/validations/treatment';
import { toast } from 'sonner';

interface TreatmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagnosisId: string;
  treatment?: Treatment;
  patientId: string;
}

export function TreatmentDialog({
  open,
  onOpenChange,
  diagnosisId,
  treatment,
  patientId,
}: TreatmentDialogProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: CreateTreatmentFormData) =>
      treatmentsApi.createTreatment(data as unknown as CreateTreatmentData),
    onSuccess: (): void => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({
        queryKey: ['treatments', diagnosisId],
      });
      toast.success('Tratamento criado com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error): void => {
      toast.error(`Erro ao criar tratamento: ${error.message}`);
    },
    onSettled: (): void => {
      setIsSubmitting(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      treatmentId,
      data,
    }: {
      treatmentId: string;
      data: CreateTreatmentFormData;
    }) => treatmentsApi.updateTreatment(treatmentId, data),
    onSuccess: (): void => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({
        queryKey: ['treatments', diagnosisId],
      });
      toast.success('Tratamento atualizado com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error): void => {
      toast.error(`Erro ao atualizar tratamento: ${error.message}`);
    },
    onSettled: (): void => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (data: CreateTreatmentFormData): Promise<void> => {
    setIsSubmitting(true);
    try {
      if (treatment) {
        await updateMutation.mutateAsync({
          treatmentId: treatment.id,
          data,
        });
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
            {treatment ? 'Editar Tratamento' : 'Adicionar Tratamento'}
          </DialogTitle>
          <DialogDescription>
            {treatment
              ? 'Atualize as informações do tratamento.'
              : 'Preencha os dados do novo tratamento.'}
          </DialogDescription>
        </DialogHeader>
        <TreatmentForm
          diagnosisId={diagnosisId}
          treatment={treatment}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
