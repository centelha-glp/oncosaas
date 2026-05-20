import { apiClient } from './client';

export type ExamIngestSessionResponse = {
  sessionId: string;
  uploadToken: string;
  expiresAt: string;
  mobileUrl: string;
};

export type ExamIngestSessionStatus = {
  sessionId: string;
  filesReady: boolean;
  fileCount: number;
  expiresInSec: number;
};

export type ExamIngestComplementaryExamItem = {
  type: string;
  name: string;
  code?: string | null;
  loincCode?: string | null;
  result?: {
    performedAt?: string | null;
    valueNumeric?: number | null;
    valueText?: string | null;
    unit?: string | null;
    referenceRange?: string | null;
    isAbnormal?: boolean | null;
    report?: string | null;
    components?: unknown;
  } | null;
};

export type ExamIngestExtractResponse = {
  markdownSummary: string;
  detectedCategories: string[];
  disclaimer: string;
  /** Só incorporar na evolução quando true (JSON estruturado validado no ai-service). */
  markdownFromStructuredParse: boolean;
  /** "llm" | "mock" — mock não deve ser aceite em produção. */
  extractionSource?: 'llm' | 'mock' | string;
  collectionId?: string;
  complementaryExamsSavedCount: number;
  complementaryExamResultSavedCount: number;
  complementaryExamIds: string[];
  skippedCount?: number;
  skippedItems?: Array<{
    index: number;
    name?: string | null;
    reason: string;
  }>;
};

export const examIngestApi = {
  createSession(patientId: string, clinicalNoteId?: string) {
    return apiClient.post<ExamIngestSessionResponse>(
      `/patients/${patientId}/exam-ingest/sessions`,
      clinicalNoteId ? { clinicalNoteId } : {}
    );
  },

  getSessionStatus(patientId: string, sessionId: string) {
    return apiClient.get<ExamIngestSessionStatus>(
      `/patients/${patientId}/exam-ingest/sessions/${sessionId}`
    );
  },

  uploadSessionFile(patientId: string, sessionId: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.postFormData<{ fileCount: number }>(
      `/patients/${patientId}/exam-ingest/sessions/${sessionId}/files`,
      fd
    );
  },

  extract(
    patientId: string,
    opts: { plainText?: string; sessionId?: string; files?: File[] }
  ) {
    const fd = new FormData();
    if (opts.plainText?.trim()) {
      fd.append('plainText', opts.plainText.trim());
    }
    if (opts.sessionId) {
      fd.append('sessionId', opts.sessionId);
    }
    if (opts.files?.length) {
      for (const f of opts.files) {
        fd.append('files', f);
      }
    }
    return apiClient.postFormData<ExamIngestExtractResponse>(
      `/patients/${patientId}/exam-ingest/extract`,
      fd
    );
  },
};

/** Upload público móvel (sem cookies de sessão). */
export async function publicExamIngestUpload(
  token: string,
  file: File
): Promise<{ ok: true; fileCount: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/v1/public/exam-ingest/${token}`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    let msg = 'Falha no envio';
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(j.message)) msg = j.message.join(', ');
      else if (typeof j.message === 'string') msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<{ ok: true; fileCount: number }>;
}
