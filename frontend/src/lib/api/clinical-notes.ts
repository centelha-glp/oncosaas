import { apiClient } from './client';

export type ClinicalNoteType = 'NURSING' | 'MEDICAL';
export type ClinicalNoteStatus = 'DRAFT' | 'SIGNED' | 'VOIDED';

/** Chave da etapa de navegação correspondente a cada tipo de evolução (alinhado ao backend). */
export const CLINICAL_EVOLUTION_NAVIGATION_STEP_KEY: Record<
  ClinicalNoteType,
  string
> = {
  MEDICAL: 'specialist_consultation',
  NURSING: 'navigation_consultation',
};

export type ClinicalNoteNavigationStepRef = {
  id: string;
  stepKey: string;
  stepName: string;
  journeyStage: string;
};

export const CLINICAL_NOTE_SECTION_KEYS = [
  'identificacao',
  'hda',
  'hpp',
  'comorbidades',
  'medicacoesEmUso',
  'alergias',
  'subjetivo',
  'exameFisico',
  'examesComplementares',
  'analise',
  'conduta',
  'tratamentos',
  'navegacao',
  'planos',
] as const;

export type ClinicalNoteSectionKey = (typeof CLINICAL_NOTE_SECTION_KEYS)[number];

export function emptyClinicalSections(): Record<ClinicalNoteSectionKey, string> {
  return Object.fromEntries(
    CLINICAL_NOTE_SECTION_KEYS.map((k) => [k, ''])
  ) as Record<ClinicalNoteSectionKey, string>;
}

/** Comparação estável de conteúdo (ordem fixa de chaves) — autosave e diff */
export function serializeClinicalNoteSections(
  sections: Record<string, string>
): string {
  const o: Record<string, string> = {};
  for (const k of CLINICAL_NOTE_SECTION_KEYS) {
    o[k] = sections[k] ?? '';
  }
  return JSON.stringify(o);
}

/** Cópia segura das seções (para nova evolução / adendo a partir da anterior) */
export function cloneClinicalNoteSections(
  sections: Record<string, string> | undefined | null
): Record<ClinicalNoteSectionKey, string> {
  const base = emptyClinicalSections();
  if (!sections) return base;
  for (const k of CLINICAL_NOTE_SECTION_KEYS) {
    const v = sections[k];
    if (typeof v === 'string') base[k] = v;
  }
  return base;
}

/**
 * Preenche apenas chaves vazias do rascunho com texto sugerido a partir do cadastro
 * (idade em SP, HPP, comorbidades, exames, tratamentos, navegação).
 */
export function mergeClinicalSectionsWithCadastroSuggestions(
  previous: Record<ClinicalNoteSectionKey, string>,
  suggestions: Record<ClinicalNoteSectionKey, string>
): Record<ClinicalNoteSectionKey, string> {
  const base = cloneClinicalNoteSections(previous);
  for (const k of CLINICAL_NOTE_SECTION_KEYS) {
    const prev = (base[k] ?? '').trim();
    const sug = (suggestions[k] ?? '').trim();
    if (!prev && sug) {
      base[k] = suggestions[k] ?? '';
    }
  }
  return base;
}

export type ClinicalNoteUserRef = {
  id: string;
  name: string;
  role: string;
};

/** Exibe apenas o nome cadastrado do usuário (nunca o papel/função no sistema). */
export function formatClinicalUserName(
  ref: ClinicalNoteUserRef | null | undefined
): string {
  const n = ref?.name?.trim();
  return n || '—';
}

export function clinicalNoteTypeLabel(noteType: ClinicalNoteType): string {
  return noteType === 'NURSING' ? 'Enfermagem' : 'Médica';
}

/**
 * Nome da pessoa a destacar na lista/cabeçalho: quem editou por último (rascunho),
 * quem assinou (assinada), ou quem criou.
 */
export function clinicalNotePrimaryPersonName(
  n: Pick<
    ClinicalNoteListItem,
    'status' | 'lastEditedBy' | 'signedBy' | 'createdBy'
  >
): string {
  if (n.status === 'DRAFT') {
    const last = formatClinicalUserName(n.lastEditedBy);
    if (last !== '—') return last;
    return formatClinicalUserName(n.createdBy);
  }
  if (n.status === 'SIGNED') {
    const signer = formatClinicalUserName(n.signedBy);
    if (signer !== '—') return signer;
    return formatClinicalUserName(n.createdBy);
  }
  return formatClinicalUserName(n.createdBy);
}

export interface ClinicalNoteListItem {
  id: string;
  patientId: string;
  noteType: ClinicalNoteType;
  status: ClinicalNoteStatus;
  amendsClinicalNoteId: string | null;
  navigationStepId: string | null;
  navigationStep: ClinicalNoteNavigationStepRef | null;
  createdAt: string;
  updatedAt: string;
  createdBy: ClinicalNoteUserRef;
  /** Autor da versão mais recente (último a editar o rascunho) */
  lastEditedBy: ClinicalNoteUserRef | null;
  signedBy: ClinicalNoteUserRef | null;
  signedAt: string | null;
  latestVersion: {
    versionNumber: number;
    sectionsContentHash: string;
    createdAt?: string;
  } | null;
}

