import type { Patient } from '@/lib/api/patients';

/**
 * Pacientes elegíveis para a página Navegação Oncológica: tipo de tumor definido
 * no cadastro ou em diagnóstico ativo (lista com include de diagnósticos).
 */
export function patientEligibleForOncologyNavigationPage(
  patient: Patient
): boolean {
  if (patient.cancerType?.trim()) return true;
  return (
    patient.cancerDiagnoses?.some(
      (d) =>
        d.isActive !== false &&
        typeof d.cancerType === 'string' &&
        d.cancerType.trim() !== ''
    ) ?? false
  );
}
