/** Chaves internas das seções (V1) — usadas em scaffolds/sugestões e conversão de legado */
export const CLINICAL_NOTE_SECTION_KEYS = [
  'identificacao',
  'hda',
  'hpp',
  'comorbidades',
  'medicacoesEmUso',
  'alergias',
  'subjetivo',
  'exameFisico',
  'examesComplementares',
  'analise',
  'conduta',
  'tratamentos',
  'navegacao',
  'planos',
] as const;

export type ClinicalNoteSectionKey = (typeof CLINICAL_NOTE_SECTION_KEYS)[number];

/** Limite por campo (caracteres) — legado V1 por seção */
export const CLINICAL_NOTE_SECTION_MAX_LENGTH = 32_000;

/**
 * Chave da etapa de navegação universal correspondente a cada tipo de evolução.
 * Alinhado a `mergeUniversalStepConfigs` em oncology-navigation.service.ts.
 */
export const CLINICAL_NOTE_NAVIGATION_STEP_KEY = {
  MEDICAL: 'specialist_consultation',
  NURSING: 'navigation_consultation',
} as const;
