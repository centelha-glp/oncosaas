import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { oncologyNavigationApi } from '@/lib/api/oncology-navigation';

export const usePatientNavigationSteps = (patientId: string | null) => {
  return useQuery({
    queryKey: ['navigation-steps', patientId],
    queryFn: () => oncologyNavigationApi.getPatientSteps(patientId!),
    enabled: !!patientId,
    staleTime: 30 * 1000, // 30 segundos
  });
};

export const useStepsByStage = (
  patientId: string | null,
  journeyStage:
    | 'SCREENING'
    | 'DIAGNOSIS'
    | 'TREATMENT'
    | 'FOLLOW_UP'
    | null
) => {
  return useQuery({
    queryKey: ['navigation-steps', patientId, journeyStage],
    queryFn: () =>
      oncologyNavigationApi.getStepsByStage(patientId!, journeyStage!),
    enabled: !!patientId && !!journeyStage,
    staleTime: 30 * 1000,
  });
};

export const useInitializeNavigationSteps = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      cancerType,
      currentStage,
    }: {
      patientId: string;
      cancerType: string;
      currentStage:
        | 'SCREENING'
        | 'DIAGNOSIS'
        | 'TREATMENT'
        | 'FOLLOW_UP';
    }) =>
      oncologyNavigationApi.initializeSteps(
        patientId,
        cancerType,
        currentStage
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['navigation-steps', variables.patientId],
      });
      queryClient.invalidateQueries({ queryKey: ['patient', variables.patientId] });
      toast.success('Etapas de navegação inicializadas!');
    },
    onError: (error: Error) => {
      console.error('Erro ao inicializar etapas:', error);
      toast.error('Falha ao inicializar etapas de navegação.', {
        description: error.message || 'Tente novamente.',
      });
    },
  });
};

export const useUpdateNavigationStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stepId,
      data,
    }: {
      stepId: string;
      data: Parameters<typeof oncologyNavigationApi.updateStep>[1];
    }) => oncologyNavigationApi.updateStep(stepId, data),
    onSuccess: (updatedStep) => {
      queryClient.invalidateQueries({ queryKey: ['navigation-steps'] });
      queryClient.invalidateQueries({ queryKey: ['patient', updatedStep.patientId] });
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar etapa:', error);
      toast.error('Falha ao atualizar etapa.', {
        description: error.message || 'Tente novamente.',
      });
    },
  });
};

export const useInitializeAllPatients = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => oncologyNavigationApi.initializeAllPatients(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient'] });
      queryClient.invalidateQueries({ queryKey: ['navigation-steps'] });
      toast.success('Etapas inicializadas para todos os pacientes!');
      return result;
    },
    onError: (error: Error) => {
      console.error('Erro ao inicializar etapas para todos:', error);
      toast.error('Falha ao inicializar etapas.', {
        description: error.message || 'Tente novamente.',
      });
    },
  });
};

export const useDeleteNavigationStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stepId }: { stepId: string; patientId: string }) =>
      oncologyNavigationApi.deleteStep(stepId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['navigation-steps'] });
      queryClient.invalidateQueries({ queryKey: ['patient', variables.patientId] });
    },
    onError: (error: Error) => {
      toast.error('Falha ao excluir etapa.', {
        description: error.message || 'Tente novamente.',
      });
    },
  });
};

export const useUploadStepFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stepId, file }: { stepId: string; file: File }) =>
      oncologyNavigationApi.uploadFile(stepId, file),
    onSuccess: (updatedStep) => {
      queryClient.invalidateQueries({ queryKey: ['navigation-steps'] });
      queryClient.invalidateQueries({ queryKey: ['patient', updatedStep.patientId] });
      toast.success('Arquivo enviado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Falha ao enviar arquivo.', {
        description: error.message || 'Verifique o arquivo e tente novamente.',
      });
    },
  });
};
