import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import type { User } from '@/lib/api/auth';

const { mockAuthApi, mockApiClient } = vi.hoisted(() => ({
  mockAuthApi: {
    login: vi.fn(),
    registerInstitution: vi.fn(),
    logout: vi.fn(),
  },
  mockApiClient: {
    isTokenExpired: vi.fn(),
    getRefreshToken: vi.fn(),
    post: vi.fn(),
    setToken: vi.fn(),
    setRefreshToken: vi.fn(),
    setTenantId: vi.fn(),
    clearAuth: vi.fn(),
    onTokenRefreshed: vi.fn(() => () => {}),
  },
}));

vi.mock('@/lib/api/auth', () => ({
  authApi: mockAuthApi,
}));

vi.mock('@/lib/api/client', () => ({
  apiClient: mockApiClient,
}));

import { useAuthStore } from '../auth-store';

const baseUser: User = {
  id: 'u1',
  email: 'nurse@onconav.local',
  name: 'Nurse',
  role: 'NURSE',
  tenantId: 'tenant-1',
};

describe('useAuthStore initialize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitializing: true,
    });
  });

  it('starts unauthenticated when there is no persisted session', () => {
    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isInitializing).toBe(false);
  });

  it('restores authenticated session when token, user, and tenant are present', () => {
    const persistedToken = 'token-123';
    localStorage.setItem('auth_token', persistedToken);
    localStorage.setItem('tenant_id', baseUser.tenantId);
    localStorage.setItem('user', JSON.stringify(baseUser));
    mockApiClient.isTokenExpired.mockReturnValue(false);

    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(persistedToken);
    expect(state.user?.id).toBe(baseUser.id);
    expect(state.isInitializing).toBe(false);
    expect(mockApiClient.setToken).toHaveBeenCalledWith(persistedToken);
    expect(mockApiClient.setTenantId).toHaveBeenCalledWith(baseUser.tenantId);
  });

  it('silently refreshes expired sessions and keeps user logged in', async () => {
    localStorage.setItem('auth_token', 'expired-token');
    localStorage.setItem('tenant_id', baseUser.tenantId);
    localStorage.setItem('user', JSON.stringify(baseUser));
    mockApiClient.isTokenExpired.mockReturnValue(true);
    mockApiClient.getRefreshToken.mockReturnValue('refresh-123');
    mockApiClient.post.mockResolvedValue({
      access_token: 'fresh-token',
      refresh_token: 'fresh-refresh',
    });

    useAuthStore.getState().initialize();

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isInitializing).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('fresh-token');
    });

    expect(mockApiClient.setToken).toHaveBeenCalledWith('fresh-token');
    expect(mockApiClient.setRefreshToken).toHaveBeenCalledWith('fresh-refresh');
    expect(mockApiClient.setTenantId).toHaveBeenCalledWith(baseUser.tenantId);
  });

  it('clears session when refresh fails', async () => {
    localStorage.setItem('auth_token', 'expired-token');
    localStorage.setItem('tenant_id', baseUser.tenantId);
    localStorage.setItem('user', JSON.stringify(baseUser));
    mockApiClient.isTokenExpired.mockReturnValue(true);
    mockApiClient.getRefreshToken.mockReturnValue('refresh-123');
    mockApiClient.post.mockRejectedValue(new Error('refresh failed'));

    useAuthStore.getState().initialize();

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isInitializing).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });

    expect(mockApiClient.clearAuth).toHaveBeenCalled();
  });
});
