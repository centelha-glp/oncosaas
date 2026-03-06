/**
 * Opções padronizadas para o formulário de diagnóstico de câncer.
 * Facilita preenchimento e evita inconsistências de digitação.
 */

/** Códigos CID-10 mais comuns para neoplasias malignas (lista resumida) */
export const ICD10_COMMON_CANCER: Record<string, string> = {
  'C50.9': 'C50.9 - Mama (sítio não especificado)',
  'C50.0': 'C50.0 - Mama (mamilo)',
  'C34.1': 'C34.1 - Pulmão (lobo superior)',
  'C34.3': 'C34.3 - Pulmão (lobo inferior)',
  'C34.9': 'C34.9 - Pulmão (não especificado)',
  'C18.7': 'C18.7 - Cólon sigmoide',
  'C18.9': 'C18.9 - Cólon (não especificado)',
  'C19': 'C19 - Junção retossigmóidea',
  'C20': 'C20 - Reto',
  'C61': 'C61 - Próstata',
  'C67.9': 'C67.9 - Bexiga (não especificado)',
  'C64.1': 'C64.1 - Rim (não especificado)',
  'C53.9': 'C53.9 - Colo do útero',
  'C16.9': 'C16.9 - Estômago (não especificado)',
  'C25.0': 'C25.0 - Pâncreas (cabeça)',
  'C25.9': 'C25.9 - Pâncreas (não especificado)',
  'C22.0': 'C22.0 - Fígado (carcinoma hepatocelular)',
  'C73': 'C73 - Tireoide',
  'C91.0': 'C91.0 - Leucemia linfoide aguda',
  'C92.0': 'C92.0 - Leucemia mieloide aguda',
};

/** Chaves (códigos) para Select */
export const ICD10_OPTIONS = Object.entries(ICD10_COMMON_CANCER).map(
  ([code, label]) => ({ value: code, label })
);

/** Tipos histológicos comuns para Select (padronização) */
export const HISTOLOGICAL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'adenocarcinoma', label: 'Adenocarcinoma' },
  { value: 'carcinoma_escamoso', label: 'Carcinoma escamoso' },
  { value: 'carcinoma_pequenas_celulas', label: 'Carcinoma de pequenas células' },
  { value: 'carcinoma_celulas_grandes', label: 'Carcinoma de células grandes' },
  { value: 'carcinoma_indiferenciado', label: 'Carcinoma indiferenciado' },
  { value: 'carcinoma_ductal_invasivo', label: 'Carcinoma ductal invasivo' },
  { value: 'carcinoma_lobular_invasivo', label: 'Carcinoma lobular invasivo' },
  { value: 'melanoma', label: 'Melanoma' },
  { value: 'linfoma', label: 'Linfoma' },
  { value: 'sarcoma', label: 'Sarcoma' },
  { value: 'outro', label: 'Outro (especificar)' },
];

export const ICD10_OTHER_VALUE = '__other__';
