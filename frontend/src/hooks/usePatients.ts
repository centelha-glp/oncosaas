import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  patientsApi,
  Patient,
  CreatePatientDto,
  UpdatePatientDto,
  type PatientsListParams,
} from '@/lib/api/patients';

export const usePatients = (listParams?: PatientsListParams) => {
  return useQuery({
    queryKey: ['patients', listParams ?? {}],
    queryFn: () => patientsApi.getAll(listParams),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

export const usePatient = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: () => patientsApi.getById(id),
    enabled: options?.enabled !== undefined ? options.enabled : !!id,
    staleTime: 60_000, // 1 min — detalhe de paciente
  });
};

export const useCreatePatient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePatientDto) => patientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Paciente criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Falha ao criar paciente.', {
        description: error.message || 'Verifique os dados e tente novamente.',
      });
    },
  });
};

export const useUpdatePatient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePatientDto }) =>
      patientsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients', variables.id] });
      toast.success('Paciente atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Falha ao atualizar paciente.', {
        description: error.message || 'Verifique os dados e tente novamente.',
      });
    },
  });
};

export const useDeletePatient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => patientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Paciente removido com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Falha ao remover paciente.', {
        description: error.message || 'Tente novamente mais tarde.',
      });
    },
  });
};
