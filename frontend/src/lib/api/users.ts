import { apiClient } from './client';

export type UserRole =
  | 'ADMIN'
  | 'ONCOLOGIST'
  | 'DOCTOR'
  | 'NURSE_CHIEF'
  | 'NURSE'
  | 'COORDINATOR'
  | 'SECRETARY';

/** Subpapel clínico do coordenador (assinatura enfermagem vs médica no prontuário) */
export type ClinicalSubrole = 'NURSING' | 'MEDICAL';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clinicalSubrole?: ClinicalSubrole | null;
  /**
   * Flag de MFA (somente leitura no frontend). O backend ainda não suporta
   * o fluxo TOTP de verificação, então a alteração via API foi removida —
   * o campo permanece exposto pelo GET apenas para auditoria de estado.
   */
  mfaEnabled: boolean;
  crmUf?: string | null;
  crmNumber?: string | null;
  corenUf?: string | null;
  corenNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    name: string;
  };
}

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  /** Quando `role` é `COORDINATOR` ou `ADMIN` */
  clinicalSubrole?: ClinicalSubrole | null;
  /** Obrigatório para ONCOLOGIST / DOCTOR */
  crmUf?: string;
  crmNumber?: string;
  /** Obrigatório para NURSE / NURSE_CHIEF */
  corenUf?: string;
  corenNumber?: string;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
  clinicalSubrole?: ClinicalSubrole | null;
  crmUf?: string;
  crmNumber?: string;
  corenUf?: string;
  corenNumber?: string;
}

export const usersApi = {
  async getAll(): Promise<User[]> {
    const response = await apiClient.get<User[]>('/users');
    return response;
  },

  async getById(id: string): Promise<User> {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response;
  },

  async create(data: CreateUserDto): Promise<User> {
    const response = await apiClient.post<User>('/users', data);
    return response;
  },

  async update(id: string, data: UpdateUserDto): Promise<User> {
    const response = await apiClient.patch<User>(`/users/${id}`, data);
    return response;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },
};
