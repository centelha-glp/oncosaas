import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWhatsAppConnectionDto } from './dto/create-whatsapp-connection.dto';
import { UpdateWhatsAppConnectionDto } from './dto/update-whatsapp-connection.dto';
import {
  WhatsAppConnection,
  WhatsAppConnectionStatus,
  WhatsAppAuthMethod,
} from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import {
  encryptSensitiveData,
  decryptSensitiveData,
} from './utils/encryption.util';
import * as crypto from 'crypto';
import * as bizSdk from 'facebook-nodejs-business-sdk';
const { FacebookAdsApi, Business, WhatsAppBusinessAccount, User } = bizSdk;

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MetaBusiness {
  id: string;
  name: string;
}

interface MetaWhatsAppBusinessAccount {
  id: string;
  name: string;
}

interface MetaPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name?: string;
}

@Injectable()
export class WhatsAppConnectionsService {
  private readonly logger = new Logger(WhatsAppConnectionsService.name);
  private readonly metaApiVersion: string;
  private readonly metaAppId: string;
  private readonly metaAppSecret: string;
  private readonly metaOAuthRedirectUri: string;
  private readonly encryptionKey: string;
  private readonly metaApiBaseUrl: string;
  private readonly metaConfigId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    this.metaApiVersion =
      this.configService.get<string>('META_API_VERSION') || 'v18.0';
    this.metaAppId =
      this.configService.get<string>('META_APP_ID') ||
      this.configService.get<string>('APP_META_APP_ID') ||
      '';
    this.metaAppSecret =
      this.configService.get<string>('META_APP_SECRET') || '';
    this.metaConfigId =
      this.configService.get<string>('APP_META_CONFIG_ID') || '';
    this.metaOAuthRedirectUri =
      this.configService.get<string>('META_OAUTH_REDIRECT_URI') ||
      this.configService.get<string>('META_REDIRECT_URI') ||
      'http://localhost:3002/api/v1/whatsapp-connections/oauth/callback';
    const configuredEncryptionKey =
      this.configService.get<string>('ENCRYPTION_KEY');
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (!configuredEncryptionKey) {
      if (isProduction) {
        throw new Error(
          'ENCRYPTION_KEY must be configured in production environment'
        );
      }
      this.logger.warn(
        '⚠️ ENCRYPTION_KEY not configured. Using insecure default key. ' +
          'This is acceptable for development but MUST be configured for production.'
      );
    }

    this.encryptionKey =
      configuredEncryptionKey || 'default-dev-key-32-bytes-long!!';
    this.metaApiBaseUrl = `https://graph.facebook.com/${this.metaApiVersion}`;

    // Configurar versão da API via variável de ambiente (SDK usa FACEBOOK_ADS_API_VERSION)
    if (!process.env.FACEBOOK_ADS_API_VERSION) {
      process.env.FACEBOOK_ADS_API_VERSION = this.metaApiVersion;
    }

