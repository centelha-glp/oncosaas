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

export type ClinicalPrescriptionLineRow = {
  id: string;
  clinicalNoteVersionNumber: number;
  medicationName: string;
  catalogKey: string | null;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  indication: string | null;
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
    body: {
      medicationName: string;
      catalogKey?: string;
      dosage?: string;
      frequency?: string;
      route?: string;
      duration?: string;
      indication?: string;
    }
  ): Promise<ClinicalPrescriptionLineRow> {
    return apiClient.post<ClinicalPrescriptionLineRow>(
      `/patients/${patientId}/clinical-notes/${clinicalNoteId}/clinical-orders/prescription-lines`,
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
};
