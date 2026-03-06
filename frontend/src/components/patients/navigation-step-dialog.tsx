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
import { NavigationStepForm } from './navigation-step-form';
import { navigationApi, NavigationStep } from '@/lib/api/navigation';
import { UpdateNavigationStepFormData } from '@/lib/validations/navigation-step';
import { toast } from 'sonner';

interface NavigationStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: NavigationStep;
  patientId: string;
}

export function NavigationStepDialog({
  open,
  onOpenChange,
  step,
  patientId,
}: NavigationStepDialogProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateNavigationStepFormData) =>
      navigationApi.updateStep(step.id, data),
    onSuccess: (): void => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({
        queryKey: ['navigation-steps', patientId],
      });
      toast.success('Etapa de navegação atualizada com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error): void => {
      toast.error(`Erro ao atualizar etapa: ${error.message}`);
    },
    onSettled: (): void => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (
    data: UpdateNavigationStepFormData
  ): Promise<void> => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync(data);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Etapa de Navegação</DialogTitle>
          <DialogDescription>
            Atualize as informações da etapa: {step.stepName}
          </DialogDescription>
        </DialogHeader>
        <NavigationStepForm
          step={step}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
