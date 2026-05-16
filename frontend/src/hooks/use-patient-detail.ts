import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  patientsApi,
  Patient,
  PatientDetail,
  PatientSummaryResponse,
} from '@/lib/api/patients';
import { STALE_TIME_PATIENT_NAVIGATION_MS } from '@/lib/query-stale-times';

export const usePatientDetail = (id: string | null) => {
  return useQuery<PatientDetail>({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.getDetail(id!),
    enabled: !!id,
    staleTime: STALE_TIME_PATIENT_NAVIGATION_MS,
  });
};

/** Resumo do paciente (GET /patients/:id) para telas que não precisam do bundle clínico completo. */
export const usePatientBasic = (id: string | null) => {
  return useQuery<Patient>({
    queryKey: ['patient-basic', id],
    queryFn: () => patientsApi.getById(id!),
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
