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

/** Valor especial para "Tratamento a definir" (estágio Tratamento) */
export const TREATMENT_OPTION_A_DEFINIR = 'A definir';

/** Opções de tratamento por tipo de câncer (para Select no formulário de criação) */
export const TREATMENT_OPTIONS_BY_CANCER_TYPE: Record<string, string[]> = {
  breast: [
    'Cirurgia',
    'Quimioterapia',
    'Radioterapia',
    'Hormonoterapia',
    'Terapia-alvo',
    'Imunoterapia',
  ],
  lung: [
    'Cirurgia',
    'Quimioterapia',
    'Radioterapia',
    'Terapia-alvo',
    'Imunoterapia',
  ],
  colorectal: [
    'Cirurgia',
    'Quimioterapia',
    'Radioterapia',
    'Terapia-alvo',
    'Imunoterapia',
  ],
  prostate: [
    'Cirurgia',
    'Radioterapia',
    'Hormonoterapia',
    'Quimioterapia',
  ],
  kidney: ['Cirurgia', 'Terapia-alvo', 'Imunoterapia'],
  bladder: ['Cirurgia', 'Quimioterapia', 'Radioterapia', 'Imunoterapia'],
  testicular: ['Cirurgia', 'Quimioterapia', 'Radioterapia'],
  other: [
    'Cirurgia',
    'Quimioterapia',
    'Radioterapia',
    'Hormonoterapia',
    'Terapia-alvo',
    'Imunoterapia',
    'Cuidados paliativos',
  ],
};

/**
 * Retorna as opções de tratamento para o tipo de câncer (para uso no Select).
 * Se estágio for Tratamento, inclui "A definir" como primeira opção.
 */
export function getTreatmentOptionsForCancerType(
  cancerTypeKey: string | null | undefined,
  includeADefinir: boolean
): string[] {
  const list =
    TREATMENT_OPTIONS_BY_CANCER_TYPE[cancerTypeKey ?? ''] ??
    TREATMENT_OPTIONS_BY_CANCER_TYPE.other;
  if (includeADefinir) {
    return [TREATMENT_OPTION_A_DEFINIR, ...list];
  }
  return [...list];
}

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

/** Default MVP: apenas bexiga habilitada */
const DEFAULT_ENABLED_CANCER_TYPES = ['bladder'];

/**
 * Filtra CANCER_TYPE_LABELS para retornar apenas os tipos habilitados pelo tenant.
 * Se `enabledTypes` for vazio/null, usa default MVP (['bladder']).
 */
export function getEnabledCancerTypeLabels(
  enabledTypes?: string[] | null,
): Record<string, string> {
  const enabled = enabledTypes?.length
    ? enabledTypes.map((t) => t.toLowerCase())
    : DEFAULT_ENABLED_CANCER_TYPES;

  return Object.fromEntries(
    Object.entries(CANCER_TYPE_LABELS).filter(([key]) =>
      enabled.includes(key),
    ),
  );
}

/**
 * Retorna as chaves dos tipos de câncer habilitados como array.
 */
export function getEnabledCancerTypeKeys(
  enabledTypes?: string[] | null,
): string[] {
  return Object.keys(getEnabledCancerTypeLabels(enabledTypes));
}
