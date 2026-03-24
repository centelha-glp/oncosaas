import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelType, ConversationStatus, HandledBy } from '@prisma/client';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create an active conversation for a patient
   */
  async getOrCreate(
    patientId: string,
    tenantId: string,
    channel: ChannelType = ChannelType.WHATSAPP
  ) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        patientId,
        tenantId,
        channel,
        status: { in: [ConversationStatus.ACTIVE, ConversationStatus.WAITING] },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.conversation.create({
      data: {
        tenantId,
        patientId,
        channel,
        status: ConversationStatus.ACTIVE,
        handledBy: HandledBy.AGENT,
        lastMessageAt: new Date(),
      },
    });
  }

  /**
   * Get conversation by ID with tenant isolation
   */
  async findOne(id: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            cancerType: true,
            currentStage: true,
            priorityCategory: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    return conversation;
  }

  /**
   * List conversations for a tenant
   */
  async findAll(
    tenantId: string,
    options?: {
      status?: ConversationStatus;
      channel?: ChannelType;
      patientId?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { tenantId };

    if (options?.status) {
      where.status = options.status;
    }
    if (options?.channel) {
      where.channel = options.channel;
    }
    if (options?.patientId) {
      where.patientId = options.patientId;
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              phone: true,
              cancerType: true,
              currentStage: true,
              priorityCategory: true,
            },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { conversations, total };
  }

  /**
   * Get recent message history for a conversation
   */
  async getRecentHistory(conversationId: string, limit: number = 20) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        content: true,
        direction: true,
        type: true,
        processedBy: true,
        createdAt: true,
        structuredData: true,
        criticalSymptomsDetected: true,
      },
    });
  }

  /**
   * Update conversation state (agent state, status, etc.)
   */
  async updateState(conversationId: string, agentState: Record<string, any>) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { tenantId: true },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.conversation.update({
      where: { id: conversationId, tenantId: conversation.tenantId },
      data: { agentState },
    });
  }

  /**
   * Escalate conversation to nursing
   */
  async escalateToNursing(
    conversationId: string,
    tenantId: string,
    userId?: string
  ) {
    const conversation = await this.findOne(conversationId, tenantId);

    return this.prisma.conversation.update({
      where: { id: conversation.id, tenantId },
      data: {
        handledBy: HandledBy.NURSING,
        status: ConversationStatus.ESCALATED,
        assumedByUserId: userId,
        assumedAt: userId ? new Date() : undefined,
      },
    });
  }

  /**
   * Return conversation to agent handling.
   * Clears assumed state on conversation and all messages so UI shows "Assumir" again.
   */
  async returnToAgent(conversationId: string, tenantId: string) {
    const conversation = await this.findOne(conversationId, tenantId);

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversation.id, tenantId },
        data: {
          handledBy: HandledBy.AGENT,
          status: ConversationStatus.ACTIVE,
          assumedByUserId: null,
          assumedAt: null,
        },
      }),
      this.prisma.message.updateMany({
        where: { conversationId: conversation.id, tenantId },
        data: { assumedBy: null, assumedAt: null },
      }),
    ]);

    return this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
    });
  }

  /**
   * Close a conversation
   */
  async close(conversationId: string, tenantId: string) {
    const conversation = await this.findOne(conversationId, tenantId);

    return this.prisma.conversation.update({
      where: { id: conversation.id, tenantId },
      data: { status: ConversationStatus.CLOSED },
    });
  }
}
