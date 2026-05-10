import { apiClient } from './client';

export interface LoginDto {
  email: string;
  password: string;
  tenantId?: string;
}

/** Registro via convite (POST /auth/register) — role vem do token, não do body. */
export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  inviteToken: string;
  crmUf?: string;
  crmNumber?: string;
  corenUf?: string;
  corenNumber?: string;
  /** Convite COORDINATOR/ADMIN — alinha ao backend */
  clinicalSubrole?: 'NURSING' | 'MEDICAL' | null;
}

export interface RegisterInstitutionDto {
  institutionName: string;
  name: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role:
    | 'ADMIN'
    | 'ONCOLOGIST'
    | 'DOCTOR'
    | 'NURSE_CHIEF'
    | 'NURSE'
    | 'COORDINATOR'
    | 'SECRETARY';
  /** Presente para coordenadores (prontuário) */
  clinicalSubrole?: 'NURSING' | 'MEDICAL' | null;
  crmUf?: string | null;
  crmNumber?: string | null;
  corenUf?: string | null;
  corenNumber?: string | null;
  tenantId: string;
  tenant?: {
    id: string;
    name: string;
    settings?: {
      enabledCancerTypes?: string[];
      [key: string]: unknown;
    } | null;
  };
}

/** GET /auth/invite-preview — dados para montar o formulário sem consumir o token */
export interface InvitePreviewResponse {
  role: User['role'];
  tenantName: string;
}

/** POST /auth/invite — apenas ADMIN ou COORDINATOR (backend) */
export interface CreateInviteDto {
  role: User['role'];
}

export interface CreateInviteResponse {
  inviteToken: string;
  expiresIn: string;
}

/** Login / register-institution: JWT só em cookies HttpOnly (sem access_token no JSON). */
export interface LoginResponse {
  user: User;
}

export interface RegisterPublicResponse {
  message: string;
  user: User;
}

/** Resposta de GET /auth/profile — alinhada ao que o backend retorna */
export interface AuthProfileResponse {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  clinicalSubrole: 'NURSING' | 'MEDICAL' | null;
  crmUf?: string | null;
  crmNumber?: string | null;
  corenUf?: string | null;
  corenNumber?: string | null;
  tenantId: string;
  tenant?: User['tenant'];
  mfaEnabled?: boolean;
}

export const authApi = {
  async invitePreview(token: string): Promise<InvitePreviewResponse> {
    const q = new URLSearchParams({ token });
    return apiClient.get<InvitePreviewResponse>(
      `/auth/invite-preview?${q.toString()}`
    );
  },

  async createInvite(data: CreateInviteDto): Promise<CreateInviteResponse> {
    return apiClient.post<CreateInviteResponse>('/auth/invite', data);
  },

  async login(credentials: LoginDto): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      '/auth/login',
      credentials
    );

    apiClient.setTenantId(response.user.tenantId);

    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));
    }

    return response;
  },

  async register(data: RegisterDto): Promise<RegisterPublicResponse> {
    const response = await apiClient.post<RegisterPublicResponse>(
      '/auth/register',
      data
    );

    apiClient.setTenantId(response.user.tenantId);

    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));
    }

    return response;
  },

  async registerInstitution(data: RegisterInstitutionDto): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      '/auth/register-institution',
      data
    );

    apiClient.setTenantId(response.user.tenantId);

    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));
    }

    return response;
  },

  async logout(): Promise<void> {
    const legacy = apiClient.getRefreshToken();
    try {
      await apiClient.post(
        '/auth/logout',
        legacy ? { refresh_token: legacy } : {}
      );
    } catch {
      // Ignorar erros no logout — limpar dados locais de qualquer forma
    }
    apiClient.clearAuth();
  },

  getCurrentUser(): User | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch {
          return null;
        }
      }
    }
    return null;
  },

  isAuthenticated(): boolean {
    return !!apiClient.getToken() && !apiClient.isTokenExpired();
  },

  /**
   * Atualiza nome, papel, clinicalSubrole e tenant a partir do servidor.
   * Necessário após evoluir o modelo (ex.: subpapel clínico) com sessão antiga no localStorage.
   */
  async refreshSessionUser(): Promise<User | null> {
    try {
      const profile = await apiClient.get<AuthProfileResponse>('/auth/profile');
      const prev = this.getCurrentUser();
      const merged: User = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        clinicalSubrole: profile.clinicalSubrole ?? null,
        tenantId: profile.tenantId,
        tenant: profile.tenant ?? prev?.tenant,
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(merged));
      }
      return merged;
    } catch {
      return null;
    }
  },
};
