import { apiClient } from './client';

export type MedicationCatalogDrug = {
  code: string;
  genericName: string;
  displayName: string;
  category: string | null;
  allowedRoutes: string[];
};

export type MedicationCatalogPresentation = {
  code: string;
  drugCode: string;
  label: string;
  strength: string | null;
  form: string | null;
};

export type MedicationCatalogRoute = {
  code: string;
  label: string;
};

export type MedicationCatalogEntry = {
  drugCode: string;
  presentationCode: string | null;
  label: string;
  displayName: string;
  strength: string | null;
  allowedRoutes: string[];
};

export const medicationCatalogApi = {
  searchEntries(params: {
    q?: string;
    limit?: number;
  }): Promise<{ items: MedicationCatalogEntry[] }> {
    const searchParams = new URLSearchParams();
    if (params.q?.trim()) searchParams.set('q', params.q.trim());
    if (params.limit != null) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return apiClient.get(`/medication-catalog/entries${qs ? `?${qs}` : ''}`);
  },

  search(params: {
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: MedicationCatalogDrug[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params.q?.trim()) searchParams.set('q', params.q.trim());
    if (params.limit != null) searchParams.set('limit', String(params.limit));
    if (params.offset != null) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return apiClient.get(`/medication-catalog${qs ? `?${qs}` : ''}`);
  },

  listPresentations(
    drugCode: string,
    params?: { q?: string; limit?: number }
  ): Promise<{
    drug: { code: string; displayName: string };
    items: MedicationCatalogPresentation[];
  }> {
    const searchParams = new URLSearchParams();
    if (params?.q?.trim()) searchParams.set('q', params.q.trim());
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return apiClient.get(
      `/medication-catalog/${encodeURIComponent(drugCode)}/presentations${qs ? `?${qs}` : ''}`
    );
  },

  listRoutes(): Promise<{ routes: MedicationCatalogRoute[] }> {
    return apiClient.get('/medication-catalog/routes');
  },
};
