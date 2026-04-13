import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelType } from '@generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IChannel,
  OutgoingMessage,
  SendResult,
} from '../interfaces/channel.interface';
import { decryptSensitiveData } from '../../whatsapp-connections/utils/encryption.util';

@Injectable()
export class WhatsAppChannel implements IChannel {
  readonly channelType = ChannelType.WHATSAPP;
  private readonly logger = new Logger(WhatsAppChannel.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async send(message: OutgoingMessage): Promise<SendResult> {
    try {
      // Find active WhatsApp connection for the tenant
      const connection = await this.getDefaultConnection(message.tenantId);

      if (!connection) {
        return {
          success: false,
          error: 'No active WhatsApp connection found',
        };
      }

      // B3: Check if OAuth token is expired before using it
      if (
        connection.oauthExpiresAt &&
        new Date() >= connection.oauthExpiresAt
      ) {
        this.logger.error(
          `WhatsApp OAuth token for tenant ${message.tenantId} expired at ${connection.oauthExpiresAt.toISOString()}. ` +
            'Reconnect the WhatsApp connection via the integrations page.'
        );
        return {
          success: false,
          error:
            'WhatsApp OAuth token has expired. Please reconnect the integration.',
        };
      }

      const accessToken = this.getAccessToken(connection);
      if (!accessToken) {
        return {
          success: false,
          error: 'No access token configured for WhatsApp connection',
        };
      }

      const apiVersion =
        this.configService.get<string>('META_API_VERSION') || 'v18.0';
      const url = `https://graph.facebook.com/${apiVersion}/${connection.phoneNumberId}/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: message.to,
          type: 'text',
          text: { body: message.content },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `WhatsApp API error: ${response.status} ${errorBody}`
        );
        return {
          success: false,
          error: `WhatsApp API returned ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        externalMessageId: data.messages?.[0]?.id,
      };
    } catch (error) {
      this.logger.error('Failed to send WhatsApp message', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validates Meta webhook signature (X-Hub-Signature-256)
   */
  validateWebhookSignature(payload: Buffer, signature: string): boolean {
    const appSecret = this.configService.get<string>('META_APP_SECRET');
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    if (!appSecret) {
      if (isDevelopment) {
        this.logger.warn(
          'META_APP_SECRET not configured, skipping signature validation (development only)'
        );
        return true;
      }
      this.logger.error(
        'META_APP_SECRET not configured; rejecting webhook (staging/production)'
      );
      return false;
    }

    const expectedSignature =
      'sha256=' +
      crypto.createHmac('sha256', appSecret).update(payload).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Find default WhatsApp connection for a specific tenant (used for sending)
   */
  private async getDefaultConnection(tenantId: string) {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: {
        tenantId,
        isActive: true,
        isDefault: true,
        status: 'CONNECTED',
      },
    });

    if (!connection) {
      this.logger.warn(
        `No default active WhatsApp connection found for tenant ${tenantId}`
      );
    }

    return connection;
  }

  /**
   * Extract access token from connection (decrypting if needed)
   */
  private getAccessToken(connection: any): string | null {
    const configuredKey = this.configService.get<string>('ENCRYPTION_KEY');
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (!configuredKey) {
      this.logger.error(
        'ENCRYPTION_KEY not configured; cannot decrypt WhatsApp tokens'
      );
      return null;
    }

    const encryptionKey = configuredKey;

    if (connection.oauthAccessToken) {
      try {
        return decryptSensitiveData(connection.oauthAccessToken, encryptionKey);
      } catch {
        this.logger.error('Failed to decrypt OAuth access token');
        return null;
      }
    }

    if (connection.apiToken) {
      try {
        return decryptSensitiveData(connection.apiToken, encryptionKey);
      } catch {
        this.logger.error('Failed to decrypt API token');
        return null;
      }
    }

    return null;
  }

  /**
   * C3: Resolve a WhatsApp Media ID to a downloadable URL.
   *
   * The Meta webhook delivers media as an opaque Media ID (e.g. "12345678").
   * To get the actual download URL, we must call:
   *   GET https://graph.facebook.com/{version}/{media-id}
   *
   * The returned URL is a short-lived (~5 min) CDN link. Returns null when the
   * connection or token is unavailable, or when the API call fails.
   */
  async resolveMediaUrl(
    mediaId: string,
    tenantId: string
  ): Promise<string | null> {
    try {
      const connection = await this.getDefaultConnection(tenantId);
      if (!connection) {
        return null;
      }

      const accessToken = this.getAccessToken(connection);
      if (!accessToken) {
        return null;
      }

      const apiVersion =
        this.configService.get<string>('META_API_VERSION') || 'v18.0';

      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${mediaId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        this.logger.warn(
          `Failed to resolve media ID ${mediaId}: HTTP ${response.status}`
        );
        return null;
      }

      const data: any = await response.json();
      return data.url ?? null;
    } catch (error) {
      this.logger.error(`resolveMediaUrl failed for ID ${mediaId}`, error);
      return null;
    }
  }

  /**
   * Parse incoming Meta webhook payload into normalized messages
   */
  parseWebhookPayload(body: any): Array<{
    phone: string;
    content: string;
    messageId: string;
    timestamp: Date;
    type: 'TEXT' | 'AUDIO' | 'IMAGE' | 'DOCUMENT';
    mediaUrl?: string;
  }> {
    const messages: any[] = [];

    if (!body?.entry) {
      return messages;
    }

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') {
          continue;
        }

        const value = change.value;
        if (!value?.messages) {
          continue;
        }

        for (const msg of value.messages) {
          const parsed: any = {
            phone: msg.from,
            messageId: msg.id,
            timestamp: new Date(parseInt(msg.timestamp) * 1000),
            type: 'TEXT',
            content: '',
          };

          switch (msg.type) {
            case 'text':
              parsed.content = msg.text?.body || '';
              parsed.type = 'TEXT';
              break;
            case 'audio':
              parsed.type = 'AUDIO';
              parsed.mediaUrl = msg.audio?.id;
              parsed.content = '[Áudio recebido]';
              break;
            case 'image':
              parsed.type = 'IMAGE';
              parsed.mediaUrl = msg.image?.id;
              parsed.content = msg.image?.caption || '[Imagem recebida]';
              break;
            case 'document':
              parsed.type = 'DOCUMENT';
              parsed.mediaUrl = msg.document?.id;
              parsed.content = msg.document?.caption || '[Documento recebido]';
              break;
            default:
              parsed.content = `[Mensagem tipo ${msg.type}]`;
          }

          messages.push(parsed);
        }
      }
    }

    return messages;
  }
}
