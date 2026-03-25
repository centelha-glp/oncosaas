import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChannelType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from '../gateways/messages.gateway';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import {
  hashPhoneNumber,
  normalizePhoneNumber,
} from '../common/utils/phone.util';
import { OutgoingMessage, SendResult } from './interfaces/channel.interface';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class ChannelGatewayService {
  private readonly logger = new Logger(ChannelGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesGateway: MessagesGateway,
    private readonly whatsAppChannel: WhatsAppChannel,
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService
  ) {}

  /**
   * Process an incoming message from any channel.
   * 1. Find patient by phone hash
   * 2. Get or create active conversation
   * 3. Save message to DB
   * 4. Emit WebSocket event
   * 5. Forward to agent service for processing
   */
  async processIncomingMessage(
    phone: string,
    content: string,
    channel: ChannelType,
    externalMessageId: string,
    timestamp: Date,
    type: 'TEXT' | 'AUDIO' | 'IMAGE' | 'DOCUMENT' = 'TEXT',
    mediaUrl?: string,
    audioDuration?: number
  ) {
    // 1. Find patient by phone hash
    const normalizedPhone = normalizePhoneNumber(phone);
    const phoneHash = hashPhoneNumber(phone);

    const patient = await this.prisma.patient.findFirst({
      where: { phoneHash },
    });

    if (!patient) {
      this.logger.warn(
        `No patient found for phone hash. Normalized: ${normalizedPhone.substring(0, 5)}***`
      );
      return null;
    }

    const tenantId = patient.tenantId;

    // Idempotency: skip already-processed messages (Meta may retry webhooks)
    const existingMessage = await this.prisma.message.findUnique({
      where: { whatsappMessageId: externalMessageId },
    });
    if (existingMessage) {
      this.logger.warn(
        `Duplicate webhook: message ${externalMessageId} already processed, skipping`
      );
      return null;
    }

    // 2. Get or create active conversation
    const conversation = await this.getOrCreateConversation(
      patient.id,
      tenantId,
      channel
    );

    // C3: Resolve Media ID → downloadable URL for audio/image/document messages.
    // The Meta webhook delivers an opaque Media ID; we must call the Graph API
    // to get the actual CDN URL before saving so the frontend can render it.
    let resolvedMediaUrl = mediaUrl;
    if (
      mediaUrl &&
      (type === 'AUDIO' || type === 'IMAGE' || type === 'DOCUMENT')
    ) {
      const url = await this.whatsAppChannel.resolveMediaUrl(
        mediaUrl,
        tenantId
      );
      if (url) {
        resolvedMediaUrl = url;
        this.logger.log(
          `Resolved media ID ${mediaUrl} → URL for ${type} message`
        );
      } else {
        this.logger.warn(
          `Could not resolve media ID ${mediaUrl} for ${type} message — storing ID as fallback`
        );
      }
    }

    // 3. Save message
    const message = await this.prisma.message.create({
      data: {
        tenantId,
        patientId: patient.id,
        conversationId: conversation.id,
        channel,
        whatsappMessageId: externalMessageId,
        whatsappTimestamp: timestamp,
        type,
        direction: 'INBOUND',
        content,
        audioUrl: resolvedMediaUrl,
        audioDuration,
      },
      include: {
        patient: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    // 4. Update conversation metadata
    await this.prisma.conversation.update({
      where: { id: conversation.id, tenantId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    // 5. Emit WebSocket event
    this.messagesGateway.emitNewMessage(tenantId, message);

    this.logger.log(
      `Incoming ${channel} message from patient ${patient.id} in conversation ${conversation.id}`
    );

    // 6. Forward to agent pipeline (fire-and-forget; only for text messages)
    // We must NOT await here — Meta requires a 200 OK within 5 seconds,
    // but the AI pipeline can take up to 30 seconds.
    if (type === 'TEXT') {
      setImmediate(() => {
        this.agentService
          .processIncomingMessage(
            patient.id,
            tenantId,
            conversation.id,
            content
          )
          .catch((err) =>
            this.logger.error(
              `Agent pipeline failed for conversation ${conversation.id}`,
              err
            )
          );
      });
    } else {
      this.logger.log(
        `Skipping agent pipeline for ${type} message (text-only supported)`
      );
    }

    return {
      message,
      conversation,
      patient,
      tenantId,
    };
  }

  /**
   * Send a message to a patient via the appropriate channel
   */
  async sendMessage(
    patientId: string,
    tenantId: string,
    content: string,
    channel: ChannelType = ChannelType.WHATSAPP,
    conversationId?: string,
    options?: {
      skipExternalSend?: boolean;
      structuredData?: unknown;
      alertTriggered?: boolean;
    }
  ): Promise<{ message: any; sendResult: SendResult }> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    if (!patient.phone?.trim()) {
      throw new BadRequestException(
        `Patient ${patientId} has no phone number; cannot send via ${channel}`
      );
    }

    const outgoing: OutgoingMessage = {
      to: normalizePhoneNumber(patient.phone),
      content,
      channel,
      tenantId,
    };

    const skipExternalSend = options?.skipExternalSend === true;

    // Send via appropriate channel (unless explicitly simulated)
    let sendResult: SendResult;
    if (skipExternalSend) {
      sendResult = {
        success: true,
        externalMessageId: `sim_out_${randomUUID()}`,
      };
      this.logger.debug(
        `Skipping external ${channel} send for simulated conversation (patient ${patientId})`
      );
    } else {
      switch (channel) {
        case ChannelType.WHATSAPP:
          sendResult = await this.whatsAppChannel.send(outgoing);
          break;
        default:
          sendResult = {
            success: false,
            error: `Channel ${channel} not yet implemented`,
          };
      }
    }

    // Save outbound message
    const message = await this.prisma.message.create({
      data: {
        tenantId,
        patientId,
        conversationId,
        channel,
        whatsappMessageId:
          sendResult.externalMessageId || `out_${randomUUID()}`,
        whatsappTimestamp: new Date(),
        type: 'TEXT',
        direction: 'OUTBOUND',
        content,
        processedBy: 'AGENT',
        structuredData: (options?.structuredData ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        alertTriggered: options?.alertTriggered ?? false,
      },
      include: {
        patient: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    // Update conversation
    if (conversationId) {
      await this.prisma.conversation.update({
        where: { id: conversationId, tenantId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
        },
      });
    }

    // Emit WebSocket event
    this.messagesGateway.emitMessageSent(tenantId, message);

    return { message, sendResult };
  }

  /**
   * Get or create an active conversation for a patient on a channel
   */
  private async getOrCreateConversation(
    patientId: string,
    tenantId: string,
    channel: ChannelType
  ) {
    // Look for an existing active conversation
    const existing = await this.prisma.conversation.findFirst({
      where: {
        patientId,
        tenantId,
        channel,
        status: { in: ['ACTIVE', 'WAITING'] },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    // Create new conversation
    return this.prisma.conversation.create({
      data: {
        tenantId,
        patientId,
        channel,
        status: 'ACTIVE',
        handledBy: 'AGENT',
        lastMessageAt: new Date(),
      },
    });
  }
}
