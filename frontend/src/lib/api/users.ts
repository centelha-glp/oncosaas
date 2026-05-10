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
  mfaEnabled: boolean;
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
  mfaEnabled?: boolean;
  /** Quando `role` é `COORDINATOR` ou `ADMIN` */
  clinicalSubrole?: ClinicalSubrole | null;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
  mfaEnabled?: boolean;
  clinicalSubrole?: ClinicalSubrole | null;
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
