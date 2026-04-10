/** Categoria clínica automática para alergias (catálogo canônico). */
export type AllergyCategoryCode =
  | 'MEDICATION'
  | 'CONTRAST'
  | 'LATEX'
  | 'FOOD_OR_ENVIRONMENT'
  | 'OTHER';

export interface AllergyCatalogEntry {
  label: string;
  category: AllergyCategoryCode;
}

/** substanceKey → rótulo + categoria (servidor é fonte da verdade). */
export const ALLERGY_SUBSTANCE_CATALOG: Record<string, AllergyCatalogEntry> = {
  PENICILLIN: { label: 'Penicilinas', category: 'MEDICATION' },
  CEPHALOSPORIN: { label: 'Cefalosporinas', category: 'MEDICATION' },
  SULFONAMIDE: { label: 'Sulfonamidas', category: 'MEDICATION' },
  NSAID_ASA: { label: 'AINE / AAS', category: 'MEDICATION' },
  OPIOID: { label: 'Opioides', category: 'MEDICATION' },
  CONTRAST_IODINATED: { label: 'Contraste iodado', category: 'CONTRAST' },
  LATEX: { label: 'Látex', category: 'LATEX' },
  CHLORHEXIDINE: { label: 'Clorexidina', category: 'MEDICATION' },
  IODINE_TOPICAL: { label: 'Iodo tópico', category: 'MEDICATION' },
  SHELLFISH: { label: 'Frutos do mar', category: 'FOOD_OR_ENVIRONMENT' },
  NKDA: { label: 'Nega alergias medicamentosas conhecidas (NKDA)', category: 'OTHER' },
  OTHER: { label: 'Outra (especificar)', category: 'OTHER' },
};

export const ALLERGY_SUBSTANCE_KEYS = Object.keys(ALLERGY_SUBSTANCE_CATALOG);

export function getAllergyCatalogEntry(
  key: string | null | undefined
): AllergyCatalogEntry | null {
  if (!key || typeof key !== 'string') {
    return null;
  }
  return ALLERGY_SUBSTANCE_CATALOG[key] ?? null;
}

export function isValidAllergySubstanceKey(key: string): boolean {
  return key in ALLERGY_SUBSTANCE_CATALOG;
}
