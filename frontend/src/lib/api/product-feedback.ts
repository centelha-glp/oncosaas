import { apiClient } from './client';

export type ProductFeedbackType = 'BUG' | 'FEATURE';

export interface ProductFeedbackAuthor {
  id: string;
  name: string;
  email: string;
}

export interface ProductFeedback {
  id: string;
  tenantId: string;
  userId: string;
  type: ProductFeedbackType;
  title: string;
  description: string;
  pageUrl: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFeedbackWithAuthor extends ProductFeedback {
  user: ProductFeedbackAuthor;
}

export interface ProductFeedbackListResponse {
  data: ProductFeedbackWithAuthor[];
  total: number;
  page: number;
  limit: number;
}

export const productFeedbackApi = {
  create: (body: {
    type: ProductFeedbackType;
    title: string;
    description: string;
    pageUrl?: string;
  }) =>
    apiClient.post<ProductFeedback>('/product-feedback', body),

  list: (params?: { page?: number; limit?: number }) =>
    apiClient.get<ProductFeedbackListResponse>('/product-feedback', {
      params,
    }),
};
