import axios, { AxiosInstance, AxiosError, AxiosRequestHeaders } from 'axios';
import { getApiUrl } from '@/lib/utils/api-config';

export interface ApiError {
  message: string | string[];
  error: string;
  statusCode: number;
}

export class ApiClientError extends Error {
  statusCode: number;
  error: string;

  constructor(message: string, statusCode: number, error: string) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.error = error;
  }
}

class ApiClient {
  private client: AxiosInstance;
  private tenantId: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    const apiUrl = getApiUrl();
    const baseURL = `${apiUrl}/api/v1`;

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor de request: adicionar token JWT e tenant
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        const tenantId = this.getTenantId();
        if (tenantId) {
          config.headers['X-Tenant-Id'] = tenantId;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Interceptor de response: renovar token em 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config as typeof error.config & {
          _retry?: boolean;
        };

        if (
          error.response?.status === 401 &&
          !originalRequest?._retry &&
          originalRequest?.url !== '/auth/refresh'
        ) {
          const refreshToken = this.getRefreshToken();
          if (refreshToken) {
            originalRequest._retry = true;
            try {
              const newAccessToken =
                await this.refreshAccessToken(refreshToken);
              originalRequest.headers = (originalRequest.headers ?? {}) as AxiosRequestHeaders;
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              return this.client(originalRequest);
            } catch {
              this.clearAuth();
              if (typeof window !== 'undefined') {
                window.location.href = '/login';
              }
            }
          } else {
            this.clearAuth();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
          }
        }

        if (error.response) {
          const { status, data } = error.response;
          const message = Array.isArray(data?.message)
            ? data.message.join(', ')
            : data?.message || error.message;

          throw new ApiClientError(
            message,
            status,
            data?.error || 'Unknown Error'
          );
        }

        const message =
          error.code === 'ECONNREFUSED' || error.message === 'Network Error'
            ? 'Servidor não está rodando. Verifique se o backend está iniciado na porta 3002.'
            : error.message || 'Network Error';

        throw new ApiClientError(message, 0, 'Network Error');
      }
    );
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    // Serializar chamadas concorrentes de refresh
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const response = await axios.post(
        `${this.client.defaults.baseURL}/auth/refresh`,
        { refresh_token: refreshToken }
      );
      const { access_token, refresh_token: newRefreshToken } = response.data;
      this.setToken(access_token);
      if (newRefreshToken) {
        this.setRefreshToken(newRefreshToken);
      }
      return access_token as string;
    })().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  // ─── Token management ───────────────────────────────────────────────────────

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  setRefreshToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('refresh_token', token);
    }
  }

  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refresh_token');
    }
    return null;
  }

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() / 1000 > payload.exp - 30; // 30s buffer
    } catch {
      return true;
    }
  }

  clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('tenant_id');
      localStorage.removeItem('user');
    }
    this.tenantId = null;
  }

  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('tenant_id', tenantId);
    }
  }

  getTenantId(): string | null {
    if (this.tenantId) {
      return this.tenantId;
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tenant_id');
    }
    return null;
  }

  // ─── HTTP methods ─────────────────────────────────────────────────────────

  async get<T>(url: string, config?: unknown): Promise<T> {
    const response = await this.client.get<T>(url, config as never);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data, config as never);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown, config?: unknown): Promise<T> {
    const response = await this.client.patch<T>(url, data, config as never);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data, config as never);
    return response.data;
  }

  async delete<T>(url: string, config?: unknown): Promise<T> {
    const response = await this.client.delete<T>(url, config as never);
    return response.data;
  }
}

export const apiClient = new ApiClient();
