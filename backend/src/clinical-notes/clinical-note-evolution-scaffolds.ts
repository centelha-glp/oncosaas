import {
  ClinicalNoteType,
  JourneyStage,
  NavigationStepStatus,
} from '@generated/prisma/client';
import type { ClinicalNoteSectionKey } from './clinical-notes.constants';

const JOURNEY_STAGE_LABEL_PT: Record<JourneyStage, string> = {
  SCREENING: 'Rastreamento / suspeita',
  DIAGNOSIS: 'Diagnóstico e estadiamento',
  TREATMENT: 'Tratamento',
  FOLLOW_UP: 'Seguimento',
  PALLIATIVE: 'Cuidados paliativos',
};

/** Remove sufixo -2, -3 de instâncias repetidas da mesma etapa */
export function baseNavigationStepKey(stepKey: string): string {
  return stepKey.replace(/-\d+$/, '');
}

const CANCER_TYPE_LABEL_PT: Record<string, string> = {
  bladder: 'Câncer de bexiga',
  breast: 'Câncer de mama',
  colorectal: 'Câncer colorretal',
  lung: 'Câncer de pulmão',
  prostate: 'Câncer de próstata',
  kidney: 'Câncer renal',
  testicular: 'Câncer testicular',
  generic: 'Neoplasia (curso genérico)',
};

export function cancerTypeLabelPt(cancerType: string | null | undefined): string {
  if (!cancerType?.trim()) {
    return 'Não informado';
  }
  const k = cancerType.trim().toLowerCase();
  return CANCER_TYPE_LABEL_PT[k] ?? cancerType.trim();
}

function navStatusLabelPt(status: NavigationStepStatus): string {
  const m: Record<NavigationStepStatus, string> = {
    PENDING: 'Pendente',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluída',
    OVERDUE: 'Atrasada',
    CANCELLED: 'Cancelada',
    NOT_APPLICABLE: 'Não aplicável',
  };
  return m[status] ?? status;
}

type StepRow = {
  id: string;
  stepKey: string;
  stepName: string;
  status: NavigationStepStatus;
  journeyStage: JourneyStage;
  stepOrder: number;
  notes: string | null;
  dueDate: Date | null;
};

/** Heurística de foco em exames/procedimentos a partir da chave da etapa */
function stepExamHintPt(baseKey: string): string | null {
  const k = baseKey.toLowerCase();
  if (
    k.includes('pathology') ||
    k.includes('biopsy') ||
    k.includes('cytology')
  ) {
    return 'Documentar resultado anatomopatológico / citológico, classificação e margens quando aplicável.';
  }
  if (
    k.includes('colonoscopy') ||
    k.includes('cystoscopy') ||
    k.includes('endoscopy') ||
    k.includes('mammography') ||
    k.includes('ultrasound')
  ) {
    return 'Registrar achados descritos no laudo/procedimento, complicações e material enviado à anatomia (se houver).';
  }
  if (k.includes('ct_') || k.includes('mri') || k.includes('pet') || k.includes('staging')) {
    return 'Incluir data do exame, técnica, comparação com estudos prévios e principais achados relevantes para estadiamento/decisão.';
  }
  if (
    k.includes('chemotherapy') ||
    k.includes('radiotherapy') ||
    k.includes('immunotherapy') ||
    k.includes('targeted') ||
    k.includes('bcg') ||
    k.includes('intravesical')
  ) {
    return 'Registrar esquema, ciclos, toxicidades e adesão; próximos passos acordados.';
  }
  if (
    k.includes('surgery') ||
    k.includes('colectomy') ||
    k.includes('cystectomy') ||
    k.includes('resection') ||
    k.includes('prostatectomy') ||
    k.includes('nephrectomy') ||
    k.includes('orchiectomy')
  ) {
    return 'Descrever procedimento, achados intraoperatórios relevantes, intercorrências e plano pós-operatório.';
  }
  if (k.includes('consultation') || k.includes('specialist')) {
    return 'Registrar decisões clínicas, encaminhamentos e dúvidas sanadas neste contato.';
  }
  if (k.includes('cea') || k.includes('psa') || k.includes('marker')) {
    return 'Registrar valor, data e tendência em relação a medições anteriores.';
  }
  return null;
}

function sortSteps(rows: StepRow[]): StepRow[] {
  return [...rows].sort((a, b) => {
    if (a.journeyStage !== b.journeyStage) {
      return String(a.journeyStage).localeCompare(String(b.journeyStage));
    }
    if (a.stepOrder !== b.stepOrder) {
      return a.stepOrder - b.stepOrder;
    }
    return a.stepName.localeCompare(b.stepName);
  });
}

