/** Mapeamento valor interno (inglês) → label em português para exibição */
export const CANCER_TYPE_LABELS: Record<string, string> = {
  breast: 'Mama',
  lung: 'Pulmão',
  colorectal: 'Colorretal',
  prostate: 'Próstata',
  kidney: 'Rim',
  bladder: 'Bexiga',
  testicular: 'Testículo',
  other: 'Outros',
};

/** Chaves válidas para o Select (valores em inglês) */
export const CANCER_TYPE_KEYS = Object.keys(CANCER_TYPE_LABELS) as string[];

/**
 * Converte valor da API (pode ser key "lung" ou label "Câncer de Pulmão" / "Pulmão") para a key do Select.
 * O backend pode retornar cancerType como label em cancerDiagnoses.
 */
export function getCancerTypeKey(
  raw: string | null | undefined
): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const lower = raw.toLowerCase().trim();
  if (CANCER_TYPE_LABELS[lower]) return lower;
  for (const [key, label] of Object.entries(CANCER_TYPE_LABELS)) {
    if (label.toLowerCase() === lower) return key;
    if (label.toLowerCase().includes(lower) || lower.includes(label.toLowerCase())) return key;
  }
  if (CANCER_TYPE_KEYS.includes(lower)) return lower;
  return null;
}

/**
 * Retorna o label em português para um tipo de câncer (valor pode vir em qualquer case).
 */
export function getCancerTypeLabel(
  cancerType: string | null | undefined
): string {
  if (!cancerType) return '';
  const key = getCancerTypeKey(cancerType) ?? cancerType.toLowerCase();
  return CANCER_TYPE_LABELS[key] ?? cancerType;
}

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
