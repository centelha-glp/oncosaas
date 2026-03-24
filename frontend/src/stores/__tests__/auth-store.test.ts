import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockar dependências ANTES de importar o store para que o módulo
// não tente executar apiClient.onTokenRefreshed() real
vi.mock('@/lib/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    registerInstitution: vi.fn(),
  },
}));

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    isTokenExpired: vi.fn(() => false),
    getRefreshToken: vi.fn(() => null),
    setToken: vi.fn(),
    setRefreshToken: vi.fn(),
    setTenantId: vi.fn(),
    clearAuth: vi.fn(),
    onTokenRefreshed: vi.fn(), // captura o callback sem efeito colateral real
    post: vi.fn(),
  },
}));

import { authApi } from '@/lib/api/auth';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '../auth-store';

const mockUser = {
  id: 'u1',
  email: 'enfermeira@hospitalteste.com',
  name: 'Ana Enfermeira',
  role: 'NURSE',
  tenantId: 'tenant-1',
};

function resetStore() {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isInitializing: true,
  });
}

describe('useAuthStore — login', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    resetStore();
  });

  it('define user e token após login bem-sucedido', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      user: mockUser,
      access_token: 'jwt-token',
      refresh_token: 'refresh-token',
    } as never);

    await useAuthStore.getState().login('enfermeira@hospitalteste.com', 'senha123');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('jwt-token');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isInitializing).toBe(false);
  });

  it('chama authApi.login com email e password', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      user: mockUser,
      access_token: 'jwt-token',
      refresh_token: 'refresh-token',
    } as never);

    await useAuthStore.getState().login('admin@hospitalteste.com', 'senha123');

    expect(authApi.login).toHaveBeenCalledWith({
      email: 'admin@hospitalteste.com',
      password: 'senha123',
    });
  });

  it('propaga o erro quando login falha', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('Credenciais inválidas'));

    await expect(
      useAuthStore.getState().login('errado@email.com', 'senhaErrada')
    ).rejects.toThrow('Credenciais inválidas');
  });

  it('não altera o estado do store quando login falha', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('Erro'));

    try {
      await useAuthStore.getState().login('x@x.com', 'x');
    } catch {
      // esperado
    }

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});

describe('useAuthStore — logout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Simular usuário logado
    useAuthStore.setState({
      user: mockUser as never,
      token: 'valid-jwt',
      isAuthenticated: true,
      isInitializing: false,
    });
  });

  it('limpa user, token e isAuthenticated após logout', async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined as never);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitializing).toBe(false);
  });

  it('chama authApi.logout', async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined as never);

    await useAuthStore.getState().logout();

    expect(authApi.logout).toHaveBeenCalledOnce();
  });
});

describe('useAuthStore — setUser / setToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('setUser define o usuário e marca isAuthenticated', () => {
    useAuthStore.getState().setUser(mockUser as never);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('setToken define o token e marca isAuthenticated', () => {
    useAuthStore.getState().setToken('new-jwt-token');

    const state = useAuthStore.getState();
    expect(state.token).toBe('new-jwt-token');
    expect(state.isAuthenticated).toBe(true);
  });
});

describe('useAuthStore — initialize', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    resetStore();
  });

  it('define isInitializing: false e isAuthenticated: false quando não há token', () => {
    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isInitializing).toBe(false);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('restaura sessão autenticada quando há token válido no localStorage', () => {
    localStorage.setItem('auth_token', 'valid-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('tenant_id', 'tenant-1');
    vi.mocked(apiClient.isTokenExpired).mockReturnValue(false);

    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('valid-token');
    expect(state.user).toEqual(mockUser);
    expect(state.isInitializing).toBe(false);
  });

  it('chama apiClient.setToken e apiClient.setTenantId ao restaurar sessão', () => {
    localStorage.setItem('auth_token', 'valid-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('tenant_id', 'tenant-1');
    vi.mocked(apiClient.isTokenExpired).mockReturnValue(false);

    useAuthStore.getState().initialize();

    expect(apiClient.setToken).toHaveBeenCalledWith('valid-token');
    expect(apiClient.setTenantId).toHaveBeenCalledWith('tenant-1');
  });

  it('limpa auth quando token expirado e não há refresh token', () => {
    localStorage.setItem('auth_token', 'expired-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('tenant_id', 'tenant-1');
    vi.mocked(apiClient.isTokenExpired).mockReturnValue(true);
    vi.mocked(apiClient.getRefreshToken).mockReturnValue(null);

    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitializing).toBe(false);
    expect(apiClient.clearAuth).toHaveBeenCalled();
  });

  it('não restaura sessão quando user no localStorage não é JSON válido', () => {
    localStorage.setItem('auth_token', 'valid-token');
    localStorage.setItem('user', 'isso-nao-e-json');
    localStorage.setItem('tenant_id', 'tenant-1');

    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitializing).toBe(false);
  });

  it('não restaura sessão quando tenant_id está ausente', () => {
    localStorage.setItem('auth_token', 'valid-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    // tenant_id não definido

    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });

  it('não restaura sessão quando user é string vazia', () => {
    localStorage.setItem('auth_token', 'valid-token');
    localStorage.setItem('user', '');
    localStorage.setItem('tenant_id', 'tenant-1');

    useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
