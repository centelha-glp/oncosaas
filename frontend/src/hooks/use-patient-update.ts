import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patientsApi, UpdatePatientDto, Patient } from '@/lib/api/patients';

export function usePatientUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePatientDto }) =>
      patientsApi.update(id, data),
    onSuccess: async (updatedPatient: Patient) => {
      // Atualizar cache do paciente imediatamente (painel de detalhes no chat)
      queryClient.setQueryData(
        ['patients', updatedPatient.id],
        updatedPatient
      );
      // Refetch do detalhe (usado em /patients/[id] e /patients/[id]/edit) para UI atualizar
      await queryClient.refetchQueries({
        queryKey: ['patient', updatedPatient.id],
      });
      await queryClient.refetchQueries({
        queryKey: ['patient-detail', updatedPatient.id],
      });
      // Invalidar lista para sidebar/lista atualizar
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