export interface EvolutionScaffoldParams {
  cancerType: string | null;
  currentStage: JourneyStage;
  noteType: ClinicalNoteType | null;
  navigationSteps: StepRow[];
  focusNavigationStepId?: string | null;
}

export interface EvolutionScaffoldResult {
  sections: Partial<Record<ClinicalNoteSectionKey, string>>;
  examesComplementaresAppend: string;
}

/**
 * Textos-guia para seções narrativas e bloco de navegação contextual,
 * alinhados ao tipo de evolução e às etapas do paciente.
 */
export function buildEvolutionSectionScaffolds(
  params: EvolutionScaffoldParams
): EvolutionScaffoldResult {
  const { cancerType, currentStage, noteType, navigationSteps, focusNavigationStepId } =
    params;
  const cancerLb = cancerTypeLabelPt(cancerType);
  const stageLb = JOURNEY_STAGE_LABEL_PT[currentStage] ?? currentStage;

  const sorted = sortSteps(navigationSteps);
  const focus =
    (focusNavigationStepId &&
      sorted.find((s) => s.id === focusNavigationStepId)) ||
    null;

  const activeInStage = sorted.filter(
    (s) =>
      s.journeyStage === currentStage &&
      (s.status === NavigationStepStatus.PENDING ||
        s.status === NavigationStepStatus.IN_PROGRESS ||
        s.status === NavigationStepStatus.OVERDUE)
  );

  const formatStepLine = (s: StepRow) => {
    const st = navStatusLabelPt(s.status);
    const due = s.dueDate
      ? ` — ${s.dueDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
      : '';
    const n = s.notes?.trim() ? ` — ${s.notes.trim()}` : '';
    return `• ${s.stepName} (${st})${due}${n}`;
  };

  // Seção "navegação": manter apenas as etapas (sem meta, cabeçalhos ou dicas).
  const stepLines: string[] = [];
  if (focus) {
    stepLines.push(formatStepLine(focus));
  }
  for (const s of sorted) {
    if (focus && s.id === focus.id) {
      continue;
    }
    stepLines.push(formatStepLine(s));
  }

  const navegacaoBlock = stepLines.join('\n');
  const examesComplementaresAppend = '';

  if (!noteType) {
    return {
      sections: { navegacao: navegacaoBlock },
      examesComplementaresAppend,
    };
  }

  if (noteType === ClinicalNoteType.MEDICAL) {
    return {
      sections: {
        hda: [
          '• ',
          '',
        ].join('\n'),
        subjetivo: [
          '• ',
          '',
        ].join('\n'),
        exameFisico: [
          '• Geral:',
          '• NEURO:',
          '• ACV',
          '• AR',
          '• ABD',
          '• MMII',
          '',
        ].join('\n'),
        examesComplementares: [
          '• Lab',
          '• USG',
          '• TC',
          '• PET',
          '• EDA',
          '• BIOPSIA',
          '• CITOLOGIA',
          '• LAUDOS',
          '• OUTROS',
          '',
        ].join('\n'),
        analise: [
          '',
          '',
        ].join('\n'),
        conduta: [
          '• ',
          '',
        ].join('\n'),
        planos: [
          '• ',
          '',
        ].join('\n'),
        navegacao: navegacaoBlock,
      },
      examesComplementaresAppend,
    };
  }

  // NURSING
  return {
    sections: {
      hda: [
        '• Motivo do contato (consulta de navegação oncológica):',
        '• Percepções do paciente e familiares sobre diagnóstico e tratamento:',
        '• Barreiras (acesso, transporte, financeiras, adesão):',
        '',
      ].join('\n'),
      subjetivo: [
        '• Narrativa do paciente e principais preocupações:',
        '• Sintomas relatados e autocuidado:',
        '',
      ].join('\n'),
      exameFisico: [
        '• Condições gerais e suporte:',
        '',
      ].join('\n'),
      analise: [
        '• Necessidades identificadas (ex.: educação, suporte, sintomas):',
        '',
      ].join('\n'),
      conduta: [
        '• Educação em saúde e mediação:',
        '• Encaminhamentos e articulação com a equipe:',
        '',
      ].join('\n'),
      planos: [
        '• Ações pactuadas com o paciente:',
        '• Retorno / contato:',
        '',
      ].join('\n'),
      navegacao: navegacaoBlock,
    },
    examesComplementaresAppend,
  };
}
