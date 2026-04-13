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
    const configuredEncryptionKey =
      this.configService.get<string>('ENCRYPTION_KEY');
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (!configuredEncryptionKey) {
      throw new Error(
        'ENCRYPTION_KEY must be configured in all environments. ' +
          'Set ENCRYPTION_KEY in your .env file (minimum 32 characters).'
      );
    }

    this.encryptionKey = configuredEncryptionKey;
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
      take: 100,
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
   * Buscar Business Managers do usuário
   */
  private async getBusinessManagers(
    accessToken: string
  ): Promise<MetaBusiness[]> {
    try {
      const response = await axios.get<{ data: MetaBusiness[] }>(
        `${this.metaApiBaseUrl}/me/businesses`,
        { params: { access_token: accessToken } }
      );
      return response.data.data || [];
    } catch (err: any) {
      this.logger.warn(
        `/me/businesses failed: ${err.response?.data?.error?.message || err.message}`
      );
      return [];
    }
  }

  /**
   * Inscrever Business Manager ao app
   */
  private async subscribeBusinessManager(
    businessId: string,
    accessToken: string
  ): Promise<void> {
    try {
      await axios.post(
        `${this.metaApiBaseUrl}/${businessId}/subscribed_apps`,
        { subscribed_fields: ['messages', 'message_status', 'message_deliveries'] },
        { params: { access_token: accessToken } }
      );
      this.logger.log(`Business Manager ${businessId} subscribed to app`);
    } catch (err: any) {
      throw new BadRequestException(
        `Failed to subscribe business manager: ${err.response?.data?.error?.message || err.message}`
      );
    }
  }

  /**
   * Buscar WABAs diretamente do token via /me/whatsapp_business_accounts
   * Funciona com token do Embedded Signup sem precisar de business_management.
   */
  /**
   * Obtém WABA IDs do token via debug_token granular_scopes.
   * É a forma correta de descobrir quais WABAs o usuário concedeu acesso
   * durante o Embedded Signup, sem precisar de business_management.
   * Ref: https://developers.facebook.com/docs/graph-api/reference/debug_token/
   */
  private async getWabasFromToken(
    accessToken: string
  ): Promise<MetaWhatsAppBusinessAccount[]> {
    try {
      const appToken = `${this.metaAppId}|${this.metaAppSecret}`;
      const response = await axios.get<{
        data: {
          granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
        };
      }>(`${this.metaApiBaseUrl}/debug_token`, {
        params: {
          input_token: accessToken,
          access_token: appToken,
          fields: 'granular_scopes',
        },
      });

      const granularScopes = response.data?.data?.granular_scopes || [];
      const wabaScope = granularScopes.find(
        (s) =>
          s.scope === 'whatsapp_business_management' ||
          s.scope === 'whatsapp_business_messaging'
      );
      const wabaIds = wabaScope?.target_ids || [];
      this.logger.log(
        `debug_token granular_scopes: found ${wabaIds.length} WABA ID(s): ${wabaIds.join(', ')}`
      );
      return wabaIds.map((id) => ({ id, name: '' }));
    } catch (err: any) {
      this.logger.warn(
        `debug_token failed: ${err.response?.data?.error?.message || err.message}`
      );
      return [];
    }
  }

  /**
   * Buscar WhatsApp Business Accounts da BM
   */
  private async getWhatsAppBusinessAccounts(
    businessId: string,
    accessToken: string
  ): Promise<MetaWhatsAppBusinessAccount[]> {
    try {
      const response = await axios.get<{ data: MetaWhatsAppBusinessAccount[] }>(
        `${this.metaApiBaseUrl}/${businessId}/owned_whatsapp_business_accounts`,
        { params: { access_token: accessToken, fields: 'id,name' } }
      );
      return response.data.data || [];
    } catch (err: any) {
      throw new BadRequestException(
        `Failed to fetch WhatsApp Business Accounts: ${err.response?.data?.error?.message || err.message}`
      );
    }
  }

  /**
   * Buscar números de telefone de uma conta WhatsApp Business
   */
  private async getPhoneNumbers(
    whatsappAccountId: string,
    accessToken: string
  ): Promise<MetaPhoneNumber[]> {
    try {
      const response = await axios.get<{ data: MetaPhoneNumber[] }>(
        `${this.metaApiBaseUrl}/${whatsappAccountId}/phone_numbers`,
        { params: { access_token: accessToken, fields: 'id,display_phone_number,verified_name' } }
      );
      return response.data.data || [];
    } catch (err: any) {
      throw new BadRequestException(
        `Failed to fetch phone numbers: ${err.response?.data?.error?.message || err.message}`
      );
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
  /**
   * Trocar código do Embedded Signup por business token.
   * O fluxo popup do Facebook SDK (FB.login) não usa redirect_uri —
   * omitir é a abordagem correta.
   */
  private async exchangeCodeForBusinessToken(code: string): Promise<string> {
    const params = {
      client_id: this.metaAppId,
      client_secret: this.metaAppSecret,
      code,
    };

    // Tentar POST sem redirect_uri (recomendado para popup SDK)
    try {
      const response = await axios.post<MetaTokenResponse>(
        `${this.metaApiBaseUrl}/oauth/access_token`,
        new URLSearchParams(params as Record<string, string>).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      if (response.data.access_token) { return response.data.access_token; }
    } catch (postErr: any) {
      this.logger.debug(
        `POST token exchange failed: ${postErr.response?.data?.error?.message || postErr.message}, retrying with GET`
      );
    }

    // GET fallback
    const getResponse = await axios.get<MetaTokenResponse>(
      `${this.metaApiBaseUrl}/oauth/access_token`,
      { params }
    ).catch((err: any) => {
      const msg = err.response?.data?.error?.message || err.message;
      throw new BadRequestException(`Failed to exchange code for token: ${msg}`);
    });

    if (!getResponse.data.access_token) {
      throw new BadRequestException('Failed to exchange code for token');
    }
    return getResponse.data.access_token;
  }


  /**
   * Processar código do Embedded Signup.
   * Troca o código por business token.
   * Usa redirect_uri do frontend (exato) se fornecido; senão META_EMBEDDED_SIGNUP_REDIRECT_URI.
   */
  async processEmbeddedSignup(
    code: string,
    tenantId: string,
    redirectUriFromFrontend?: string,
    wabaIdFromEvent?: string,
    phoneNumberIdFromEvent?: string
  ): Promise<{ success: boolean; connectionId: string; message: string }> {
    this.logger.log(
      `processEmbeddedSignup: waba_id=${wabaIdFromEvent ?? 'null'} phone_number_id=${phoneNumberIdFromEvent ?? 'null'}`
    );
    try {
      // Passo 1: Trocar código por business token
      const businessToken = await this.exchangeCodeForBusinessToken(code);

      // Passo 2: Tentar obter long-lived token
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
      const connections: WhatsAppConnection[] = [];
      let isFirst = true;

      if (wabaIdFromEvent && phoneNumberIdFromEvent) {
        // Caminho direto: usar waba_id e phone_number_id do evento WA_EMBEDDED_SIGNUP
        // Isso evita a necessidade de permissão business_management no token
        this.logger.log(
          `Using waba_id=${wabaIdFromEvent} and phone_number_id=${phoneNumberIdFromEvent} from postMessage event`
        );

        const phoneNumbers = await this.getPhoneNumbers(wabaIdFromEvent, longLivedToken);
        const phoneNumber = phoneNumbers.find((p) => p.id === phoneNumberIdFromEvent)
          || phoneNumbers[0];

        if (!phoneNumber) {
          throw new BadRequestException(
            'Phone number not found in WhatsApp Business Account.'
          );
        }

        const existing = await this.prisma.whatsAppConnection.findFirst({
          where: { tenantId, phoneNumber: phoneNumber.display_phone_number },
        });

        const connectionData = {
          phoneNumberId: phoneNumber.id,
          whatsappBusinessAccountId: wabaIdFromEvent,
          oauthAccessToken: encryptSensitiveData(longLivedToken, this.encryptionKey),
          oauthExpiresAt: expiresAt,
          oauthScopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
          authMethod: WhatsAppAuthMethod.OAUTH,
          status: WhatsAppConnectionStatus.CONNECTED,
          isActive: true,
          lastSyncAt: new Date(),
          lastError: null,
        };

        if (existing) {
          connections.push(
            await this.prisma.whatsAppConnection.update({
              where: { id: existing.id, tenantId },
              data: { ...connectionData, isDefault: !existing.isDefault },
            })
          );
        } else {
          connections.push(
            await this.prisma.whatsAppConnection.create({
              data: {
                ...connectionData,
                tenantId,
                name: `WhatsApp ${phoneNumber.display_phone_number}`,
                phoneNumber: phoneNumber.display_phone_number,
                isDefault: true,
              },
            })
          );
        }
      } else {
        // Caminho 2: descobrir WABAs via debug_token granular_scopes
        // É a forma correta para tokens Embedded Signup sem business_management
        let whatsappAccounts = await this.getWabasFromToken(longLivedToken);
        let resolvedBusinessId: string | undefined = undefined;

        if (whatsappAccounts.length === 0) {
          // Caminho 3: fallback via Business Manager (requer business_management)
          this.logger.warn(
            '/me/whatsapp_business_accounts returned empty, falling back to Business Manager path'
          );
          const businesses = await this.getBusinessManagers(longLivedToken);

          if (businesses.length === 0) {
            throw new BadRequestException(
              'No WhatsApp Business Accounts found. Please complete the Embedded Signup flow and ensure your account has a WhatsApp Business Account.'
            );
          }

          resolvedBusinessId = businesses[0].id;
          whatsappAccounts = await this.getWhatsAppBusinessAccounts(resolvedBusinessId, longLivedToken);
        }

        if (whatsappAccounts.length === 0) {
          throw new BadRequestException(
            'No WhatsApp Business Accounts found. Please complete the Embedded Signup flow.'
          );
        }

        for (const account of whatsappAccounts) {
          const phoneNumbers = await this.getPhoneNumbers(account.id, longLivedToken);

          for (const phoneNumber of phoneNumbers) {
            const existing = await this.prisma.whatsAppConnection.findFirst({
              where: { tenantId, phoneNumber: phoneNumber.display_phone_number },
            });

            const connectionData = {
              phoneNumberId: phoneNumber.id,
              whatsappBusinessAccountId: account.id,
              businessAccountId: resolvedBusinessId,
              oauthAccessToken: encryptSensitiveData(longLivedToken, this.encryptionKey),
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
              connections.push(
                await this.prisma.whatsAppConnection.update({
                  where: { id: existing.id, tenantId },
                  data: { ...connectionData, isDefault: isFirst && !existing.isDefault },
                })
              );
            } else {
              connections.push(
                await this.prisma.whatsAppConnection.create({
                  data: {
                    ...connectionData,
                    tenantId,
                    name: `WhatsApp ${phoneNumber.display_phone_number}`,
                    phoneNumber: phoneNumber.display_phone_number,
                    isDefault: isFirst,
                  },
                })
              );
            }

            isFirst = false;
          }
        }
      }

      if (connections.length === 0) {
        throw new BadRequestException(
          'No phone numbers found in WhatsApp Business Account.'
        );
      }

      // Configurar webhooks (não-fatal) — usar WABAs das conexões criadas
      const wabaIds = [...new Set(connections.map((c) => c.whatsappBusinessAccountId).filter(Boolean))];
      for (const wabaId of wabaIds) {
        try {
          await this.configureWebhook(wabaId!, longLivedToken);
        } catch (error: any) {
          this.logger.warn(
            `Failed to configure webhook for WABA ${wabaId}:`,
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
