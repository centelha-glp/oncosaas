/** Chaves estáveis das seções do prontuário (V1) — ordem de exibição no frontend */
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

/** Limite por campo (caracteres) para evitar payloads abusivos */
export const CLINICAL_NOTE_SECTION_MAX_LENGTH = 32_000;