export interface ClinicalNoteDetail {
  id: string;
  patientId: string;
  noteType: ClinicalNoteType;
  status: ClinicalNoteStatus;
  amendsClinicalNoteId: string | null;
  navigationStepId: string | null;
  navigationStep: ClinicalNoteNavigationStepRef | null;
  createdAt: string;
  updatedAt: string;
  createdBy: ClinicalNoteUserRef;
  /** Autor da versão mais recente do conteúdo */
  lastEditedBy: ClinicalNoteUserRef | null;
  signedBy: ClinicalNoteUserRef | null;
  signedAt: string | null;
  voidedBy: ClinicalNoteUserRef | null;
  voidedAt: string | null;
  voidReason: string | null;
  latestVersionNumber: number;
  sectionsContentHash: string;
  sections: Record<string, string>;
}

export interface ClinicalNoteMutationResponse {
  id: string;
  patientId: string;
  status: ClinicalNoteStatus;
  noteType: ClinicalNoteType;
  latestVersionNumber: number;
  sectionsContentHash: string;
  amendsClinicalNoteId: string | null;
  navigationStepId: string | null;
  updatedAt: string;
}

export interface PaginatedClinicalNotes {
  data: ClinicalNoteListItem[];
  total: number;
  page: number;
  limit: number;
}

export const clinicalNotesApi = {
  list(
    patientId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedClinicalNotes> {
    return apiClient.get<PaginatedClinicalNotes>(
      `/patients/${patientId}/clinical-notes`,
      { params }
    );
  },

  /**
   * Texto sugerido por seção a partir do cadastro e dados clínicos estruturados.
   * `noteType` + `navigationStepId` ativam modelo SOAP específico (médica vs enfermagem) e foco na etapa.
   */
  getSectionSuggestions(
    patientId: string,
    params?: {
      navigationStepId?: string;
      noteType?: ClinicalNoteType;
    }
  ): Promise<Record<ClinicalNoteSectionKey, string>> {
    return apiClient.get<Record<ClinicalNoteSectionKey, string>>(
      `/patients/${patientId}/clinical-notes/section-suggestions`,
      { params }
    );
  },

  getById(id: string): Promise<ClinicalNoteDetail> {
    return apiClient.get<ClinicalNoteDetail>(`/clinical-notes/${id}`);
  },

  create(
    patientId: string,
    body: {
      noteType: ClinicalNoteType;
      navigationStepId: string;
      sections: Record<string, string>;
    }
  ): Promise<ClinicalNoteMutationResponse> {
    return apiClient.post<ClinicalNoteMutationResponse>(
      `/patients/${patientId}/clinical-notes`,
      body
    );
  },

  update(
    id: string,
    body: {
      sections: Record<string, string>;
      changeReason?: string;
      navigationStepId?: string;
    }
  ): Promise<ClinicalNoteMutationResponse> {
    return apiClient.patch<ClinicalNoteMutationResponse>(
      `/clinical-notes/${id}`,
      body
    );
  },

  sign(id: string): Promise<ClinicalNoteMutationResponse> {
    return apiClient.post<ClinicalNoteMutationResponse>(
      `/clinical-notes/${id}/sign`,
      {}
    );
  },

  addendum(
    id: string,
    body: { sections?: Record<string, string> }
  ): Promise<ClinicalNoteMutationResponse> {
    return apiClient.post<ClinicalNoteMutationResponse>(
      `/clinical-notes/${id}/addendum`,
      body
    );
  },

  void(id: string, voidReason: string): Promise<ClinicalNoteMutationResponse> {
    return apiClient.post<ClinicalNoteMutationResponse>(
      `/clinical-notes/${id}/void`,
      { voidReason }
    );
  },
};

/**
 * Conteúdo da evolução mais recente utilizável (não anulada), preferindo o mesmo tipo.
 * Usado ao criar nova nota para pré-preencher com a evolução anterior.
 */
export async function loadSectionsFromPreviousEvolution(
  noteType: ClinicalNoteType,
  list: ClinicalNoteListItem[]
): Promise<Record<ClinicalNoteSectionKey, string>> {
  const usable = list.filter((n) => n.status !== 'VOIDED');
  const sameType = usable.filter((n) => n.noteType === noteType);
  const source = sameType[0] ?? usable[0];
  if (!source) return emptyClinicalSections();
  try {
    const prev = await clinicalNotesApi.getById(source.id);
    return cloneClinicalNoteSections(prev.sections);
  } catch {
    return emptyClinicalSections();
  }
}
