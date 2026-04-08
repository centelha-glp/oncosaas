import type { ComplementaryExam, ComplementaryExamType } from '@/lib/api/patients';

export interface CompositeComponent {
  name: string;
  unit?: string;
  referenceRange?: string;
}

export interface CatalogExamEntry {
  type: ComplementaryExamType;
  name: string;
  code?: string;
  specimen?: string;
  unit?: string;
  referenceRange?: string;
  isComposite?: boolean;
  components?: CompositeComponent[];
}

export const SPECIMEN_OPTIONS: Record<ComplementaryExamType, string[]> = {
  LABORATORY: [
    'Sangue venoso',
    'Sangue arterial',
    'Urina simples',
    'Urina de 24 horas',
    'Líquor (LCR)',
    'Líquido pleural',
    'Líquido ascítico',
    'Escarro',
    'Swab nasofaríngeo',
    'Fezes',
    'Medula óssea',
  ],
  ANATOMOPATHOLOGICAL: [
    'Tecido (biópsia)',
    'Peça cirúrgica',
    'Agulha fina (PAAF)',
    'Líquido pleural',
    'Líquido ascítico',
    'Medula óssea',
    'Escarro',
  ],
  IMMUNOHISTOCHEMICAL: [
    'Tecido (biópsia)',
    'Peça cirúrgica',
    'Bloco de parafina',
    'Células (citologia)',
  ],
  IMAGING: [],
};

export interface ExamTypeFieldConfig {
  showNumeric: boolean;
  showText: boolean;
  textLabel: string;
  textPlaceholder: string;
  reportIsPrimary: boolean;
  specimens: string[];
}

export const EXAM_TYPE_FIELD_CONFIG: Record<ComplementaryExamType, ExamTypeFieldConfig> = {
  LABORATORY: {
    showNumeric: true,
    showText: false,
    textLabel: 'Observação qualitativa',
    textPlaceholder: 'Ex: hemolisado, lipêmico',
    reportIsPrimary: false,
    specimens: SPECIMEN_OPTIONS.LABORATORY,
  },
  IMMUNOHISTOCHEMICAL: {
    showNumeric: true,
    showText: true,
    textLabel: 'Resultado (grading)',
    textPlaceholder: 'Ex: 3+, Positivo, CPS ≥ 1',
    reportIsPrimary: false,
    specimens: SPECIMEN_OPTIONS.IMMUNOHISTOCHEMICAL,
  },
  ANATOMOPATHOLOGICAL: {
    showNumeric: false,
    showText: true,
    textLabel: 'Conclusão diagnóstica',
    textPlaceholder: 'Ex: Adenocarcinoma, Negativo para malignidade',
    reportIsPrimary: true,
    specimens: SPECIMEN_OPTIONS.ANATOMOPATHOLOGICAL,
  },
  IMAGING: {
    showNumeric: false,
    showText: true,
    textLabel: 'Classificação / score',
    textPlaceholder: 'Ex: BI-RADS 3, PI-RADS 4',
    reportIsPrimary: true,
    specimens: SPECIMEN_OPTIONS.IMAGING,
  },
};

/**
 * Catálogo de exames por tipo, com nome, código e valores padrão.
 * Exames compostos têm isComposite: true e uma lista de componentes.
 */
