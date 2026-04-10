import type { MedicationCategory } from '@/lib/api/patients';

export interface MedicationCatalogEntry {
  label: string;
  category: MedicationCategory;
}

/** Espelha o catálogo do backend (`medication-catalog.ts`). */
export const MEDICATION_CATALOG: Record<string, MedicationCatalogEntry> = {
  WARFARIN: { label: 'Varfarina', category: 'ANTICOAGULANT' },
  RIVAROXABAN: { label: 'Rivaroxabana', category: 'ANTICOAGULANT' },
  APIXABAN: { label: 'Apixabana', category: 'ANTICOAGULANT' },
  ENOXAPARIN: { label: 'Enoxaparina', category: 'ANTICOAGULANT' },
  ASPIRIN_LOW: { label: 'AAS (antiagregante)', category: 'ANTIPLATELET' },
  CLOPIDOGREL: { label: 'Clopidogrel', category: 'ANTIPLATELET' },
  PREDNISONE: { label: 'Prednisona', category: 'CORTICOSTEROID' },
  DEXAMETHASONE: { label: 'Dexametasona', category: 'CORTICOSTEROID' },
  MORPHINE: { label: 'Morfina', category: 'OPIOID_ANALGESIC' },
  OXYCODONE: { label: 'Oxicodona', category: 'OPIOID_ANALGESIC' },
  TRAMADOL: { label: 'Tramadol', category: 'OPIOID_ANALGESIC' },
  DIPYRONE: { label: 'Dipirona', category: 'NON_OPIOID_ANALGESIC' },
  PARACETAMOL: { label: 'Paracetamol', category: 'NON_OPIOID_ANALGESIC' },
  IBUPROFEN: { label: 'Ibuprofeno', category: 'NSAID' },
  NAPROXEN: { label: 'Naproxeno', category: 'NSAID' },
  METFORMIN: { label: 'Metformina', category: 'ANTIDIABETIC' },
  INSULIN: { label: 'Insulina', category: 'ANTIDIABETIC' },
  LOSARTAN: { label: 'Losartana', category: 'ANTIHYPERTENSIVE' },
  ENALAPRIL: { label: 'Enalapril', category: 'ANTIHYPERTENSIVE' },
  AMLODIPINE: { label: 'Anlodipino', category: 'ANTIHYPERTENSIVE' },
  OMEPRAZOLE: { label: 'Omeprazol', category: 'PROTON_PUMP_INHIBITOR' },
  ONDANSETRON: { label: 'Ondansetrona', category: 'ANTIEMETIC' },
  FILGRASTIM: { label: 'Filgrastim (G-CSF)', category: 'GROWTH_FACTOR' },
  CICLOSPORIN: { label: 'Ciclosporina', category: 'IMMUNOSUPPRESSANT' },
  TACROLIMUS: { label: 'Tacrolimo', category: 'IMMUNOSUPPRESSANT' },
  MEROPENEM: { label: 'Meropenem', category: 'ANTIBIOTIC' },
  FLUCONAZOLE: { label: 'Fluconazol', category: 'ANTIFUNGAL' },
  OTHER: { label: 'Outro (nome livre)', category: 'OTHER' },
};

export const MEDICATION_SELECT_OPTIONS = Object.entries(MEDICATION_CATALOG).map(
  ([value, { label }]) => ({ value, label })
);

export function getMedicationCatalogEntry(
  key: string | undefined
): MedicationCatalogEntry | null {
  if (!key) return null;
  return MEDICATION_CATALOG[key] ?? null;
}
