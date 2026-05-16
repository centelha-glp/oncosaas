import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  oncologyNavigationApi,
  type ConsultationAgendaDayOverviewQuery,
  type ConsultationAgendaQuery,
  type ConsultationAvailableSlotsQuery,
  type CreateConsultationAppointmentDto,
  type CreateConsultationAgendaBlockPayload,
  type UpsertConsultationAgendaConfigPayload,
} from '@/lib/api/oncology-navigation';
import { STALE_TIME_PATIENT_NAVIGATION_MS } from '@/lib/query-stale-times';

export const useConsultationAgenda = (
  params: ConsultationAgendaQuery,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ['consultation-agenda', params],
    queryFn: () => oncologyNavigationApi.getConsultationAgenda(params),
    enabled:
      (options?.enabled ?? true) &&
      Boolean(params.from) &&
      Boolean(params.to),
    staleTime: 30 * 1000,
  });
};

/** Profissionais do tenant elegíveis para slots na agenda (ex.: filtro da secretária). */
export const useConsultationAgendaSchedulableProfessionals = (options?: {
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ['consultation-agenda-schedulable-professionals'],
    queryFn: () =>
      oncologyNavigationApi.listConsultationAgendaSchedulableProfessionals(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
};

export const usePatientNavigationSteps = (patientId: string | null) => {
  return useQuery({
    queryKey: ['navigation-steps', patientId],
    queryFn: () => oncologyNavigationApi.getPatientSteps(patientId!),
    enabled: !!patientId,
    staleTime: STALE_TIME_PATIENT_NAVIGATION_MS,
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
    staleTime: STALE_TIME_PATIENT_NAVIGATION_MS,
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
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda'] });
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

export const useCreateConsultationAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateConsultationAppointmentDto) =>
      oncologyNavigationApi.createConsultationAppointment(data),
    onSuccess: (step) => {
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda-day-overview'] });
      queryClient.invalidateQueries({ queryKey: ['navigation-steps'] });
      queryClient.invalidateQueries({ queryKey: ['patient', step.patientId] });
      toast.success('Consulta registrada na agenda.');
    },
    onError: (error: Error) => {
      toast.error('Não foi possível registrar a consulta.', {
        description: error.message || 'Tente novamente.',
      });
    },
  });
};

export const useSendConsultationConfirmation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stepId,
      message,
    }: {
      stepId: string;
      message?: string;
    }) =>
      oncologyNavigationApi.sendConsultationConfirmation(stepId, { message }),
    onSuccess: ({ step }) => {
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['navigation-steps'] });
      queryClient.invalidateQueries({ queryKey: ['patient', step.patientId] });
      toast.success('Mensagem de confirmação enviada ao paciente.');
    },
    onError: (error: Error) => {
      toast.error('Falha ao enviar confirmação.', {
        description: error.message || 'Verifique canal, opt-in e telefone.',
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
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda-day-overview'] });
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
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda'] });
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
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda-day-overview'] });
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
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda'] });
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

export const useConsultationAvailableSlots = (
  params: ConsultationAvailableSlotsQuery | null,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ['consultation-available-slots', params],
    queryFn: () => oncologyNavigationApi.getConsultationAvailableSlots(params!),
    enabled:
      (options?.enabled ?? true) &&
      !!params &&
      !!params.professionalId &&
      !!params.stepKey &&
      !!params.from &&
      !!params.to,
    staleTime: 15_000,
  });
};

export const useConsultationAgendaDayOverview = (
  params: ConsultationAgendaDayOverviewQuery | null,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ['consultation-agenda-day-overview', params],
    queryFn: () => oncologyNavigationApi.getConsultationAgendaDayOverview(params!),
    enabled:
      (options?.enabled ?? true) &&
      !!params &&
      !!params.professionalId &&
      !!params.from &&
      !!params.to,
    staleTime: 15_000,
  });
};

export const useConsultationAgendaConfig = (userId: string | null) => {
  return useQuery({
    queryKey: ['consultation-agenda-config', userId],
    queryFn: () => oncologyNavigationApi.getConsultationAgendaConfig(userId!),
    enabled: !!userId,
  });
};

export const useUpsertConsultationAgendaConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: string;
      body: UpsertConsultationAgendaConfigPayload;
    }) => oncologyNavigationApi.upsertConsultationAgendaConfig(userId, body),
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda-config', v.userId] });
      queryClient.invalidateQueries({ queryKey: ['consultation-available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda-day-overview'] });
      toast.success('Configuração da agenda guardada.');
    },
    onError: (error: Error) => {
      toast.error('Não foi possível guardar a agenda.', {
        description: error.message || 'Tente novamente.',
      });
    },
  });
};

export const useConsultationAgendaBlocks = (forProfessionalId: string | null) => {
  return useQuery({
    queryKey: ['consultation-agenda-blocks', forProfessionalId],
    queryFn: () =>
      oncologyNavigationApi.listConsultationAgendaBlocks(forProfessionalId ?? undefined),
    enabled: !!forProfessionalId,
  });
};

export const useCreateConsultationAgendaBlock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateConsultationAgendaBlockPayload) =>
      oncologyNavigationApi.createConsultationAgendaBlock(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda-day-overview'] });
      toast.success('Bloqueio criado.');
    },
    onError: (error: Error) => {
      toast.error('Não foi possível criar o bloqueio.', {
        description: error.message || 'Tente novamente.',
      });
    },
  });
};

export const useDeleteConsultationAgendaBlock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => oncologyNavigationApi.deleteConsultationAgendaBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-agenda-day-overview'] });
      toast.success('Bloqueio removido.');
    },
    onError: (error: Error) => {
      toast.error('Não foi possível remover o bloqueio.', {
        description: error.message || 'Tente novamente.',
      });
    },
  });
};
