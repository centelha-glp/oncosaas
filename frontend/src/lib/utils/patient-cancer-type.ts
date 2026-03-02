/**
 * Retorna o tipo de câncer primário de um paciente.
 * Prioriza cancerDiagnoses[0].cancerType (novo campo) sobre cancerType (campo legado).
 */
export function getPatientCancerType(patient: {
  cancerType?: string | null;
  cancerDiagnoses?: Array<{ cancerType?: string | null }> | null;
}): string | null {
  if (patient.cancerDiagnoses && patient.cancerDiagnoses.length > 0) {
    return patient.cancerDiagnoses[0]?.cancerType ?? null;
  }
  return patient.cancerType ?? null;
}

/**
 * Retorna todos os tipos de câncer de um paciente como array.
 */
export function getPatientAllCancerTypes(patient: {
  cancerType?: string | null;
  cancerDiagnoses?: Array<{ cancerType?: string | null }> | null;
}): string[] {
  if (patient.cancerDiagnoses && patient.cancerDiagnoses.length > 0) {
    return patient.cancerDiagnoses
      .map((d) => d.cancerType)
      .filter((t): t is string => !!t);
  }
  return patient.cancerType ? [patient.cancerType] : [];
}
