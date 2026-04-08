import { apiClient } from './client';
import type { ComplementaryExamType } from '@/lib/api/patients';

export interface ExamCatalogItem {
  id: string;
  code: string;
  name: string;
  rolItemCode: string | null;
  type: ComplementaryExamType;
  specimenDefault: string | null;
  unit: string | null;
  referenceRange: string | null;
  sourceVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExamCatalogSearchResponse {
  items: ExamCatalogItem[];
  total: number;
  limit: number;
  offset: number;
}

export const examCatalogApi = {
  async search(params: {
    q?: string;
    type?: ComplementaryExamType;
    limit?: number;
    offset?: number;
  }): Promise<ExamCatalogSearchResponse> {
    const searchParams = new URLSearchParams();
    if (params.q?.trim()) searchParams.set('q', params.q.trim());
    if (params.type) searchParams.set('type', params.type);
    if (params.limit != null) searchParams.set('limit', String(params.limit));
    if (params.offset != null) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return apiClient.get<ExamCatalogSearchResponse>(
      `/exam-catalog${qs ? `?${qs}` : ''}`
    );
  },

  async importBatch(body: {
    sourceVersion?: string;
    items: Array<{
      code: string;
      name: string;
      type: ComplementaryExamType;
      rolItemCode?: string;
      specimenDefault?: string;
      unit?: string;
      referenceRange?: string;
    }>;
  }): Promise<{ upserted: number; sourceVersion: string | null }> {
    return apiClient.post<{ upserted: number; sourceVersion: string | null }>(
      '/exam-catalog/import',
      body
    );
  },
};