export const COMPLEMENTARY_EXAMS_CATALOG: CatalogExamEntry[] = [
  // ── Laboratoriais compostos ────────────────────────────────────────────────
  {
    type: 'LABORATORY',
    name: 'Hemograma completo',
    code: 'HEMO',
    specimen: 'Sangue venoso',
    isComposite: true,
    components: [
      { name: 'Hemoglobina', unit: 'g/dL', referenceRange: '13-17 (M); 12-16 (F)' },
      { name: 'Hematócrito', unit: '%', referenceRange: '40-50 (M); 36-44 (F)' },
      { name: 'VCM', unit: 'fL', referenceRange: '80-100' },
      { name: 'HCM', unit: 'pg', referenceRange: '27-33' },
      { name: 'CHCM', unit: 'g/dL', referenceRange: '31-36' },
      { name: 'RDW', unit: '%', referenceRange: '11-15' },
      { name: 'Leucócitos', unit: '/mm³', referenceRange: '4.500-11.000' },
      { name: 'Neutrófilos', unit: '/mm³', referenceRange: '1.800-7.700' },
      { name: 'Linfócitos', unit: '/mm³', referenceRange: '900-2.900' },
      { name: 'Monócitos', unit: '/mm³', referenceRange: '300-900' },
      { name: 'Eosinófilos', unit: '/mm³', referenceRange: '50-500' },
      { name: 'Basófilos', unit: '/mm³', referenceRange: '0-100' },
      { name: 'Plaquetas', unit: '/mm³', referenceRange: '150.000-400.000' },
      { name: 'VPM', unit: 'fL', referenceRange: '7,5-12,5' },
    ],
  },
  {
    type: 'LABORATORY',
    name: 'Gasometria arterial',
    code: 'GASO-A',
    specimen: 'Sangue arterial',
    isComposite: true,
    components: [
      { name: 'pH', unit: '-', referenceRange: '7,35-7,45' },
      { name: 'pCO2', unit: 'mmHg', referenceRange: '35-45' },
      { name: 'pO2', unit: 'mmHg', referenceRange: '80-100' },
      { name: 'HCO3', unit: 'mEq/L', referenceRange: '22-26' },
      { name: 'BE', unit: 'mEq/L', referenceRange: '-2 a +2' },
      { name: 'SatO2', unit: '%', referenceRange: '94-100' },
      { name: 'Lactato', unit: 'mmol/L', referenceRange: '<2,0' },
    ],
  },
  {
    type: 'LABORATORY',
    name: 'Gasometria venosa',
    code: 'GASO-V',
    specimen: 'Sangue venoso',
    isComposite: true,
    components: [
      { name: 'pH', unit: '-', referenceRange: '7,31-7,41' },
      { name: 'pCO2', unit: 'mmHg', referenceRange: '41-51' },
      { name: 'pO2', unit: 'mmHg', referenceRange: '25-40' },
      { name: 'HCO3', unit: 'mEq/L', referenceRange: '22-26' },
      { name: 'BE', unit: 'mEq/L', referenceRange: '-2 a +2' },
      { name: 'SatO2', unit: '%', referenceRange: '60-80' },
    ],
  },
  {
    type: 'LABORATORY',
    name: 'EAS / Urina tipo 1',
    code: 'EAS',
    specimen: 'Urina simples',
    isComposite: true,
    components: [
      { name: 'pH', unit: '-', referenceRange: '5,0-7,5' },
      { name: 'Densidade', unit: '-', referenceRange: '1.010-1.025' },
      { name: 'Proteína', unit: '-', referenceRange: 'Negativa' },
      { name: 'Glicose', unit: '-', referenceRange: 'Negativa' },
      { name: 'Cetonas', unit: '-', referenceRange: 'Negativa' },
      { name: 'Bilirrubina', unit: '-', referenceRange: 'Negativa' },
      { name: 'Nitrito', unit: '-', referenceRange: 'Negativo' },
      { name: 'Leucócitos urina', unit: '/campo', referenceRange: '<5' },
      { name: 'Hemácias urina', unit: '/campo', referenceRange: '<3' },
      { name: 'Células epiteliais', unit: '/campo', referenceRange: 'Raras' },
    ],
  },

  // ── Laboratoriais simples ──────────────────────────────────────────────────
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
  { type: 'LABORATORY', name: 'GGT', code: 'GGT', unit: 'U/L', referenceRange: '<60' },
  { type: 'LABORATORY', name: 'Cálcio', code: 'CA', unit: 'mg/dL', referenceRange: '8,6-10,2' },
  { type: 'LABORATORY', name: 'Sódio', code: 'NA', unit: 'mEq/L', referenceRange: '136-145' },
  { type: 'LABORATORY', name: 'Potássio', code: 'K', unit: 'mEq/L', referenceRange: '3,5-5,0' },
  { type: 'LABORATORY', name: 'Magnésio', code: 'MG', unit: 'mEq/L', referenceRange: '1,5-2,5' },
  { type: 'LABORATORY', name: 'Fósforo', code: 'P', unit: 'mg/dL', referenceRange: '2,5-4,5' },
  { type: 'LABORATORY', name: 'Ácido úrico', code: 'AU', unit: 'mg/dL', referenceRange: '3,5-7,2 (M); 2,6-6,0 (F)' },
  { type: 'LABORATORY', name: 'Hemoglobina', code: 'HB', unit: 'g/dL', referenceRange: '13-17 (M); 12-16 (F)' },
  { type: 'LABORATORY', name: 'Leucócitos', code: 'LEUC', unit: '/mm³', referenceRange: '4.500-11.000' },
  { type: 'LABORATORY', name: 'Plaquetas', code: 'PLAQ', unit: '/mm³', referenceRange: '150.000-400.000' },
  { type: 'LABORATORY', name: 'INR', code: 'INR', unit: '-', referenceRange: '0,8-1,2' },
  { type: 'LABORATORY', name: 'TSH', code: 'TSH', unit: 'mUI/L', referenceRange: '0,4-4,0' },
  { type: 'LABORATORY', name: 'T4 livre', code: 'T4L', unit: 'ng/dL', referenceRange: '0,8-1,8' },
  { type: 'LABORATORY', name: 'Vitamina B12', code: 'B12', unit: 'pg/mL', referenceRange: '200-900' },
  { type: 'LABORATORY', name: 'Ácido fólico', code: 'FOLATO', unit: 'ng/mL', referenceRange: '>3' },
  { type: 'LABORATORY', name: 'Urocultura', code: 'UROCULT', specimen: 'Urina simples', unit: '-', referenceRange: 'Negativa' },
  { type: 'LABORATORY', name: 'Proteinúria 24h', code: 'PROT24H', specimen: 'Urina de 24 horas', unit: 'mg/24h', referenceRange: '<150' },
  { type: 'LABORATORY', name: 'Creatinina urinária', code: 'CREAT-U', specimen: 'Urina simples', unit: 'mg/dL', referenceRange: 'Ver contexto' },
  { type: 'LABORATORY', name: 'Creatinina urina 24h', code: 'CREAT-24H', specimen: 'Urina de 24 horas', unit: 'mg/24h', referenceRange: 'Ver contexto' },
  { type: 'LABORATORY', name: 'Clearance de creatinina', code: 'CLEARANCE', unit: 'mL/min', referenceRange: '>90' },

  // ── Anatomopatológicos ─────────────────────────────────────────────────────
  { type: 'ANATOMOPATHOLOGICAL', name: 'Biópsia de mama', code: 'BIOPSIA MAMA', specimen: 'Tecido (biópsia)', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'ANATOMOPATHOLOGICAL', name: 'Biópsia de próstata', code: 'BIOPSIA PROSTATA', specimen: 'Tecido (biópsia)', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'ANATOMOPATHOLOGICAL', name: 'Biópsia colorretal', code: 'BIOPSIA COLORRETAL', specimen: 'Tecido (biópsia)', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'ANATOMOPATHOLOGICAL', name: 'Biópsia de pulmão', code: 'BIOPSIA PULMAO', specimen: 'Tecido (biópsia)', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'ANATOMOPATHOLOGICAL', name: 'Citologia aspirativa', code: 'PAAF', specimen: 'Agulha fina (PAAF)', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'ANATOMOPATHOLOGICAL', name: 'Anatomopatológico de peça cirúrgica', code: 'AP PECA', specimen: 'Peça cirúrgica', unit: '-', referenceRange: 'Ver laudo' },

  // ── Imuno-histoquímicos ────────────────────────────────────────────────────
  { type: 'IMMUNOHISTOCHEMICAL', name: 'Receptor de estrogênio (ER)', code: 'ER', specimen: 'Tecido (biópsia)', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'Receptor de progesterona (PR)', code: 'PR', specimen: 'Tecido (biópsia)', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'HER2', code: 'HER2', specimen: 'Tecido (biópsia)', unit: '-', referenceRange: '0 a 3+' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'Ki-67', code: 'KI67', specimen: 'Tecido (biópsia)', unit: '%', referenceRange: 'Ver laudo' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'PD-L1', code: 'PDL1', specimen: 'Tecido (biópsia)', unit: '%', referenceRange: 'CPS ou TPS conforme método' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'CK20', code: 'CK20', specimen: 'Tecido (biópsia)', unit: '-', referenceRange: 'Ver laudo' },
  { type: 'IMMUNOHISTOCHEMICAL', name: 'CK7', code: 'CK7', specimen: 'Tecido (biópsia)', unit: '-', referenceRange: 'Ver laudo' },

  // ── Imagem ─────────────────────────────────────────────────────────────────
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

/**
 * Resolve metadados de catálogo para um exame persistido: tenta o catálogo estático (painéis compostos);
 * se não houver match (ex.: exame criado só a partir do catálogo TUSS no banco), devolve entrada mínima a partir do exame.
 */
export function resolveCatalogEntryForExam(exam: ComplementaryExam): CatalogExamEntry {
  const fromStatic = COMPLEMENTARY_EXAMS_CATALOG.find(
    (e) =>
      (exam.code &&
        e.code &&
        e.code.toLowerCase() === exam.code.toLowerCase()) ||
      e.name.toLowerCase() === exam.name.toLowerCase()
  );
  if (fromStatic) return fromStatic;
  return {
    type: exam.type,
    name: exam.name,
    code: exam.code ?? undefined,
    specimen: exam.specimen ?? undefined,
    unit: exam.unit ?? undefined,
    referenceRange: exam.referenceRange ?? undefined,
    isComposite: false,
  };
}

/** Linhas iniciais do formulário para cada parâmetro de um painel (hemograma, EAS, etc.). */
export function defaultCompositeComponentRows(
  components: CompositeComponent[] | undefined
): Array<{
  name: string;
  unit?: string;
  referenceRange?: string;
  valueNumeric?: number;
  valueText: string;
  isAbnormal: boolean;
}> {
  if (!components?.length) return [];
  return components.map((c) => ({
    name: c.name,
    unit: c.unit,
    referenceRange: c.referenceRange,
    valueNumeric: undefined,
    valueText: '',
    isAbnormal: false,
  }));
}
