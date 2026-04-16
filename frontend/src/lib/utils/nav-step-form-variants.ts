/**
 * Variantes de formulário por tipo de etapa de navegação.
 * Dados específicos persistem em `NavigationStep.metadata.stepDetail` (JSON).
 */

export type NavStepFormVariant =
  | 'clinical_consultation'
  | 'imaging'
  | 'pathology'
  | 'endoscopy'
  | 'systemic_therapy'
  | 'surgery'
  | 'screening_lab'
  | 'generic';

export type StepDetailFieldDef = {
  key: string;
  label: string;
  helper?: string;
  rows?: number;
};

export const VARIANT_SECTION_TITLE: Record<NavStepFormVariant, string> = {
  clinical_consultation: 'Evolução clínica (SOAP)',
  imaging: 'Exame de imagem / estadiamento',
  pathology: 'Anatomopatologia / citologia',
  endoscopy: 'Procedimento endoscópico',
  systemic_therapy: 'Tratamento sistêmico / radioterapia',
  surgery: 'Procedimento cirúrgico',
  screening_lab: 'Exame laboratorial / rastreio',
  generic: 'Resultado e achados',
};

/** Campos dinâmicos por variante (valores em metadata.stepDetail) */
export const STEP_DETAIL_FIELD_CONFIG: Record<
  NavStepFormVariant,
  StepDetailFieldDef[]
> = {
  clinical_consultation: [
    {
      key: 'hda',
      label: 'História da doença atual (HDA)',
      helper: 'Motivo do atendimento, tempo de evolução e contexto oncológico.',
      rows: 4,
    },
    {
      key: 'subjetivo',
      label: 'Subjetivo (S)',
      helper: 'Relato do paciente, queixas e expectativas.',
      rows: 3,
    },
    {
      key: 'exameFisico',
      label: 'Objetivo — exame físico (O)',
      helper: 'Sinais vitais e achados relevantes ao exame.',
      rows: 3,
    },
    {
      key: 'analise',
      label: 'Análise / avaliação (A)',
      helper: 'Síntese e problemas clínicos identificados.',
      rows: 3,
    },
    {
      key: 'conduta',
      label: 'Conduta (C)',
      helper: 'Decisões, prescrições e encaminhamentos.',
      rows: 3,
    },
    {
      key: 'planos',
      label: 'Plano / próximos passos (P)',
      helper: 'Curto e médio prazo; retornos e exames.',
      rows: 3,
    },
  ],
  imaging: [
    {
      key: 'imagingStudy',
      label: 'Exame / técnica',
      helper: 'Ex.: TC tórax com contraste — data do exame no campo “Data realizada”.',
      rows: 2,
    },
    {
      key: 'imagingFindings',
      label: 'Principais achados',
      rows: 4,
    },
    {
      key: 'imagingComparison',
      label: 'Comparação com estudos anteriores',
      helper: 'Evolução ou “primeiro estudo”.',
      rows: 2,
    },
  ],
  pathology: [
    {
      key: 'pathDiagnosis',
      label: 'Diagnóstico / classificação',
      rows: 3,
    },
    {
      key: 'pathMargins',
      label: 'Margens e extensão (se aplicável)',
      rows: 2,
    },
    {
      key: 'pathIhcOrGrade',
      label: 'Imunoistoquímica, grau ou notas adicionais',
      rows: 3,
    },
  ],
  endoscopy: [
    {
      key: 'endoFindings',
      label: 'Achados do procedimento',
      rows: 4,
    },
    {
      key: 'endoComplications',
      label: 'Intercorrências',
      rows: 2,
    },
    {
      key: 'endoSpecimen',
      label: 'Material encaminhado à anatomia',
      rows: 2,
    },
  ],
  systemic_therapy: [
    {
      key: 'txRegimen',
      label: 'Esquema / linha de tratamento',
      rows: 2,
    },
    {
      key: 'txCycle',
      label: 'Ciclo atual e datas relevantes',
      rows: 2,
    },
    {
      key: 'txToxicity',
      label: 'Toxicidades e tolerância',
      rows: 3,
    },
    {
      key: 'txNextSteps',
      label: 'Próximos passos acordados',
      rows: 2,
    },
  ],
  surgery: [
    {
      key: 'sxSummary',
      label: 'Procedimento e achados principais',
      rows: 4,
    },
    {
      key: 'sxComplications',
      label: 'Intercorrências',
      rows: 2,
    },
    {
      key: 'sxPostOp',
      label: 'Conduta e plano pós-operatório',
      rows: 3,
    },
  ],
  screening_lab: [
    {
      key: 'labResult',
      label: 'Resultado (valor / descrição)',
      rows: 2,
    },
    {
      key: 'labUnitRef',
      label: 'Unidade e referência (se aplicável)',
      rows: 2,
    },
    {
      key: 'labNotes',
      label: 'Observações sobre o resultado',
      rows: 2,
    },
  ],
  generic: [],
};

