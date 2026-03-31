import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWhatsAppConnectionDto } from './dto/create-whatsapp-connection.dto';
import { UpdateWhatsAppConnectionDto } from './dto/update-whatsapp-connection.dto';
import {
  WhatsAppConnection,
  WhatsAppConnectionStatus,
  WhatsAppAuthMethod,
} from '@generated/prisma/client';
import axios from 'axios';
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
  private readonly metaEmbeddedSignupRedirectUri: string;
  private readonly metaEmbeddedSignupUseRedirectUri: boolean;
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
      this.configService.get<string>('META_APP_ID') ||
      '';
    this.metaAppSecret =
      this.configService.get<string>('META_APP_SECRET') || '';
    this.metaConfigId =
      this.configService.get<string>('META_APP_CONFIG_ID') || '';
    this.metaOAuthRedirectUri =
      this.configService.get<string>('META_OAUTH_REDIRECT_URI') ||
      this.configService.get<string>('META_REDIRECT_URI') ||
      'http://localhost:3002/api/v1/whatsapp-connections/oauth/callback';
    this.metaEmbeddedSignupRedirectUri =
      this.configService.get<string>('META_EMBEDDED_SIGNUP_REDIRECT_URI') || '';
    this.metaEmbeddedSignupUseRedirectUri =
      this.configService.get<string>('META_EMBEDDED_SIGNUP_USE_REDIRECT_URI') !==
      'false';
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
      await this.prisma.oAuthState.delete({
        where: { state, tenantId: oauthState.tenantId },
      });
      throw new BadRequestException('State token expired');
    }

    // Limpar state usado
    await this.prisma.oAuthState.delete({
      where: { state, tenantId: oauthState.tenantId },
    });

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
              where: { id: existing.id, tenantId },
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
      where: { id, tenantId },
      data: updateData,
    });
  }

  /**
   * Deletar conexão
   */
  async remove(id: string, tenantId: string): Promise<void> {
    const connection = await this.findOne(id, tenantId);
    await this.prisma.whatsAppConnection.delete({ where: { id, tenantId } });
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
        where: { id, tenantId },
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
        where: { id, tenantId },
        data: {
          lastError: errorMessage,
          status: WhatsAppConnectionStatus.ERROR,
        },
      });

      throw new BadRequestException(`Connection test failed: ${errorMessage}`);
    }
  }

  /**
   * Trocar código do Embedded Signup por business token.
   *
   * O redirect_uri enviado na troca de código DEVE ser idêntico ao usado no OAuth.
   * Com FB.login (popup), o SDK usa redirect_uri interno (staticxx.facebook.com/xd_arbiter)
   * e o código é emitido para esse URI. A Meta aceita troca SEM redirect_uri nesse fluxo.
   *
   * Estratégia (baseada em fórum Meta e Stack Overflow):
   * 1. Omitir redirect_uri (null) - Eduardo/Hitesh: "no need to send, facebook handles it"
   * 2. String vazia ("") - HubertBlu: funcionou
   * 3. xd_arbiter (SDK usa ?version=46) - JSSDKXDConfig no sdk.js
   * 4. Nossa URL - apenas para fluxo redirect (não popup)
   *
   * Ref: https://developers.facebook.com/community/threads/597333095976937/
   * Ref: https://stackoverflow.com/questions/77555576
   * Ref: JSSDKXDConfig.XXdUrl no connect.facebook.net/sdk.js
   */
  private async exchangeCodeForBusinessToken(
    code: string,
    redirectUriFromFrontend?: string
  ): Promise<string> {
    const rawRedirectUri =
      redirectUriFromFrontend !== undefined
        ? String(redirectUriFromFrontend).trim()
        : (this.metaEmbeddedSignupRedirectUri?.trim() || '');
    const redirectUri = rawRedirectUri.replace(/\/$/, '');

    const tryExchange = async (
      redirectUriToUse: string | null,
      usePost: boolean
    ) => {
      const params: Record<string, string> = {
        client_id: this.metaAppId,
        client_secret: this.metaAppSecret,
        code: code,
      };
      if (redirectUriToUse !== null) {
        params.redirect_uri = redirectUriToUse;
      }

      this.logger.debug(
        `Exchanging code via ${this.metaApiBaseUrl}/oauth/access_token ` +
          `(${usePost ? 'POST' : 'GET'}, client_id=${this.metaAppId}, redirect_uri=${redirectUriToUse === null ? 'omitted' : `"${redirectUriToUse}"`})`
      );

      let response: { data: MetaTokenResponse };
      if (usePost) {
        response = await axios.post<MetaTokenResponse>(
          `${this.metaApiBaseUrl}/oauth/access_token`,
          new URLSearchParams(params).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );
      } else {
        response = await axios.get<MetaTokenResponse>(
          `${this.metaApiBaseUrl}/oauth/access_token`,
          { params }
        );
      }

      if (!response.data.access_token) {
        throw new BadRequestException(
          'Failed to exchange code for business token'
        );
      }

      return response.data.access_token;
    };

    // Ordem: redirect_uri do frontend PRIMEIRO (fallback_redirect_uri no FB.login)
    // Ref: FB.login usa primeiro URL de Valid OAuth Redirect URIs ou fallback_redirect_uri
    const primaryUris: (string | null)[] = [];

    if (redirectUri) {
      primaryUris.push(redirectUri);
      primaryUris.push(redirectUri + '/'); // Variante com barra final
    }

    primaryUris.push(null); // omitir - funciona para alguns (Eduardo, Hitesh)
    primaryUris.push('');

    // Se META_EMBEDDED_SIGNUP_USE_REDIRECT_URI=true E ainda não temos a URL, adicionar do .env
    if (
      this.metaEmbeddedSignupUseRedirectUri &&
      this.metaEmbeddedSignupRedirectUri &&
      !redirectUri
    ) {
      primaryUris.push(this.metaEmbeddedSignupRedirectUri.trim().replace(/\/$/, ''));
    }

    let lastError: any;
    for (let i = 0; i < primaryUris.length; i++) {
      const uriToTry = primaryUris[i];
      const label =
        uriToTry === null
          ? 'null (omit)'
          : uriToTry === ''
            ? '""'
            : uriToTry?.includes('xd_arbiter')
              ? `xd_arbiter`
              : 'app redirect_uri';

      try {
        if (i > 0) {
          this.logger.warn(
            `Token exchange retry (attempt ${i + 1}) with redirect_uri=${label}`
          );
        }
        // Tentar POST primeiro (Hitesh no fórum Meta relatou sucesso com POST)
        try {
          return await tryExchange(
            uriToTry === null ? null : uriToTry!,
            true
          );
        } catch (postErr: any) {
          const postMetaErr = postErr.response?.data?.error;
          const postIs36008 =
            postMetaErr?.code === 36008 ||
            postMetaErr?.error_subcode === 36008;
          if (postIs36008) {
            this.logger.debug(
              `POST failed (36008), retrying with GET for ${label}`
            );
            return await tryExchange(
              uriToTry === null ? null : uriToTry!,
              false
            );
          }
          throw postErr;
        }
      } catch (err: any) {
        lastError = err;
        const metaError = err.response?.data?.error;
        const is36008 =
          metaError?.code === 36008 || metaError?.error_subcode === 36008;

        this.logger.debug(
          `Attempt with ${label} failed${is36008 ? ' (36008 redirect_uri mismatch)' : ''}:`,
          metaError?.message || err.message
        );

        if (i === primaryUris.length - 1) {
          const msg = metaError?.message || lastError.message;
          this.logger.error(
            'All redirect_uri attempts failed. Ensure Valid OAuth Redirect URIs includes your app URL.'
          );
          throw new BadRequestException(`Failed to exchange code: ${msg}`);
        }
      }
    }

    // Fallback antigo mantido só por compatibilidade (não deve chegar aqui)
    throw lastError || new BadRequestException('Failed to exchange code');
  }

  private async _exchangeCodeForBusinessTokenLegacy(
    code: string,
    redirectUri: string
  ): Promise<string> {
    const tryExchange = async (redirectUriToUse: string | null) => {
      const params: Record<string, string> = {
        client_id: this.metaAppId,
        client_secret: this.metaAppSecret,
        code: code,
      };
      if (redirectUriToUse !== null) {
        params.redirect_uri = redirectUriToUse;
      }
      const response = await axios.get<MetaTokenResponse>(
        `${this.metaApiBaseUrl}/oauth/access_token`,
        { params }
      );
      if (!response.data.access_token) {
        throw new BadRequestException('Failed to exchange code for business token');
      }
      return response.data.access_token;
    };

    try {
      return await tryExchange(redirectUri);
    } catch (firstError: any) {
      const metaError = firstError.response?.data?.error;
      const is36008 =
        metaError?.code === 36008 || metaError?.error_subcode === 36008;

      if (!is36008) {
        const errorMessage = metaError?.message || firstError.message;
        this.logger.error('Error exchanging code:', { message: errorMessage });
        throw new BadRequestException(`Failed to exchange code: ${errorMessage}`);
      }

      const fallbackUris: (string | null)[] = [null, ''];

      for (let i = 0; i < fallbackUris.length; i++) {
        const uriToTry = fallbackUris[i];
        try {
          this.logger.warn(`Retrying token exchange (36008) with fallback ${i + 1}`);
          return await tryExchange(uriToTry === null ? null : uriToTry!);
        } catch (retryError: any) {
          if (i === fallbackUris.length - 1) {
            const msg = retryError.response?.data?.error?.message || retryError.message;
            throw new BadRequestException(`Failed to exchange code: ${msg}`);
          }
        }
      }
    }

    throw new BadRequestException('Failed to exchange code');
  }


  /**
   * Processar código do Embedded Signup.
   * Troca o código por business token.
   * Usa redirect_uri do frontend (exato) se fornecido; senão META_EMBEDDED_SIGNUP_REDIRECT_URI.
   */
  async processEmbeddedSignup(
    code: string,
    tenantId: string,
    redirectUriFromFrontend?: string
  ): Promise<{ success: boolean; connectionId: string; message: string }> {
    try {
      // Passo 1: Trocar código por business token
      const businessToken = await this.exchangeCodeForBusinessToken(
        code,
        redirectUriFromFrontend
      );

      // Passo 2: Tentar obter long-lived token (o token do Embedded Signup
      // pode já ser um System User token que não expira — nesse caso a troca falha
      // e usamos o original)
      let longLivedToken: string;
      let expiresIn: number;
      try {
        const longTokenResponse =
          await this.exchangeShortLivedToken(businessToken);
        longLivedToken = longTokenResponse.access_token;
        expiresIn = longTokenResponse.expires_in || 5184000;
      } catch {
        this.logger.log(
          'Token is already long-lived or system user token, using as-is'
        );
        longLivedToken = businessToken;
        expiresIn = 5184000;
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Buscar Business Managers
      const businesses = await this.getBusinessManagers(longLivedToken);

      if (businesses.length === 0) {
        throw new BadRequestException(
          'No Business Managers found. Please create a Business Manager first.'
        );
      }

      const businessId = businesses[0].id;

      // Buscar WhatsApp Business Accounts
      const whatsappAccounts = await this.getWhatsAppBusinessAccounts(
        businessId,
        longLivedToken
      );

      if (whatsappAccounts.length === 0) {
        throw new BadRequestException(
          'No WhatsApp Business Accounts found. Please complete the Embedded Signup flow.'
        );
      }

      // Buscar números de telefone e criar/atualizar conexões
      const connections: WhatsAppConnection[] = [];
      let isFirst = true;

      for (const account of whatsappAccounts) {
        const phoneNumbers = await this.getPhoneNumbers(
          account.id,
          longLivedToken
        );

        for (const phoneNumber of phoneNumbers) {
          const existing = await this.prisma.whatsAppConnection.findFirst({
            where: {
              tenantId,
              phoneNumber: phoneNumber.display_phone_number,
            },
          });

          const connectionData = {
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
            lastSyncAt: new Date(),
            lastError: null,
          };

          if (existing) {
            const updated = await this.prisma.whatsAppConnection.update({
              where: { id: existing.id, tenantId },
              data: {
                ...connectionData,
                isDefault: isFirst && !existing.isDefault,
              },
            });
            connections.push(updated);
          } else {
            const created = await this.prisma.whatsAppConnection.create({
              data: {
                ...connectionData,
                tenantId,
                name: `WhatsApp ${phoneNumber.display_phone_number}`,
                phoneNumber: phoneNumber.display_phone_number,
                isDefault: isFirst,
              },
            });
            connections.push(created);
          }

          isFirst = false;
        }
      }

      if (connections.length === 0) {
        throw new BadRequestException(
          'No phone numbers found in WhatsApp Business Account.'
        );
      }

      // Configurar webhooks (não-fatal)
      for (const account of whatsappAccounts) {
        try {
          await this.configureWebhook(account.id, longLivedToken);
        } catch (error: any) {
          this.logger.warn(
            `Failed to configure webhook for WABA ${account.id}:`,
            error.message
          );
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

  /**
   * Executar chamadas de API necessárias para completar os testes do Meta App Review.
   * Cada permissão exige que o app faça pelo menos uma chamada de API que a utilize.
   *
   * Permissões testadas:
   * - email: GET /me?fields=email
   * - business_management: GET /me/businesses e GET /{businessId}
   * - whatsapp_business_manage_events: POST /{wabaId}/subscribed_apps
   * - manage_app_solution: GET /{businessId}/owned_apps (se aplicável)
   */
  async runMetaAppReviewTests(
    id: string,
    tenantId: string
  ): Promise<{
    results: Record<string, { success: boolean; detail?: string }>;
    summary: string;
  }> {
    const connection = await this.findOne(id, tenantId);

    if (connection.authMethod !== WhatsAppAuthMethod.OAUTH) {
      throw new BadRequestException(
        'Apenas conexões OAuth/Embedded Signup suportam este teste. Use uma conexão obtida via "Conectar com Meta".'
      );
    }

    const token = decryptSensitiveData(
      connection.oauthAccessToken || '',
      this.encryptionKey
    );
    const businessId = connection.businessAccountId;
    const wabaId = connection.whatsappBusinessAccountId;

    if (!businessId || !wabaId) {
      throw new BadRequestException(
        'Conexão incompleta: faltam businessAccountId ou whatsappBusinessAccountId.'
      );
    }

    const results: Record<string, { success: boolean; detail?: string }> = {};

    // 1. email - GET /me?fields=email (requer escopo 'email' na Configuration)
    try {
      const meRes = await axios.get<{ id?: string; email?: string }>(
        `${this.metaApiBaseUrl}/me`,
        {
          params: {
            fields: 'id,email',
            access_token: token,
          },
        }
      );
      results.email = {
        success: true,
        detail: meRes.data.email
          ? `Email obtido (oculto por privacidade)`
          : 'Permissão concedida, email pode estar vazio',
      };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      results.email = {
        success: false,
        detail: msg.includes('email') || msg.includes('permission')
          ? `Adicione 'email' à Configuration do Embedded Signup no App Meta`
          : msg,
      };
    }

    // 2. business_management - GET /me/businesses
    try {
      const bizRes = await axios.get<{ data: MetaBusiness[] }>(
        `${this.metaApiBaseUrl}/me/businesses`,
        {
          params: { access_token: token },
        }
      );
      results.business_management = {
        success: true,
        detail: `${bizRes.data?.data?.length ?? 0} business(es) listado(s)`,
      };
    } catch (error: any) {
      results.business_management = {
        success: false,
        detail: error.response?.data?.error?.message || error.message,
      };
    }

    // 3. business_management - GET /{businessId} (detalhes do business)
    try {
      await axios.get(`${this.metaApiBaseUrl}/${businessId}`, {
        params: {
          fields: 'id,name',
          access_token: token,
        },
      });
      if (!results.business_management?.success) {
        results.business_management = {
          success: true,
          detail: 'Detalhes do business obtidos',
        };
      }
    } catch (error: any) {
      if (!results.business_management?.success) {
        results.business_management = {
          success: false,
          detail: error.response?.data?.error?.message || error.message,
        };
      }
    }

    // 4. whatsapp_business_manage_events - POST /{businessId}/subscribed_apps
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
        { params: { access_token: token } }
      );
      results.whatsapp_business_manage_events = {
        success: true,
        detail: 'Business Manager inscrito ao app (webhook events)',
      };
    } catch (error: any) {
      results.whatsapp_business_manage_events = {
        success: false,
        detail: error.response?.data?.error?.message || error.message,
      };
    }

    // 5. whatsapp_business_manage_events - POST /{wabaId}/subscribed_apps
    try {
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
        { params: { access_token: token } }
      );
      if (results.whatsapp_business_manage_events?.success) {
        results.whatsapp_business_manage_events.detail +=
          '; WABA inscrito para webhooks';
      } else {
        results.whatsapp_business_manage_events = {
          success: true,
          detail: 'WABA inscrito para webhooks',
        };
      }
    } catch (error: any) {
      if (!results.whatsapp_business_manage_events?.success) {
        results.whatsapp_business_manage_events = {
          success: false,
          detail: error.response?.data?.error?.message || error.message,
        };
      }
    }

    // 6. manage_app_solution - GET /{businessId}/owned_apps (para Solution Partners)
    try {
      await axios.get(`${this.metaApiBaseUrl}/${businessId}/owned_apps`, {
        params: { access_token: token },
      });
      results.manage_app_solution = {
        success: true,
        detail: 'Apps do business listados',
      };
    } catch (error: any) {
      results.manage_app_solution = {
        success: false,
        detail:
          error.response?.data?.error?.message ||
          error.message ||
          'Permissão pode ser exclusiva para Solution Partners',
      };
    }

    const successful = Object.values(results).filter((r) => r.success).length;
    const total = Object.keys(results).length;

    return {
      results,
      summary: `${successful}/${total} testes concluídos. Aguarde alguns minutos e atualize a página do App Review no Meta Developers para ver as chamadas registradas.`,
    };
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
      where: { id, tenantId },
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
