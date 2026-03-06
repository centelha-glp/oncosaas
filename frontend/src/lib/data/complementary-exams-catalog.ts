import type { ComplementaryExamType } from '@/lib/api/patients';

export interface CatalogExamEntry {
  type: ComplementaryExamType;
  name: string;
  code?: string;
  unit?: string;
  referenceRange?: string;
}

/**
 * Catálogo de exames por tipo, com nome, código e valores padrão (unidade e faixa de referência).
 * Pesquisável por nome ou código no formulário de adicionar exame.
 */
export const COMPLEMENTARY_EXAMS_CATALOG: CatalogExamEntry[] = [
  // Laboratoriais
  { type: 'LABORATORY', name: 'Hemograma completo', code: 'HEMO', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'LABORATORY', name: 'Glicemia de jejum', code: 'GLIC', unit: 'mg/dL', referenceRange: '70-99' },
  { type: 'LABORATORY', name: 'HbA1c', code: 'HBA1C', unit: '%', referenceRange: '<5,7' },
  { type: 'LABORATORY', name: 'Creatinina', code: 'CREAT', unit: 'mg/dL', referenceRange: '0,7-1,2 (M); 0,6-1,1 (F)' },
  { type: 'LABORATORY', name: 'Ureia', code: 'UREIA', unit: 'mg/dL', referenceRange: '15-45' },
  { type: 'LABORATORY', name: 'TGO (AST)', code: 'TGO', unit: 'U/L', referenceRange: '<40' },
  { type: 'LABORATORY', name: 'TGP (ALT)', code: 'TGP', unit: 'U/L', referenceRange: '<41' },
  { type: 'LABORATORY', name: 'Bilirrubina total', code: 'BT', unit: 'mg/dL', referenceRange: '0,2-1,2' },
  { type: 'LABORATORY', name: 'Albumina', code: 'ALB', unit: 'g/dL', referenceRange: '3,4-5,4' },
  { type: 'LABORATORY', name: 'CEA', code: 'CEA', unit: 'ng/mL', referenceRange: '<5 (não fumantes); <10 (fumantes)' },
  { type: 'LABORATORY', name: 'CA 19-9', code: 'CA199', unit: 'U/mL', referenceRange: '<37' },
  { type: 'LABORATORY', name: 'CA 125', code: 'CA125', unit: 'U/mL', referenceRange: '<35' },
  { type: 'LABORATORY', name: 'CA 15-3', code: 'CA153', unit: 'U/mL', referenceRange: '<25' },
  { type: 'LABORATORY', name: 'PSA total', code: 'PSA', unit: 'ng/mL', referenceRange: '<4' },
  { type: 'LABORATORY', name: 'AFP', code: 'AFP', unit: 'ng/mL', referenceRange: '<10' },
  { type: 'LABORATORY', name: 'β-HCG', code: 'BHCG', unit: 'mUI/mL', referenceRange: 'Ver contexto' },
  { type: 'LABORATORY', name: 'LDH', code: 'LDH', unit: 'U/L', referenceRange: '140-280' },
  { type: 'LABORATORY', name: 'Fosfatase alcalina', code: 'FA', unit: 'U/L', referenceRange: '40-150' },
  { type: 'LABORATORY', name: 'Cálcio', code: 'CA', unit: 'mg/dL', referenceRange: '8,6-10,2' },
  { type: 'LABORATORY', name: 'Sódio', code: 'NA', unit: 'mEq/L', referenceRange: '136-145' },
  { type: 'LABORATORY', name: 'Potássio', code: 'K', unit: 'mEq/L', referenceRange: '3,5-5,0' },
  { type: 'LABORATORY', name: 'Hemoglobina', code: 'HB', unit: 'g/dL', referenceRange: '13-17 (M); 12-16 (F)' },
  { type: 'LABORATORY', name: 'Hematócrito', code: 'HTO', unit: '%', referenceRange: '40-50 (M); 36-44 (F)' },
  { type: 'LABORATORY', name: 'Leucócitos', code: 'LEUC', unit: '/mm³', referenceRange: '4.500-11.000' },
  { type: 'LABORATORY', name: 'Plaquetas', code: 'PLAQ', unit: '/mm³', referenceRange: '150.000-400.000' },
  { type: 'LABORATORY', name: 'INR', code: 'INR', unit: '-', referenceRange: '0,8-1,2' },
  { type: 'LABORATORY', name: 'TSH', code: 'TSH', unit: 'mUI/L', referenceRange: '0,4-4,0' },
  { type: 'LABORATORY', name: 'T4 livre', code: 'T4L', unit: 'ng/dL', referenceRange: '0,8-1,8' },
  { type: 'LABORATORY', name: 'Vitamina B12', code: 'B12', unit: 'pg/mL', referenceRange: '200-900' },
  { type: 'LABORATORY', name: 'Ácido fólico', code: 'FOLATO', unit: 'ng/mL', referenceRange: '>3' },
  // Anatomopatológicos
  { type: 'ANATOMOPATHOLOGICAL', name: 'Biópsia de mama', code: 'BIOPSIA MAMA', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'ANATOMOPATHOLOGICAL', name: 'Biópsia de próstata', code: 'BIOPSIA PROSTATA', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'ANATOMOPATHOLOGICAL', name: 'Biópsia colorretal', code: 'BIOPSIA COLORRETAL', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'ANATOMOPATHOLOGICAL', name: 'Biópsia de pulmão', code: 'BIOPSIA PULMAO', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'ANATOMOPATHOLOGICAL', name: 'Citologia aspirativa', code: 'PAAF', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'ANATOMOPATHOLOGICAL', name: 'Anatomopatológico de peça cirúrgica', code: 'AP PECA', unit: '-', referenceRange: 'Ver laudo' },
  // Imuno-histoquímicos
  { type: 'IMMUNOHISTOCHEMICAL', name: 'Receptor de estrogênio (ER)', code: 'ER', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'Receptor de progesterona (PR)', code: 'PR', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'HER2', code: 'HER2', unit: '-', referenceRange: '0 a 3+' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'Ki-67', code: 'KI67', unit: '%', referenceRange: 'Ver laudo' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'PD-L1', code: 'PDL1', unit: '%', referenceRange: 'CPS ou TPS conforme método' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'CK20', code: 'CK20', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'CK7', code: 'CK7', unit: '-', referenceRange: 'Ver laudo' },
  // Imagem
  { type: 'IMAGING', name: 'Mamografia', code: 'MAMO', unit: '-', referenceRange: 'BI-RADS' },
  { type: 'IMAGING', name: 'Ultrassom de mama', code: 'US MAMA', unit: '-', referenceRange: 'BI-RADS' },
  { type: 'IMAGING', name: 'Ressonância de mama', code: 'RM MAMA', unit: '-', referenceRange: 'BI-RADS' },
  { type: 'IMAGING', name: 'TC de tórax', code: 'TC TORAX', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMAGING', name: 'TC de abdome', code: 'TC ABDOMEN', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMAGING', name: 'TC de pelve', code: 'TC PELVE', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMAGING', name: 'PET-CT', code: 'PETCT', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMAGING', name: 'Ressonância de próstata', code: 'RM PROSTATA', unit: '-', referenceRange: 'PI-RADS' },
  { type: 'IMAGING', name: 'RX de tórax', code: 'RX TORAX', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMAGING', name: 'Ecocardiograma', code: 'ECO', unit: '-', referenceRange: 'Ver laudo' },
];

function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function filterCatalogByTypeAndSearch(
  type: ComplementaryExamType,
  search: string
): CatalogExamEntry[] {
  const normalized = normalizeForSearch(search).trim();
  return COMPLEMENTARY_EXAMS_CATALOG.filter((entry) => {
    if (entry.type !== type) return false;
    if (!normalized) return true;
    const nameMatch = normalizeForSearch(entry.name).includes(normalized);
    const codeMatch = entry.code && normalizeForSearch(entry.code).includes(normalized);
    return nameMatch || codeMatch;
  });
}

export function getCatalogByType(type: ComplementaryExamType): CatalogExamEntry[] {
  return COMPLEMENTARY_EXAMS_CATALOG.filter((e) => e.type === type);
}
