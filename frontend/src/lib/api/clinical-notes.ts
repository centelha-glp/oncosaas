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

/**
 * Combina texto da evolução anterior com o Markdown sugerido a partir do cadastro.
 * Se só um lado tiver conteúdo, devolve esse; se ambos, concatena com separador.
 */
export function mergeMarkdownWithCadastroSuggestion(
  previousMarkdown: string,
  suggestionMarkdown: string
): string {
  const prev = previousMarkdown.trim();
  const sug = suggestionMarkdown.trim();
  if (!prev) return suggestionMarkdown;
  if (!sug) return previousMarkdown;
  return `${previousMarkdown.trimEnd()}\n\n---\n\n${sug}`;
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
  contentMarkdown: string;
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
    params?: { page?: number; limit?: number; navigationStepId?: string }
  ): Promise<PaginatedClinicalNotes> {
    return apiClient.get<PaginatedClinicalNotes>(
      `/patients/${patientId}/clinical-notes`,
      { params }
    );
  },

  /**
   * Markdown sugerido a partir do cadastro e dados clínicos (evolução estruturada em tópicos).
   */
  getSectionSuggestions(
    patientId: string,
    params?: {
      navigationStepId?: string;
      noteType?: ClinicalNoteType;
    }
  ): Promise<{ contentMarkdown: string }> {
    return apiClient.get<{ contentMarkdown: string }>(
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
      contentMarkdown: string;
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
      contentMarkdown: string;
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
    body: { contentMarkdown?: string }
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
 * Conteúdo Markdown da evolução mais recente utilizável (não anulada), preferindo o mesmo tipo.
 */
export async function loadContentMarkdownFromPreviousEvolution(
  noteType: ClinicalNoteType,
  list: ClinicalNoteListItem[]
): Promise<string> {
  const usable = list.filter((n) => n.status !== 'VOIDED');
  const sameType = usable.filter((n) => n.noteType === noteType);
  const source = sameType[0] ?? usable[0];
  if (!source) return '';
  try {
    const prev = await clinicalNotesApi.getById(source.id);
    return prev.contentMarkdown ?? '';
  } catch {
    return '';
  }
}