export function baseStepKey(stepKey: string): string {
  return stepKey.replace(/-\d+$/, '').toLowerCase();
}

/**
 * Etapas cuja evolução clínica oficial é o prontuário (ClinicalNote), não o SOAP em metadata da etapa.
 * Evita modelo duplicado na edição do card de navegação.
 */
export function usesProntuarioEvolutionModel(stepKeyRaw: string): boolean {
  const k = baseStepKey(stepKeyRaw);
  return k === 'specialist_consultation' || k === 'navigation_consultation';
}

export function getNavStepFormVariant(stepKeyRaw: string): NavStepFormVariant {
  const k = baseStepKey(stepKeyRaw);

  if (
    k === 'specialist_consultation' ||
    k === 'navigation_consultation' ||
    k.includes('consultation')
  ) {
    return 'clinical_consultation';
  }

  if (
    k.includes('pathology') ||
    k.includes('biopsy') ||
    k === 'urine_cytology' ||
    k.includes('cytology')
  ) {
    return 'pathology';
  }

  if (
    k.includes('ct_') ||
    k.includes('mri') ||
    k.includes('pet') ||
    k.includes('staging') ||
    k.includes('urography') ||
    k.includes('mammography') ||
    k.includes('ultrasound')
  ) {
    return 'imaging';
  }

  if (
    k.includes('colonoscopy') ||
    k.includes('cystoscopy') ||
    k.includes('endoscopy') ||
    k.includes('gastroscopy')
  ) {
    return 'endoscopy';
  }

  if (
    k.includes('chemotherapy') ||
    k.includes('radiotherapy') ||
    k.includes('bcg') ||
    k.includes('intravesical') ||
    k.includes('immunotherapy') ||
    k.includes('targeted')
  ) {
    return 'systemic_therapy';
  }

  if (
    k.includes('surgery') ||
    k.includes('resection') ||
    k.includes('ectomy') ||
    k.includes('colectomy') ||
    k.includes('cystectomy') ||
    k.includes('prostatectomy') ||
    k.includes('nephrectomy') ||
    k.includes('orchiectomy') ||
    k.includes('neobladder')
  ) {
    return 'surgery';
  }

  if (
    k.includes('fecal') ||
    k.includes('cea') ||
    k.includes('psa') ||
    k.includes('marker') ||
    k.includes('occult')
  ) {
    return 'screening_lab';
  }

  return 'generic';
}

export function emptyStepDetail(variant: NavStepFormVariant): Record<string, string> {
  const fields = STEP_DETAIL_FIELD_CONFIG[variant];
  return Object.fromEntries(fields.map((f) => [f.key, '']));
}

export function parseStepDetailFromMetadata(
  metadata: unknown,
  variant: NavStepFormVariant
): Record<string, string> {
  const base = emptyStepDetail(variant);
  if (!metadata || typeof metadata !== 'object') {
    return base;
  }
  const raw = (metadata as { stepDetail?: Record<string, unknown> }).stepDetail;
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  for (const key of Object.keys(base)) {
    const v = raw[key];
    if (typeof v === 'string') {
      base[key] = v;
    }
  }
  return base;
}

export function getFilledStepDetailEntries(
  metadata: unknown,
  variant: NavStepFormVariant
): { label: string; value: string }[] {
  const parsed = parseStepDetailFromMetadata(metadata, variant);
  const cfg = STEP_DETAIL_FIELD_CONFIG[variant];
  return cfg
    .map((f) => ({
      label: f.label,
      value: (parsed[f.key] ?? '').trim(),
    }))
    .filter((x) => x.value.length > 0);
}