    if (!this.metaAppId || !this.metaAppSecret) {
      this.logger.warn(
        'META_APP_ID or META_APP_SECRET not configured. OAuth flow will not work.'
      );
    }
  }

  /**
   * Listar todas as conexões do tenant
   */
  async findAll(tenantId: string): Promise<WhatsAppConnection[]> {
    return this.prisma.whatsAppConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obter conexão específica
   */
  async findOne(id: string, tenantId: string): Promise<WhatsAppConnection> {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!connection) {
      throw new NotFoundException(
        `WhatsApp connection with ID ${id} not found`
      );
    }

    return connection;
  }

  /**
   * Gerar state token seguro para OAuth
   */
  private generateStateToken(tenantId: string): string {
    const randomBytes = crypto.randomBytes(32);
    const state = randomBytes.toString('hex');
    return state;
  }

  /**
   * Validar e extrair tenantId do state token
   */
  private async validateStateToken(state: string): Promise<string> {
    const oauthState = await this.prisma.oAuthState.findUnique({
      where: { state },
    });

    if (!oauthState) {
      throw new BadRequestException('Invalid state token');
    }

    if (new Date() > oauthState.expiresAt) {
      await this.prisma.oAuthState.delete({ where: { state } });
      throw new BadRequestException('State token expired');
    }

    // Limpar state usado
    await this.prisma.oAuthState.delete({ where: { state } });

    return oauthState.tenantId;
  }

  /**
   * Iniciar fluxo OAuth
   */
  async initiateOAuthFlow(tenantId: string): Promise<{
    authorizationUrl: string;
    state: string;
  }> {
    if (!this.metaAppId || !this.metaAppSecret) {
      throw new BadRequestException(
        'Meta App credentials not configured. Please configure META_APP_ID and META_APP_SECRET.'
      );
    }

    const state = this.generateStateToken(tenantId);

    // Armazenar state temporariamente (expira em 10 minutos)
    await this.prisma.oAuthState.create({
      data: {
        state,
        tenantId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
      },
    });

    const scopes = [
      'business_management',
      'whatsapp_business_management',
      'whatsapp_business_messaging',
    ].join(',');

    const authorizationUrl =
      `${this.metaApiBaseUrl}/dialog/oauth?` +
      `client_id=${this.metaAppId}` +
      `&redirect_uri=${encodeURIComponent(this.metaOAuthRedirectUri)}` +
      `&scope=${scopes}` +
      `&state=${state}` +
      `&response_type=code`;

    return {
      authorizationUrl,
      state,
    };
  }

  /**
   * Trocar code por short-lived token
   */
  private async exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
    try {
      const response = await axios.get<MetaTokenResponse>(
        `${this.metaApiBaseUrl}/oauth/access_token`,
        {
          params: {
            client_id: this.metaAppId,
            client_secret: this.metaAppSecret,
            code,
            redirect_uri: this.metaOAuthRedirectUri,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        'Error exchanging code for token:',
        error.response?.data
      );
      throw new BadRequestException(
        `Failed to exchange code for token: ${error.response?.data?.error?.message || error.message}`
      );
    }
  }

  /**
   * Trocar short-lived token por long-lived token
   */
  private async exchangeShortLivedToken(
    shortToken: string
  ): Promise<MetaTokenResponse> {
    try {
      const response = await axios.get<MetaTokenResponse>(
        `${this.metaApiBaseUrl}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: this.metaAppId,
            client_secret: this.metaAppSecret,
            fb_exchange_token: shortToken,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        'Error exchanging short-lived token:',
        error.response?.data
      );
      throw new BadRequestException(
        `Failed to exchange token: ${error.response?.data?.error?.message || error.message}`
      );
    }
  }

  /**
   * Buscar Business Managers do usuário usando SDK
   */
  private async getBusinessManagers(
    accessToken: string
  ): Promise<MetaBusiness[]> {
    try {
      // Configurar API com access token (versão já configurada via env)
      const api = FacebookAdsApi.init(accessToken);

      // Buscar businesses do usuário
      const user = new User('me');
      const businesses = await user.getBusinesses([], {
        fields: ['id', 'name'],
      });

      return businesses.map((business: any) => ({
        id: business.id,
        name: business.name || 'Unnamed Business',
      }));
    } catch (error: any) {
      this.logger.error('Error fetching business managers:', error);
      // Fallback para HTTP direto se SDK falhar
      try {
        const response = await axios.get<{ data: MetaBusiness[] }>(
          `${this.metaApiBaseUrl}/me/businesses`,
          {
            params: {
              access_token: accessToken,
            },
          }
        );
        return response.data.data || [];
      } catch (httpError: any) {
        throw new BadRequestException(
          `Failed to fetch business managers: ${error.message || httpError.message}`
        );
      }
    }
  }

  /**
   * Inscrever Business Manager ao app usando SDK
   */
  private async subscribeBusinessManager(
    businessId: string,
    accessToken: string
  ): Promise<void> {
    try {
      const api = FacebookAdsApi.init(accessToken);
      const business = new Business(businessId);

      // Inscrever campos do WhatsApp
      await business.createSubscribedApp([], {
        subscribed_fields: ['messages', 'message_status', 'message_deliveries'],
      });

      this.logger.log(`Business Manager ${businessId} subscribed to app`);
    } catch (error: any) {
      this.logger.error('Error subscribing business manager:', error);
      // Fallback para HTTP direto
      try {
        await axios.post(
          `${this.metaApiBaseUrl}/${businessId}/subscribed_apps`,
          {
            subscribed_fields: [
              'messages',
              'message_status',
              'message_deliveries',
            ],
          },
          {
            params: {
              access_token: accessToken,
            },
          }
        );
        this.logger.log(
          `Business Manager ${businessId} subscribed to app (via HTTP)`
        );
      } catch (httpError: any) {
        throw new BadRequestException(
          `Failed to subscribe business manager: ${error.message || httpError.message}`
        );
      }
    }
  }

  /**
   * Buscar WhatsApp Business Accounts da BM usando SDK
   */
  private async getWhatsAppBusinessAccounts(
    businessId: string,
    accessToken: string
  ): Promise<MetaWhatsAppBusinessAccount[]> {
    try {
      const api = FacebookAdsApi.init(accessToken);
      const business = new Business(businessId);

      const accounts = await business.getOwnedWhatsAppBusinessAccounts([], {
        fields: ['id', 'name'],
      });

      return accounts.map((account: any) => ({
        id: account.id,
        name: account.name || 'Unnamed WhatsApp Business Account',
      }));
    } catch (error: any) {
      this.logger.error('Error fetching WhatsApp Business Accounts:', error);
      // Fallback para HTTP direto
      try {
        const response = await axios.get<{
          data: MetaWhatsAppBusinessAccount[];
        }>(
          `${this.metaApiBaseUrl}/${businessId}/owned_whatsapp_business_accounts`,
          {
            params: {
              access_token: accessToken,
            },
          }
        );
        return response.data.data || [];
      } catch (httpError: any) {
        throw new BadRequestException(
          `Failed to fetch WhatsApp Business Accounts: ${error.message || httpError.message}`
        );
      }
    }
  }

  /**
   * Buscar números de telefone de uma conta WhatsApp Business usando SDK
   */
  private async getPhoneNumbers(
    whatsappAccountId: string,
    accessToken: string
  ): Promise<MetaPhoneNumber[]> {
    try {
      const api = FacebookAdsApi.init(accessToken);
      const account = new WhatsAppBusinessAccount(whatsappAccountId);

      const phoneNumbers = await account.getPhoneNumbers([], {
        fields: ['id', 'display_phone_number', 'verified_name'],
      });

      return phoneNumbers.map((pn: any) => ({
        id: pn.id,
        display_phone_number: pn.display_phone_number || '',
        verified_name: pn.verified_name,
      }));
    } catch (error: any) {
      this.logger.error('Error fetching phone numbers:', error);
      // Fallback para HTTP direto
      try {
        const response = await axios.get<{ data: MetaPhoneNumber[] }>(
          `${this.metaApiBaseUrl}/${whatsappAccountId}/phone_numbers`,
          {
            params: {
              access_token: accessToken,
            },
          }
        );
        return response.data.data || [];
      } catch (httpError: any) {
        throw new BadRequestException(
          `Failed to fetch phone numbers: ${error.message || httpError.message}`
        );
      }
    }
  }

  /**
   * Processar callback OAuth completo
   */
  async handleOAuthCallback(
    code: string,
    state: string
  ): Promise<{ connections: WhatsAppConnection[]; redirectUrl: string }> {
    // Validar state e recuperar tenantId
    const tenantId = await this.validateStateToken(state);

    try {
      // Passo 1: Trocar code por short-lived token
      const shortTokenResponse = await this.exchangeCodeForToken(code);
      const shortToken = shortTokenResponse.access_token;

      // Passo 2: Trocar por long-lived token
      const longTokenResponse = await this.exchangeShortLivedToken(shortToken);
      const longLivedToken = longTokenResponse.access_token;
      const expiresIn = longTokenResponse.expires_in || 5184000; // 60 dias padrão
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Passo 3: Buscar Business Managers
      const businesses = await this.getBusinessManagers(longLivedToken);

      if (businesses.length === 0) {
        throw new BadRequestException(
          'No Business Managers found. Please create a Business Manager first.'
        );
      }

      // Usar o primeiro Business Manager (ou permitir usuário escolher depois)
      const businessId = businesses[0].id;

      // Passo 4: Inscrever BM ao app
      await this.subscribeBusinessManager(businessId, longLivedToken);

      // Passo 5: Buscar WhatsApp Business Accounts
      const whatsappAccounts = await this.getWhatsAppBusinessAccounts(
        businessId,
        longLivedToken
      );

      if (whatsappAccounts.length === 0) {
        throw new BadRequestException(
          'No WhatsApp Business Accounts found in this Business Manager.'
        );
      }

      // Passo 6: Buscar números de telefone e criar conexões
      const connections: WhatsAppConnection[] = [];
      let isFirst = true;

      for (const account of whatsappAccounts) {
        const phoneNumbers = await this.getPhoneNumbers(
          account.id,
          longLivedToken
        );

        for (const phoneNumber of phoneNumbers) {
          // Verificar se já existe conexão com este número
          const existing = await this.prisma.whatsAppConnection.findFirst({
            where: {
              tenantId,
              phoneNumber: phoneNumber.display_phone_number,
            },
          });

          if (existing) {
            // Atualizar conexão existente
            const updated = await this.prisma.whatsAppConnection.update({
              where: { id: existing.id },
              data: {
                phoneNumberId: phoneNumber.id,
                whatsappBusinessAccountId: account.id,
                businessAccountId: businessId,
                oauthAccessToken: encryptSensitiveData(
                  longLivedToken,
                  this.encryptionKey
                ),
                oauthExpiresAt: expiresAt,
                oauthScopes: [
                  'business_management',
                  'whatsapp_business_management',
                  'whatsapp_business_messaging',
                ],
                authMethod: WhatsAppAuthMethod.OAUTH,
                status: WhatsAppConnectionStatus.CONNECTED,
                isActive: true,
                isDefault: isFirst && !existing.isDefault, // Primeira conexão como padrão
                lastSyncAt: new Date(),
                lastError: null,
              },
            });
            connections.push(updated);
          } else {
            // Criar nova conexão
            const created = await this.prisma.whatsAppConnection.create({
              data: {
                tenantId,
                name: `WhatsApp ${phoneNumber.display_phone_number}`,
                phoneNumber: phoneNumber.display_phone_number,
                phoneNumberId: phoneNumber.id,
                whatsappBusinessAccountId: account.id,
                businessAccountId: businessId,
                oauthAccessToken: encryptSensitiveData(
                  longLivedToken,
                  this.encryptionKey
                ),
                oauthExpiresAt: expiresAt,
                oauthScopes: [
                  'business_management',
                  'whatsapp_business_management',
                  'whatsapp_business_messaging',
                ],
                authMethod: WhatsAppAuthMethod.OAUTH,
                status: WhatsAppConnectionStatus.CONNECTED,
                isActive: true,
                isDefault: isFirst, // Primeira conexão como padrão
                lastSyncAt: new Date(),
              },
            });
            connections.push(created);
          }

          isFirst = false;
        }
      }

      // Configurar webhook global (se ainda não configurado)
      await this.setupWebhookIfNeeded();

      const redirectUrl = `${
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3000'
      }/integrations?success=true&connected=${connections.length}`;

      return { connections, redirectUrl };
    } catch (error: any) {
      this.logger.error('Error in OAuth callback:', error);
      const errorMessage =
        error.response?.data?.error?.message ||
        error.message ||
        'Failed to connect WhatsApp';
      const redirectUrl = `${
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3000'
      }/integrations?error=${encodeURIComponent(errorMessage)}`;
      // Retornar redirectUrl mesmo em caso de erro para que o controller possa redirecionar
      return { connections: [], redirectUrl };
    }
  }

  /**
   * C1: Configurar webhook no nível de app via Meta Graph API.
   *
   * Registra o callback_url + verify_token para a subscription
   * `whatsapp_business_account`, habilitando recepção de eventos
   * de mensagens, entrega e leitura.
   *
   * Deve ser chamado uma vez por app (não por tenant). Usa o
   * App Access Token (APP_ID|APP_SECRET) — sem necessidade de
   * token de usuário.
   */
  private async setupWebhookIfNeeded(): Promise<void> {
    const appId = this.configService.get<string>('META_APP_ID');
    const appSecret = this.configService.get<string>('META_APP_SECRET');

    if (!appId || !appSecret) {
      this.logger.warn(
        'META_APP_ID or META_APP_SECRET not configured — skipping automatic webhook registration. ' +
          'Configure the webhook manually in the Meta App Dashboard.'
      );
      return;
    }

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:3002';
    const webhookUrl =
      this.configService.get<string>('WEBHOOK_URL') ||
      `${backendUrl}/api/v1/channel-gateway/webhook/whatsapp`;
    const verifyToken =
      this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
      'webhook-verify-token-change-in-production';
    const apiVersion =
      this.configService.get<string>('META_API_VERSION') || 'v18.0';

    // App Access Token = APP_ID|APP_SECRET (static, no expiry)
    const appAccessToken = `${appId}|${appSecret}`;

    try {
      const response = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${appId}/subscriptions`,
        null,
        {
          params: {
            object: 'whatsapp_business_account',
            callback_url: webhookUrl,
            verify_token: verifyToken,
            fields:
              'messages,message_deliveries,message_reads,messaging_postbacks',
            include_values: 'true',
            access_token: appAccessToken,
          },
        }
      );

      if (response.data?.success) {
        this.logger.log(
          `Webhook registered successfully: ${webhookUrl} (fields: messages, deliveries, reads)`
        );
      } else {
        this.logger.warn(
          `Webhook registration response unexpected: ${JSON.stringify(response.data)}`
        );
      }
    } catch (error: any) {
      const detail =
        error?.response?.data?.error?.message || error?.message || 'unknown';
      // Non-fatal: log but don't throw — the rest of the signup still completes.
      // Common cause: webhook URL not publicly accessible in development.
      this.logger.error(
        `Failed to register webhook with Meta (${webhookUrl}): ${detail}. ` +
          'Configure the webhook manually in the Meta App Dashboard if this persists.'
      );
    }
  }

  /**
   * Criar conexão manual (fallback)
   */
  async createManualConnection(
    dto: CreateWhatsAppConnectionDto,
    tenantId: string
  ): Promise<WhatsAppConnection> {
    // Validar campos obrigatórios para modo manual
    if (dto.authMethod === WhatsAppAuthMethod.MANUAL) {
      if (!dto.apiToken) {
        throw new BadRequestException(
          'API token is required for manual connection'
        );
      }
    }

    // Verificar se já existe conexão com este número
    const existing = await this.prisma.whatsAppConnection.findFirst({
      where: {
        tenantId,
        phoneNumber: dto.phoneNumber,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Connection with phone number ${dto.phoneNumber} already exists`
      );
    }

    // Se for padrão, desmarcar outras conexões padrão
    if (dto.isDefault) {
      await this.prisma.whatsAppConnection.updateMany({
        where: {
          tenantId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const connection = await this.prisma.whatsAppConnection.create({
      data: {
        ...dto,
        tenantId,
        apiToken: dto.apiToken
          ? encryptSensitiveData(dto.apiToken, this.encryptionKey)
          : null,
        appSecret: dto.appSecret
          ? encryptSensitiveData(dto.appSecret, this.encryptionKey)
          : null,
        status: WhatsAppConnectionStatus.PENDING,
        isActive: false,
      },
    });

    return connection;
  }

  /**
   * Atualizar conexão
   */
  async update(
    id: string,
    dto: UpdateWhatsAppConnectionDto,
    tenantId: string
  ): Promise<WhatsAppConnection> {
    const connection = await this.findOne(id, tenantId);

    // Se for padrão, desmarcar outras conexões padrão
    if (dto.isDefault) {
      await this.prisma.whatsAppConnection.updateMany({
        where: {
          tenantId,
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });
    }

    const updateData: any = { ...dto };

    // Criptografar campos sensíveis se fornecidos
    if (dto.apiToken) {
      updateData.apiToken = encryptSensitiveData(
        dto.apiToken,
        this.encryptionKey
      );
    }
    if (dto.appSecret) {
      updateData.appSecret = encryptSensitiveData(
        dto.appSecret,
        this.encryptionKey
      );
    }

    return this.prisma.whatsAppConnection.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Deletar conexão
   */
  async remove(id: string, tenantId: string): Promise<void> {
    const connection = await this.findOne(id, tenantId);
    await this.prisma.whatsAppConnection.delete({ where: { id } });
  }

  /**
   * Testar conexão
   */
  async testConnection(
    id: string,
    tenantId: string
  ): Promise<{ success: boolean; message: string }> {
    const connection = await this.findOne(id, tenantId);

    if (connection.status !== WhatsAppConnectionStatus.CONNECTED) {
      throw new BadRequestException('Connection is not active');
    }

    try {
      let accessToken: string;

      if (connection.authMethod === WhatsAppAuthMethod.OAUTH) {
        if (!connection.oauthAccessToken) {
          throw new BadRequestException('OAuth token not found');
        }
        accessToken = decryptSensitiveData(
          connection.oauthAccessToken,
          this.encryptionKey
        );
      } else {
        if (!connection.apiToken) {
          throw new BadRequestException('API token not found');
        }
        accessToken = decryptSensitiveData(
          connection.apiToken,
          this.encryptionKey
        );
      }

      if (!connection.phoneNumberId) {
        throw new BadRequestException('Phone number ID not found');
      }

      // Testar conectividade verificando informações do número
      const response = await axios.get(
        `${this.metaApiBaseUrl}/${connection.phoneNumberId}`,
        {
          params: {
            access_token: accessToken,
            fields: 'display_phone_number,verified_name',
          },
        }
      );

      // Atualizar última sincronização
      await this.prisma.whatsAppConnection.update({
        where: { id },
        data: {
          lastSyncAt: new Date(),
          lastError: null,
        },
      });

      return {
        success: true,
        message: 'Connection test successful',
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;

      // Atualizar último erro
      await this.prisma.whatsAppConnection.update({
        where: { id },
        data: {
          lastError: errorMessage,
          status: WhatsAppConnectionStatus.ERROR,
        },
      });

      throw new BadRequestException(`Connection test failed: ${errorMessage}`);
    }
  }

  /**
   * Definir conexão como padrão
   */
  /**
   * Trocar código do Embedded Signup por business token
   * Conforme documentação: https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation
   */
  private async exchangeCodeForBusinessToken(code: string): Promise<string> {
    try {
      const response = await axios.post<MetaTokenResponse>(
        `${this.metaApiBaseUrl}/oauth/access_token`,
        null,
        {
          params: {
            client_id: this.metaAppId,
            client_secret: this.metaAppSecret,
            code: code,
            redirect_uri: this.metaOAuthRedirectUri,
          },
        }
      );

      if (!response.data.access_token) {
        throw new BadRequestException(
          'Failed to exchange code for business token'
        );
      }

      return response.data.access_token;
    } catch (error: any) {
      this.logger.error(
        'Error exchanging code for business token:',
        error.response?.data || error.message
      );
      throw new BadRequestException(
        `Failed to exchange code: ${error.response?.data?.error?.message || error.message}`
      );
    }
  }

  /**
   * Processar código do Embedded Signup
   * O código precisa ser trocado por business token primeiro
   */
  async processEmbeddedSignup(
    code: string,
    tenantId: string
  ): Promise<{ success: boolean; connectionId: string; message: string }> {
    try {
      // Passo 1: Trocar código por business token
      const businessToken = await this.exchangeCodeForBusinessToken(code);

      // Passo 2: Buscar Business Managers
      const businesses = await this.getBusinessManagers(businessToken);

      if (businesses.length === 0) {
        throw new BadRequestException(
          'No Business Managers found. Please create a Business Manager first.'
        );
      }

      // Usar o primeiro Business Manager
      const businessId = businesses[0].id;

      // Passo 3: Buscar WhatsApp Business Accounts
      const whatsappAccounts = await this.getWhatsAppBusinessAccounts(
        businessId,
        businessToken
      );

      if (whatsappAccounts.length === 0) {
        throw new BadRequestException(
          'No WhatsApp Business Accounts found. Please complete the Embedded Signup flow.'
        );
      }

      // Passo 4: Buscar números de telefone e criar conexões
      const connections: WhatsAppConnection[] = [];
      let isFirst = true;

      for (const account of whatsappAccounts) {
        const phoneNumbers = await this.getPhoneNumbers(
          account.id,
          businessToken
        );

        for (const phoneNumber of phoneNumbers) {
          // Verificar se já existe conexão com este número
          const existing = await this.prisma.whatsAppConnection.findFirst({
            where: {
              tenantId,
              phoneNumber: phoneNumber.display_phone_number,
            },
          });

          if (existing) {
            // Atualizar conexão existente
            const updated = await this.prisma.whatsAppConnection.update({
              where: { id: existing.id },
              data: {
                phoneNumberId: phoneNumber.id,
                whatsappBusinessAccountId: account.id,
                businessAccountId: businessId,
                oauthAccessToken: encryptSensitiveData(
                  businessToken,
                  this.encryptionKey
                ),
                oauthExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 dias
                oauthScopes: [
                  'business_management',
                  'whatsapp_business_management',
                  'whatsapp_business_messaging',
                ],
                authMethod: WhatsAppAuthMethod.OAUTH,
                status: WhatsAppConnectionStatus.CONNECTED,
                isActive: true,
                isDefault: isFirst && !existing.isDefault,
                lastSyncAt: new Date(),
                lastError: null,
              },
            });
            connections.push(updated);
          } else {
            // Criar nova conexão
            const created = await this.prisma.whatsAppConnection.create({
              data: {
                tenantId,
                name: `WhatsApp ${phoneNumber.display_phone_number}`,
                phoneNumber: phoneNumber.display_phone_number,
                phoneNumberId: phoneNumber.id,
                whatsappBusinessAccountId: account.id,
                businessAccountId: businessId,
                oauthAccessToken: encryptSensitiveData(
                  businessToken,
                  this.encryptionKey
                ),
                oauthExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 dias
                oauthScopes: [
                  'business_management',
                  'whatsapp_business_management',
                  'whatsapp_business_messaging',
                ],
                authMethod: WhatsAppAuthMethod.OAUTH,
                status: WhatsAppConnectionStatus.CONNECTED,
                isActive: true,
                isDefault: isFirst,
                lastSyncAt: new Date(),
              },
            });
            connections.push(created);
            isFirst = false;
          }
        }
      }

      if (connections.length === 0) {
        throw new BadRequestException(
          'No phone numbers found in WhatsApp Business Account.'
        );
      }

      // Passo 5: Configurar webhooks para cada WABA
      for (const account of whatsappAccounts) {
        try {
          await this.configureWebhook(account.id, businessToken);
        } catch (error: any) {
          this.logger.warn(
            `Failed to configure webhook for WABA ${account.id}:`,
            error.message
          );
          // Não falhar o processo se webhook falhar
        }
      }

      return {
        success: true,
        connectionId: connections[0].id,
        message: `Successfully connected ${connections.length} phone number(s)`,
      };
    } catch (error: any) {
      this.logger.error('Error processing Embedded Signup:', error);
      throw new BadRequestException(
        error.message || 'Failed to process Embedded Signup'
      );
    }
  }

  /**
   * Configurar webhook para um WABA
   */
  private async configureWebhook(
    wabaId: string,
    accessToken: string
  ): Promise<void> {
    try {
      // CORREÇÃO: Usar BACKEND_URL ao invés de FRONTEND_URL para webhook
      const backendUrl =
        this.configService.get<string>('BACKEND_URL') ||
        'http://localhost:3002';
      // C2: correct controller path is /api/v1/channel-gateway/webhook/whatsapp
      const webhookUrl =
        this.configService.get<string>('WEBHOOK_URL') ||
        `${backendUrl}/api/v1/channel-gateway/webhook/whatsapp`;
      const verifyToken =
        this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
        'webhook-verify-token-change-in-production';

      // Subscrever campos do webhook
      await axios.post(
        `${this.metaApiBaseUrl}/${wabaId}/subscribed_apps`,
        {
          subscribed_fields: [
            'messages',
            'message_status',
            'message_deliveries',
            'message_reads',
          ],
        },
        {
          params: {
            access_token: accessToken,
          },
        }
      );

      this.logger.log(`Webhook configured for WABA ${wabaId}`);
    } catch (error: any) {
      this.logger.error(`Error configuring webhook for WABA ${wabaId}:`, error);
      throw error;
    }
  }

  async setDefault(id: string, tenantId: string): Promise<WhatsAppConnection> {
    const connection = await this.findOne(id, tenantId);

    // Desmarcar outras conexões padrão
    await this.prisma.whatsAppConnection.updateMany({
      where: {
        tenantId,
        isDefault: true,
        id: { not: id },
      },
      data: {
        isDefault: false,
      },
    });

    // Marcar esta como padrão
    return this.prisma.whatsAppConnection.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  /**
   * Verificar expiração de tokens e renovar se necessário
   */
  async checkTokenExpiration(
    connectionId: string,
    tenantId: string
  ): Promise<{ expired: boolean; expiresAt: Date | null }> {
    const connection = await this.findOne(connectionId, tenantId);

    if (connection.authMethod !== WhatsAppAuthMethod.OAUTH) {
      return { expired: false, expiresAt: null };
    }

    if (!connection.oauthExpiresAt) {
      return { expired: false, expiresAt: null };
    }

    const expired = new Date() >= connection.oauthExpiresAt;

    return {
      expired,
      expiresAt: connection.oauthExpiresAt,
    };
  }
}
