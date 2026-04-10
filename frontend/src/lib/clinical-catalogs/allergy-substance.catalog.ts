/** Espelha o catálogo do backend (`allergy-substance.catalog.ts`). */
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
  NKDA: {
    label: 'Nega alergias medicamentosas conhecidas (NKDA)',
    category: 'OTHER',
  },
  OTHER: { label: 'Outra (especificar)', category: 'OTHER' },
};

export const ALLERGY_SUBSTANCE_SELECT_OPTIONS = Object.entries(
  ALLERGY_SUBSTANCE_CATALOG
).map(([value, { label }]) => ({ value, label }));
