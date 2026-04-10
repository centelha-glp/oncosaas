import { MedicationCategory } from '@generated/prisma/client';

export interface MedicationCatalogEntry {
  label: string;
  category: MedicationCategory;
}

/** medicationKey → nome canônico + categoria clínica (servidor deriva flags). */
export const MEDICATION_CATALOG: Record<string, MedicationCatalogEntry> = {
  WARFARIN: { label: 'Varfarina', category: MedicationCategory.ANTICOAGULANT },
  RIVAROXABAN: { label: 'Rivaroxabana', category: MedicationCategory.ANTICOAGULANT },
  APIXABAN: { label: 'Apixabana', category: MedicationCategory.ANTICOAGULANT },
  ENOXAPARIN: { label: 'Enoxaparina', category: MedicationCategory.ANTICOAGULANT },
  ASPIRIN_LOW: { label: 'AAS (antiagregante)', category: MedicationCategory.ANTIPLATELET },
  CLOPIDOGREL: { label: 'Clopidogrel', category: MedicationCategory.ANTIPLATELET },
  PREDNISONE: { label: 'Prednisona', category: MedicationCategory.CORTICOSTEROID },
  DEXAMETHASONE: { label: 'Dexametasona', category: MedicationCategory.CORTICOSTEROID },
  MORPHINE: { label: 'Morfina', category: MedicationCategory.OPIOID_ANALGESIC },
  OXYCODONE: { label: 'Oxicodona', category: MedicationCategory.OPIOID_ANALGESIC },
  TRAMADOL: { label: 'Tramadol', category: MedicationCategory.OPIOID_ANALGESIC },
  DIPYRONE: { label: 'Dipirona', category: MedicationCategory.NON_OPIOID_ANALGESIC },
  PARACETAMOL: { label: 'Paracetamol', category: MedicationCategory.NON_OPIOID_ANALGESIC },
  IBUPROFEN: { label: 'Ibuprofeno', category: MedicationCategory.NSAID },
  NAPROXEN: { label: 'Naproxeno', category: MedicationCategory.NSAID },
  METFORMIN: { label: 'Metformina', category: MedicationCategory.ANTIDIABETIC },
  INSULIN: { label: 'Insulina', category: MedicationCategory.ANTIDIABETIC },
  LOSARTAN: { label: 'Losartana', category: MedicationCategory.ANTIHYPERTENSIVE },
  ENALAPRIL: { label: 'Enalapril', category: MedicationCategory.ANTIHYPERTENSIVE },
  AMLODIPINE: { label: 'Anlodipino', category: MedicationCategory.ANTIHYPERTENSIVE },
  OMEPRAZOLE: { label: 'Omeprazol', category: MedicationCategory.PROTON_PUMP_INHIBITOR },
  ONDANSETRON: { label: 'Ondansetrona', category: MedicationCategory.ANTIEMETIC },
  FILGRASTIM: { label: 'Filgrastim (G-CSF)', category: MedicationCategory.GROWTH_FACTOR },
  CICLOSPORIN: { label: 'Ciclosporina', category: MedicationCategory.IMMUNOSUPPRESSANT },
  TACROLIMUS: { label: 'Tacrolimo', category: MedicationCategory.IMMUNOSUPPRESSANT },
  MEROPENEM: { label: 'Meropenem', category: MedicationCategory.ANTIBIOTIC },
  FLUCONAZOLE: { label: 'Fluconazol', category: MedicationCategory.ANTIFUNGAL },
  OTHER: { label: 'Outro (nome livre)', category: MedicationCategory.OTHER },
};

export function getMedicationCatalogEntry(
  key: string | null | undefined
): MedicationCatalogEntry | null {
  if (!key || typeof key !== 'string') return null;
  return MEDICATION_CATALOG[key] ?? null;
}

export function isValidMedicationCatalogKey(key: string): boolean {
  return key in MEDICATION_CATALOG;
}
