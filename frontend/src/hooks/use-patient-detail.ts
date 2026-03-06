import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  patientsApi,
  PatientDetail,
  PatientSummaryResponse,
} from '@/lib/api/patients';

export const usePatientDetail = (id: string | null) => {
  return useQuery<PatientDetail>({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.getDetail(id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
};

export const usePatientSummary = (patientId: string | null) => {
  return useQuery<PatientSummaryResponse>({
    queryKey: ['patient-summary', patientId],
    queryFn: () => patientsApi.getPatientSummary(patientId!),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export const useRefreshPatientSummary = () => {
  const queryClient = useQueryClient();
  return (patientId: string) =>
    queryClient.invalidateQueries({
      queryKey: ['patient-summary', patientId],
    });
};
