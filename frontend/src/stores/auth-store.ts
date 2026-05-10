'use client';

import { create } from 'zustand';
import { authApi, RegisterDto, RegisterInstitutionDto, User } from '@/lib/api/auth';
import { apiClient } from '@/lib/api/client';

interface AuthState {
  user: User | null;
  /** Sempre null: access JWT fica em cookie HttpOnly na API; espelho opcional só para middleware Next. */
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerInstitution: (data: RegisterInstitutionDto) => Promise<void>;
  registerWithInvite: (data: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  initialize: () => void;
}

/** Evita N chamadas paralelas a GET /auth/profile (rate limit / tempestade no Strict Mode). */
let initializeInFlight: Promise<void> | null = null;

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

    if (initializeInFlight) {
      return;
    }

    initializeInFlight = (async () => {
      set({ isInitializing: true });

      const userStr = localStorage.getItem('user');
      const tenantId = localStorage.getItem('tenant_id');

      const isUserStrValid =
        userStr && typeof userStr === 'string' && userStr.trim().startsWith('{');

      if (!isUserStrValid || !tenantId) {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isInitializing: false,
        });
        return;
      }

      try {
        JSON.parse(userStr);
      } catch {
        apiClient.clearAuth();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isInitializing: false,
        });
        return;
      }

      apiClient.setTenantId(tenantId);

      try {
        const merged = await authApi.refreshSessionUser();
        if (merged) {
          set({
            user: merged,
            token: null,
            isAuthenticated: true,
            isInitializing: false,
          });
          return;
        }
        apiClient.clearAuth();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
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
    })().finally(() => {
      initializeInFlight = null;
    });
  },

  login: async (email: string, password: string) => {
    const response = await authApi.login({ email, password });

    set({
      user: response.user,
      token: null,
      isAuthenticated: true,
      isInitializing: false,
    });
  },

  registerInstitution: async (data: RegisterInstitutionDto) => {
    const response = await authApi.registerInstitution(data);

    set({
      user: response.user,
      token: null,
      isAuthenticated: true,
      isInitializing: false,
    });
  },

  registerWithInvite: async (data: RegisterDto) => {
    const response = await authApi.register(data);

    set({
      user: response.user,
      token: null,
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
    apiClient.setMiddlewareRouteMirrorCookie(token);
    set({ token: null, isAuthenticated: true });
  },
}));

apiClient.onTokenRefreshed(() => {
  useAuthStore.setState({ isAuthenticated: true });
});
