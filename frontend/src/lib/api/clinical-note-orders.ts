import { apiClient } from './client';

export type ClinicalExamRequestRow = {
  id: string;
  clinicalNoteVersionNumber: number;
  displayName: string;
  code: string | null;
  loincCode: string | null;
  examCatalogCode: string | null;
  requestedBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type PrescriptionLineBody = {
  medicationName: string;
  catalogKey?: string;
  presentationCatalogCode?: string;
  quantity: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  observation?: string;
};

export type ClinicalExamRequestSuggestion = {
  display_name: string;
  code?: string | null;
  loinc_code?: string | null;
  request_source?: 'explicit' | 'contextual';
  rationale?: string | null;
};

export type ClinicalPrescriptionLineSuggestion = {
  medication_name: string;
  catalog_key?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  duration?: string | null;
  indication?: string | null;
  prescription_intent?: 'NEW' | 'DOSE_CHANGE' | 'SUSPEND';
};

export type ClinicalOrdersRejectionItem = {
  domain: string;
  reason: string;
  field?: string | null;
};

export type SuggestClinicalOrdersFromEvolutionResponse = {
  pipeline_schema_version?: string;
  suggestion_schema_version?: string;
  clinical_exam_requests: ClinicalExamRequestSuggestion[];
  clinical_prescription_lines: ClinicalPrescriptionLineSuggestion[];
  exam_context?: Record<string, unknown>;
  prescription_context?: Record<string, unknown>;
  rejection_report?: ClinicalOrdersRejectionItem[] | null;
};

export type ClinicalPrescriptionLineRow = {
  id: string;
  clinicalNoteVersionNumber: number;
  medicationName: string;
  catalogKey: string | null;
  presentationCatalogCode: string | null;
  quantity: string;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  observation: string | null;
  /** @deprecated use observation */
  indication?: string | null;
  prescribedBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export const clinicalNoteOrdersApi = {
  listExamRequests(
    patientId: string,
    clinicalNoteId: string
  ): Promise<ClinicalExamRequestRow[]> {
    return apiClient.get<ClinicalExamRequestRow[]>(
      `/patients/${patientId}/clinical-notes/${clinicalNoteId}/clinical-orders/exam-requests`
    );
  },

  createExamRequest(
    patientId: string,
    clinicalNoteId: string,
    body: {
      displayName: string;
      code?: string;
      loincCode?: string;
      examCatalogCode?: string;
    }
  ): Promise<ClinicalExamRequestRow> {
    return apiClient.post<ClinicalExamRequestRow>(
      `/patients/${patientId}/clinical-notes/${clinicalNoteId}/clinical-orders/exam-requests`,
      body
    );
  },

  deleteExamRequest(
    patientId: string,
    clinicalNoteId: string,
    requestId: string
  ): Promise<void> {
    return apiClient.delete(
      `/patients/${patientId}/clinical-notes/${clinicalNoteId}/clinical-orders/exam-requests/${requestId}`
    );
  },

  listPrescriptionLines(
    patientId: string,
    clinicalNoteId: string
  ): Promise<ClinicalPrescriptionLineRow[]> {
    return apiClient.get<ClinicalPrescriptionLineRow[]>(
      `/patients/${patientId}/clinical-notes/${clinicalNoteId}/clinical-orders/prescription-lines`
    );
  },

  createPrescriptionLine(
    patientId: string,
    clinicalNoteId: string,
    body: PrescriptionLineBody
  ): Promise<ClinicalPrescriptionLineRow> {
    return apiClient.post<ClinicalPrescriptionLineRow>(
      `/patients/${patientId}/clinical-notes/${clinicalNoteId}/clinical-orders/prescription-lines`,
      body
    );
  },

  updatePrescriptionLine(
    patientId: string,
    clinicalNoteId: string,
    lineId: string,
    body: PrescriptionLineBody
  ): Promise<ClinicalPrescriptionLineRow> {
    return apiClient.patch<ClinicalPrescriptionLineRow>(
      `/patients/${patientId}/clinical-notes/${clinicalNoteId}/clinical-orders/prescription-lines/${lineId}`,
      body
    );
  },

  deletePrescriptionLine(
    patientId: string,
    clinicalNoteId: string,
    lineId: string
  ): Promise<void> {
    return apiClient.delete(
      `/patients/${patientId}/clinical-notes/${clinicalNoteId}/clinical-orders/prescription-lines/${lineId}`
    );
  },

  suggestOrdersFromEvolution(
    patientId: string,
    clinicalNoteId: string,
    contentMarkdown: string
  ): Promise<SuggestClinicalOrdersFromEvolutionResponse> {
    return apiClient.post<SuggestClinicalOrdersFromEvolutionResponse>(
      `/patients/${patientId}/clinical-notes/${clinicalNoteId}/clinical-orders/suggest-from-evolution`,
      { contentMarkdown }
    );
  },
};

export type PrescriptionHistoryRow = {
  id: string;
  clinicalNoteId: string;
  clinicalNoteVersionNumber: number;
  medicationName: string;
  catalogKey: string | null;
  presentationCatalogCode: string | null;
  quantity?: string | null;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  observation?: string | null;
  indication?: string | null;
  createdAt: string;
  prescribedBy: { id: string; name: string };
  clinicalNote: {
    id: string;
    status: string;
    signedAt: string | null;
    noteType: string;
  };
};

export const prescriptionHistoryApi = {
  list(
    patientId: string,
    params?: { q?: string; limit?: number; offset?: number }
  ): Promise<{
    items: PrescriptionHistoryRow[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.q?.trim()) searchParams.set('q', params.q.trim());
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    if (params?.offset != null) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return apiClient.get(
      `/patients/${patientId}/prescription-history${qs ? `?${qs}` : ''}`
    );
  },
};
