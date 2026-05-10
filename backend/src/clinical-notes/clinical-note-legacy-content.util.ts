import {
  CLINICAL_NOTE_SECTION_KEYS,
  type ClinicalNoteSectionKey,
} from './clinical-notes.constants';

/** Rótulos PT usados ao converter JSON legado (seções) em Markdown. */
export const CLINICAL_NOTE_SECTION_LABELS_PT: Record<
  ClinicalNoteSectionKey,
  string
> = {
  identificacao: 'Identificação',
  hda: 'HDA',
  hpp: 'HPP',
  comorbidades: 'Comorbidades',
  medicacoesEmUso: 'Medicações em uso',
  alergias: 'Alergias',
  subjetivo: 'Subjetivo',
  exameFisico: 'Exame físico',
  examesComplementares: 'Exames complementares',
  analise: 'Análise',
  conduta: 'Conduta',
  tratamentos: 'Tratamentos',
  navegacao: 'Navegação oncológica',
  planos: 'Planos',
};

const sectionKeySet = new Set<string>(CLINICAL_NOTE_SECTION_KEYS);

/** Converte registro de seções (V1) em um único documento Markdown. */
export function sectionsRecordToMarkdown(
  sections: Record<string, string>
): string {
  const parts: string[] = [];
  for (const k of CLINICAL_NOTE_SECTION_KEYS) {
    const raw = sections[k];
    const body = (raw ?? '').trim();
    if (!body) {
      continue;
    }
    const title = CLINICAL_NOTE_SECTION_LABELS_PT[k];
    parts.push(`## ${title}\n\n${raw ?? ''}`.trimEnd());
  }
  return parts.join('\n\n');
}

/**
 * Se o texto descriptografado for o JSON legado das seções, converte para Markdown;
 * caso contrário devolve o texto como evolução em Markdown (V2).
 */
export function decodeDecryptedClinicalNoteToMarkdown(
  decryptedPlaintext: string
): string {
  const t = decryptedPlaintext.trimStart();
  if (!t.startsWith('{')) {
    return decryptedPlaintext;
  }
  try {
    const parsed = JSON.parse(decryptedPlaintext) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return decryptedPlaintext;
    }
    const o = parsed as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 0) {
      return decryptedPlaintext;
    }
    if (!keys.every((k) => sectionKeySet.has(k))) {
      return decryptedPlaintext;
    }
    if (!keys.some((k) => typeof o[k] === 'string')) {
      return decryptedPlaintext;
    }
    const asStrings: Record<string, string> = {};
    for (const k of keys) {
      asStrings[k] = typeof o[k] === 'string' ? (o[k] as string) : '';
    }
    return sectionsRecordToMarkdown(asStrings);
  } catch {
    return decryptedPlaintext;
  }
}
