import { MedicationCategory } from '@generated/prisma/client';

export type MedicationCatalogSeedDrug = {
  code: string;
  genericName: string;
  displayName: string;
  category: MedicationCategory;
  allowedRoutes: string[];
  presentations: Array<{
    code: string;
    label: string;
    strength?: string;
    form?: string;
  }>;
};

const VO_IV_SC = ['VO', 'IV', 'SC'];
const VO_ONLY = ['VO'];
const SC = ['SC'];
const IV = ['IV'];

/** ~25 fármacos do catálogo clínico legado, com 1–3 apresentações cada. */
export const MEDICATION_CATALOG_SEED_ROWS: MedicationCatalogSeedDrug[] = [
  {
    code: 'WARFARIN',
    genericName: 'Varfarina',
    displayName: 'Varfarina',
    category: MedicationCategory.ANTICOAGULANT,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'WARFARIN_5MG_CP', label: 'Varfarina 5 mg', strength: '5 mg', form: 'comprimido' },
      { code: 'WARFARIN_2_5MG_CP', label: 'Varfarina 2,5 mg', strength: '2,5 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'RIVAROXABAN',
    genericName: 'Rivaroxabana',
    displayName: 'Rivaroxabana',
    category: MedicationCategory.ANTICOAGULANT,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'RIVAROXABAN_20MG_CP', label: 'Rivaroxabana 20 mg', strength: '20 mg', form: 'comprimido' },
      { code: 'RIVAROXABAN_15MG_CP', label: 'Rivaroxabana 15 mg', strength: '15 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'APIXABAN',
    genericName: 'Apixabana',
    displayName: 'Apixabana',
    category: MedicationCategory.ANTICOAGULANT,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'APIXABAN_5MG_CP', label: 'Apixabana 5 mg', strength: '5 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'ENOXAPARIN',
    genericName: 'Enoxaparina',
    displayName: 'Enoxaparina',
    category: MedicationCategory.ANTICOAGULANT,
    allowedRoutes: SC,
    presentations: [
      { code: 'ENOXAPARIN_40MG_SC', label: 'Enoxaparina 40 mg/0,4 mL', strength: '40 mg', form: 'seringa SC' },
      { code: 'ENOXAPARIN_60MG_SC', label: 'Enoxaparina 60 mg/0,6 mL', strength: '60 mg', form: 'seringa SC' },
    ],
  },
  {
    code: 'ASPIRIN_LOW',
    genericName: 'Ácido acetilsalicílico',
    displayName: 'AAS (antiagregante)',
    category: MedicationCategory.ANTIPLATELET,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'ASPIRIN_100MG_CP', label: 'AAS 100 mg', strength: '100 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'CLOPIDOGREL',
    genericName: 'Clopidogrel',
    displayName: 'Clopidogrel',
    category: MedicationCategory.ANTIPLATELET,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'CLOPIDOGREL_75MG_CP', label: 'Clopidogrel 75 mg', strength: '75 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'PREDNISONE',
    genericName: 'Prednisona',
    displayName: 'Prednisona',
    category: MedicationCategory.CORTICOSTEROID,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'PREDNISONE_20MG_CP', label: 'Prednisona 20 mg', strength: '20 mg', form: 'comprimido' },
      { code: 'PREDNISONE_5MG_CP', label: 'Prednisona 5 mg', strength: '5 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'DEXAMETHASONE',
    genericName: 'Dexametasona',
    displayName: 'Dexametasona',
    category: MedicationCategory.CORTICOSTEROID,
    allowedRoutes: [...VO_IV_SC],
    presentations: [
      { code: 'DEXAMETHASONE_4MG_CP', label: 'Dexametasona 4 mg', strength: '4 mg', form: 'comprimido' },
      { code: 'DEXAMETHASONE_4MG_IV', label: 'Dexametasona 4 mg/1 mL', strength: '4 mg', form: 'ampola IV' },
    ],
  },
  {
    code: 'MORPHINE',
    genericName: 'Morfina',
    displayName: 'Morfina',
    category: MedicationCategory.OPIOID_ANALGESIC,
    allowedRoutes: [...VO_IV_SC],
    presentations: [
      { code: 'MORPHINE_10MG_CP', label: 'Morfina 10 mg', strength: '10 mg', form: 'comprimido' },
      { code: 'MORPHINE_10MG_ML_IV', label: 'Morfina 10 mg/mL', strength: '10 mg/mL', form: 'ampola' },
    ],
  },
  {
    code: 'OXYCODONE',
    genericName: 'Oxicodona',
    displayName: 'Oxicodona',
    category: MedicationCategory.OPIOID_ANALGESIC,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'OXYCODONE_5MG_CP', label: 'Oxicodona 5 mg', strength: '5 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'TRAMADOL',
    genericName: 'Tramadol',
    displayName: 'Tramadol',
    category: MedicationCategory.OPIOID_ANALGESIC,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'TRAMADOL_50MG_CP', label: 'Tramadol 50 mg', strength: '50 mg', form: 'cápsula' },
    ],
  },
  {
    code: 'DIPYRONE',
    genericName: 'Dipirona',
    displayName: 'Dipirona',
    category: MedicationCategory.NON_OPIOID_ANALGESIC,
    allowedRoutes: [...VO_IV_SC],
    presentations: [
      { code: 'DIPYRONE_500MG_CP', label: 'Dipirona 500 mg', strength: '500 mg', form: 'comprimido' },
      { code: 'DIPYRONE_1G_IV', label: 'Dipirona 1 g/2 mL', strength: '1 g', form: 'ampola IV' },
    ],
  },
  {
    code: 'PARACETAMOL',
    genericName: 'Paracetamol',
    displayName: 'Paracetamol',
    category: MedicationCategory.NON_OPIOID_ANALGESIC,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'PARACETAMOL_750MG_CP', label: 'Paracetamol 750 mg', strength: '750 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'IBUPROFEN',
    genericName: 'Ibuprofeno',
    displayName: 'Ibuprofeno',
    category: MedicationCategory.NSAID,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'IBUPROFEN_600MG_CP', label: 'Ibuprofeno 600 mg', strength: '600 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'NAPROXEN',
    genericName: 'Naproxeno',
    displayName: 'Naproxeno',
    category: MedicationCategory.NSAID,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'NAPROXEN_500MG_CP', label: 'Naproxeno 500 mg', strength: '500 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'METFORMIN',
    genericName: 'Metformina',
    displayName: 'Metformina',
    category: MedicationCategory.ANTIDIABETIC,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'METFORMIN_850MG_CP', label: 'Metformina 850 mg', strength: '850 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'INSULIN',
    genericName: 'Insulina',
    displayName: 'Insulina',
    category: MedicationCategory.ANTIDIABETIC,
    allowedRoutes: SC,
    presentations: [
      { code: 'INSULIN_NPH_SC', label: 'Insulina NPH', form: 'caneta/seringa SC' },
      { code: 'INSULIN_REG_SC', label: 'Insulina regular', form: 'caneta/seringa SC' },
    ],
  },
  {
    code: 'LOSARTAN',
    genericName: 'Losartana',
    displayName: 'Losartana',
    category: MedicationCategory.ANTIHYPERTENSIVE,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'LOSARTAN_50MG_CP', label: 'Losartana 50 mg', strength: '50 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'ENALAPRIL',
    genericName: 'Enalapril',
    displayName: 'Enalapril',
    category: MedicationCategory.ANTIHYPERTENSIVE,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'ENALAPRIL_10MG_CP', label: 'Enalapril 10 mg', strength: '10 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'AMLODIPINE',
    genericName: 'Anlodipino',
    displayName: 'Anlodipino',
    category: MedicationCategory.ANTIHYPERTENSIVE,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'AMLODIPINE_5MG_CP', label: 'Anlodipino 5 mg', strength: '5 mg', form: 'comprimido' },
    ],
  },
  {
    code: 'OMEPRAZOLE',
    genericName: 'Omeprazol',
    displayName: 'Omeprazol',
    category: MedicationCategory.PROTON_PUMP_INHIBITOR,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'OMEPRAZOLE_20MG_CP', label: 'Omeprazol 20 mg', strength: '20 mg', form: 'cápsula' },
    ],
  },
  {
    code: 'ONDANSETRON',
    genericName: 'Ondansetrona',
    displayName: 'Ondansetrona',
    category: MedicationCategory.ANTIEMETIC,
    allowedRoutes: [...VO_IV_SC],
    presentations: [
      { code: 'ONDANSETRON_8MG_CP', label: 'Ondansetrona 8 mg', strength: '8 mg', form: 'comprimido' },
      { code: 'ONDANSETRON_4MG_IV', label: 'Ondansetrona 4 mg/2 mL', strength: '4 mg', form: 'ampola IV' },
    ],
  },
  {
    code: 'FILGRASTIM',
    genericName: 'Filgrastim',
    displayName: 'Filgrastim (G-CSF)',
    category: MedicationCategory.GROWTH_FACTOR,
    allowedRoutes: SC,
    presentations: [
      { code: 'FILGRASTIM_300MCG_SC', label: 'Filgrastim 300 mcg', strength: '300 mcg', form: 'seringa SC' },
    ],
  },
  {
    code: 'CICLOSPORIN',
    genericName: 'Ciclosporina',
    displayName: 'Ciclosporina',
    category: MedicationCategory.IMMUNOSUPPRESSANT,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'CICLOSPORIN_25MG_CP', label: 'Ciclosporina 25 mg', strength: '25 mg', form: 'cápsula' },
    ],
  },
  {
    code: 'TACROLIMUS',
    genericName: 'Tacrolimo',
    displayName: 'Tacrolimo',
    category: MedicationCategory.IMMUNOSUPPRESSANT,
    allowedRoutes: VO_ONLY,
    presentations: [
      { code: 'TACROLIMUS_1MG_CP', label: 'Tacrolimo 1 mg', strength: '1 mg', form: 'cápsula' },
    ],
  },
  {
    code: 'MEROPENEM',
    genericName: 'Meropenem',
    displayName: 'Meropenem',
    category: MedicationCategory.ANTIBIOTIC,
    allowedRoutes: IV,
    presentations: [
      { code: 'MEROPENEM_1G_IV', label: 'Meropenem 1 g', strength: '1 g', form: 'frasco IV' },
    ],
  },
  {
    code: 'FLUCONAZOLE',
    genericName: 'Fluconazol',
    displayName: 'Fluconazol',
    category: MedicationCategory.ANTIFUNGAL,
    allowedRoutes: [...VO_IV_SC],
    presentations: [
      { code: 'FLUCONAZOLE_150MG_CP', label: 'Fluconazol 150 mg', strength: '150 mg', form: 'cápsula' },
      { code: 'FLUCONAZOLE_200MG_IV', label: 'Fluconazol 200 mg/100 mL', strength: '200 mg', form: 'bolsa IV' },
    ],
  },
];
