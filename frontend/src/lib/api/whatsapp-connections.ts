import { apiClient } from './client';

export interface WhatsAppConnection {
  id: string;
  tenantId: string;
  name: string;
  phoneNumber: string;
  phoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  businessAccountId?: string;
  authMethod: 'OAUTH' | 'MANUAL';
  status:
    | 'PENDING'
    | 'CONNECTING'
    | 'CONNECTED'
    | 'DISCONNECTED'
    | 'ERROR'
    | 'EXPIRED';
  isActive: boolean;
  isDefault: boolean;
  lastSyncAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsAppConnectionDto {
  name: string;
  phoneNumber: string;
  authMethod: 'OAUTH' | 'MANUAL';
  apiToken?: string;
  appId?: string;
  appSecret?: string;
  webhookUrl?: string;
  webhookVerifyToken?: string;
  isDefault?: boolean;
}

export interface UpdateWhatsAppConnectionDto {
  name?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface OAuthInitiateResponse {
  authorizationUrl: string;
  state: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
}

export interface EmbeddedSignupCodeResponse {
  success: boolean;
  connectionId: string;
  message: string;
}

export const whatsappConnectionsApi = {
  /**
   * Listar todas as conexões do tenant
   */
  getAll: async (): Promise<WhatsAppConnection[]> => {
    try {
      return await apiClient.get<WhatsAppConnection[]>('/whatsapp-connections');
    } catch (error: unknown) {
      // Se for 404 ou erro, retornar array vazio em vez de undefined
      if (
        error instanceof Error &&
        'response' in error &&
        (error as { response?: { status?: number } }).response?.status === 404
      ) {
        return [];
      }
      throw error;
    }
  },

  /**
   * Obter conexão específica
   */
  getById: async (id: string): Promise<WhatsAppConnection> => {
    return apiClient.get<WhatsAppConnection>(`/whatsapp-connections/${id}`);
  },

  /**
   * Criar conexão manual
   */
  create: async (
    data: CreateWhatsAppConnectionDto
  ): Promise<WhatsAppConnection> => {
    return apiClient.post<WhatsAppConnection>('/whatsapp-connections', data);
  },

  /**
   * Iniciar fluxo OAuth
   */
  initiateOAuth: async (): Promise<OAuthInitiateResponse> => {
    return apiClient.post<OAuthInitiateResponse>(
      '/whatsapp-connections/oauth/initiate'
    );
  },

  /**
   * Atualizar conexão
   */
  update: async (
    id: string,
    data: UpdateWhatsAppConnectionDto
  ): Promise<WhatsAppConnection> => {
    return apiClient.put<WhatsAppConnection>(
      `/whatsapp-connections/${id}`,
      data
    );
  },

  /**
   * Deletar conexão
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/whatsapp-connections/${id}`);
  },

  /**
   * Testar conexão
   */
  test: async (id: string): Promise<TestConnectionResponse> => {
    return apiClient.post<TestConnectionResponse>(
      `/whatsapp-connections/${id}/test`
    );
  },

  /**
   * Definir conexão como padrão
   */
  setDefault: async (id: string): Promise<WhatsAppConnection> => {
    return apiClient.post<WhatsAppConnection>(
      `/whatsapp-connections/${id}/set-default`
    );
  },

  /**
   * Executar testes de API do Meta App Review.
   * Dispara as chamadas necessárias para registrar uso das permissões:
   * email, business_management, whatsapp_business_manage_events, manage_app_solution.
   * Requer conexão OAuth (Embedded Signup).
   */
  runMetaTests: async (
    id: string
  ): Promise<{
    results: Record<string, { success: boolean; detail?: string }>;
    summary: string;
  }> => {
    return apiClient.post(
      `/whatsapp-connections/${id}/run-meta-tests`
    );
  },

  /**
   * Processar código do Embedded Signup.
   * @param redirect_uri URL exata da página (origin + pathname) para a troca de código com a Meta.
   */
  processEmbeddedSignup: async (
    code: string,
    redirect_uri?: string,
    waba_id?: string,
    phone_number_id?: string
  ): Promise<EmbeddedSignupCodeResponse> => {
    return apiClient.post<EmbeddedSignupCodeResponse>(
      '/whatsapp-connections/embedded-signup/process',
      { code, redirect_uri, waba_id, phone_number_id }
    );
  },
};
