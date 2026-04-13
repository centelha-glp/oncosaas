import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  RawBodyRequest,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';
import { ChannelGatewayService } from './channel-gateway.service';
import { WhatsAppChannel } from './channels/whatsapp.channel';

@Controller('channel-gateway')
export class ChannelGatewayController {
  private readonly logger = new Logger(ChannelGatewayController.name);

  constructor(
    private readonly gatewayService: ChannelGatewayService,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly configService: ConfigService
  ) {}

  /**
   * WhatsApp webhook verification (GET)
   * Meta sends a GET request to verify the webhook URL
   */
  @Get('webhook/whatsapp')
  @Public()
  verifyWhatsAppWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response
  ) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const verifyToken = this.configService.get<string>(
      'WHATSAPP_WEBHOOK_VERIFY_TOKEN'
    );

    if (!verifyToken) {
      this.logger.error(
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN must be set in all environments'
      );
      return res.status(503).send('Service Unavailable');
    }

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('WhatsApp webhook verified successfully');
      return res.status(200).send(challenge);
    }

    this.logger.warn('WhatsApp webhook verification failed');
    return res.status(403).send('Forbidden');
  }

  /**
   * WhatsApp webhook receiver (POST)
   * Receives incoming messages from Meta
   */
  @Post('webhook/whatsapp')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWhatsAppWebhook(
    @Body() body: any,
    @Req() req: RawBodyRequest<Request>
  ) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const appSecret = this.configService.get<string>('META_APP_SECRET')?.trim();

    // [A-04] Header de assinatura sem secret configurado → não verificável; rejeitar.
    if (signature && !appSecret) {
      this.logger.warn(
        'WhatsApp webhook: x-hub-signature-256 present but META_APP_SECRET is not set',
      );
      throw new ForbiddenException(
        'Webhook signature verification not configured',
      );
    }

    if (isProduction) {
      if (!req.rawBody || !signature) {
        this.logger.warn('WhatsApp webhook: missing raw body or signature');
        throw new ForbiddenException('Webhook signature required');
      }
      if (
        !this.whatsAppChannel.validateWebhookSignature(req.rawBody, signature)
      ) {
        this.logger.warn('Invalid WhatsApp webhook signature');
        throw new ForbiddenException('Invalid signature');
      }
    } else if (appSecret) {
      // Non-production com META_APP_SECRET: mesma exigência de assinatura válida
      if (!req.rawBody || !signature) {
        this.logger.warn(
          'WhatsApp webhook (non-production): missing raw body or signature',
        );
        throw new ForbiddenException('Webhook signature required');
      }
      if (
        !this.whatsAppChannel.validateWebhookSignature(req.rawBody, signature)
      ) {
        this.logger.warn('Invalid WhatsApp webhook signature (non-production)');
        throw new ForbiddenException('Invalid signature');
      }
    }

    const messages = this.whatsAppChannel.parseWebhookPayload(body);

    if (messages.length === 0) {
      return { status: 'ok' };
    }

    setImmediate(() => {
      void (async () => {
        for (const msg of messages) {
          try {
            const result = await this.gatewayService.processIncomingMessage(
              msg.phone,
              msg.content,
              'WHATSAPP',
              msg.messageId,
              msg.timestamp,
              msg.type,
              msg.mediaUrl
            );

            if (!result) {
              this.logger.warn(
                `No patient found for phone from WhatsApp message`
              );
            }
          } catch (error) {
            this.logger.error(
              `Error processing WhatsApp message ${msg.messageId}`,
              error instanceof Error ? error.stack : error
            );
          }
        }
      })();
    });

    return { status: 'ok' };
  }
}
