'use client';

import { create } from 'zustand';
import { authApi, RegisterInstitutionDto, User } from '@/lib/api/auth';
import { apiClient } from '@/lib/api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerInstitution: (data: RegisterInstitutionDto) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitializing: true,

  initialize: () => {
    if (typeof window === 'undefined') {
      set({ isInitializing: false });
      return;
    }

    set({ isInitializing: true });

    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');
    const tenantId = localStorage.getItem('tenant_id');

    if (token && userStr && tenantId) {
      try {
        // Verificar se o token expirou
        if (apiClient.isTokenExpired()) {
          const refreshToken = apiClient.getRefreshToken();
          if (refreshToken) {
            // Tentar renovar silenciosamente em background
            apiClient
              .post<{ access_token: string; refresh_token: string }>(
                '/auth/refresh',
                { refresh_token: refreshToken }
              )
              .then((res) => {
                apiClient.setToken(res.access_token);
                if (res.refresh_token) {
                  apiClient.setRefreshToken(res.refresh_token);
                }
                const user = JSON.parse(userStr);
                apiClient.setTenantId(tenantId);
                set({
                  user,
                  token: res.access_token,
                  isAuthenticated: true,
                  isInitializing: false,
                });
              })
              .catch(() => {
                apiClient.clearAuth();
                set({
                  user: null,
                  token: null,
                  isAuthenticated: false,
                  isInitializing: false,
                });
              });
            // Mantém inicializando enquanto o refresh ocorre em background
            return;
          }

          apiClient.clearAuth();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isInitializing: false,
          });
          return;
        }

        const user = JSON.parse(userStr);
        apiClient.setToken(token);
        apiClient.setTenantId(tenantId);

        set({
          user,
          token,
          isAuthenticated: true,
          isInitializing: false,
        });
      } catch {
        apiClient.clearAuth();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isInitializing: false,
        });
      }
    } else {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isInitializing: false,
      });
    }
  },

  login: async (email: string, password: string) => {
    const response = await authApi.login({ email, password });

    set({
      user: response.user,
      token: response.access_token,
      isAuthenticated: true,
      isInitializing: false,
    });
  },

  registerInstitution: async (data: RegisterInstitutionDto) => {
    const response = await authApi.registerInstitution(data);

    set({
      user: response.user,
      token: response.access_token,
      isAuthenticated: true,
      isInitializing: false,
    });
  },

  logout: async () => {
    await authApi.logout();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitializing: false,
    });
  },

  setUser: (user: User) => {
    set({ user, isAuthenticated: true });
  },

  setToken: (token: string) => {
    set({ token, isAuthenticated: true });
  },
}));
