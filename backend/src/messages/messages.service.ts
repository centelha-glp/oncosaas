import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { UpdateSuggestionDto } from './dto/update-suggestion.dto';
import { ChannelType, Message } from '@generated/prisma/client';
import { MessagesGateway } from '../gateways/messages.gateway';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesGateway: MessagesGateway,
    private readonly agentService: AgentService
  ) {}

  async findAll(
    tenantId: string,
    patientId?: string,
    limit?: number,
    offset?: number
  ): Promise<Message[]> {
    const where: any = { tenantId };
    if (patientId) {
      where.patientId = patientId;
    }

    // Paginação obrigatória: default 100, máx. 200 (performance / OOM)
    const take =
      limit && limit > 0 ? Math.min(limit, 200) : 100;
    const skip = offset && offset > 0 ? offset : 0;

    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take,
      skip,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Message> {
    const message = await this.prisma.message.findFirst({
      where: {
        id,
        tenantId, // SEMPRE incluir tenantId
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    return message;
  }

  async create(
    createMessageDto: CreateMessageDto,
    tenantId: string
  ): Promise<Message> {
    // Verificar se paciente existe e pertence ao tenant
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: createMessageDto.patientId,
        tenantId,
      },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient with ID ${createMessageDto.patientId} not found`
      );
    }

    const conversationId = await this.resolveConversationId(
      tenantId,
      createMessageDto.patientId,
      createMessageDto.conversationId
    );

    const message = await this.prisma.message.create({
      data: {
        ...createMessageDto,
        conversationId,
        tenantId, // SEMPRE incluir tenantId
        whatsappTimestamp: new Date(createMessageDto.whatsappTimestamp),
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Manter metadados da conversa atualizados para listas/ordenação
    await this.prisma.conversation.update({
      where: { id: conversationId, tenantId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    // Emitir evento WebSocket para notificar clientes conectados
    if (message.direction === 'INBOUND') {
      this.messagesGateway.emitNewMessage(tenantId, message);
    } else {
      this.messagesGateway.emitMessageSent(tenantId, message);
    }

    // Quando a mensagem chega como INBOUND (ex: /teste), disparar pipeline do agente.
    // Fire-and-forget para não bloquear a resposta HTTP.
    if (message.direction === 'INBOUND' && message.type === 'TEXT') {
      const isSimulatedMessage = message.whatsappMessageId.startsWith('sim_');

      setImmediate(() => {
        this.agentService
          .processIncomingMessage(
            message.patientId,
            tenantId,
            conversationId,
            message.content,
            { skipExternalSend: isSimulatedMessage }
          )
          .catch((error) =>
            this.logger.error(
              `Agent pipeline failed for conversation ${conversationId}`,
              error instanceof Error ? error.stack : String(error)
            )
          );
      });
    }

    return message;
  }

  async update(
    id: string,
    updateMessageDto: UpdateMessageDto,
    tenantId: string
  ): Promise<Message> {
    const existingMessage = await this.prisma.message.findFirst({
      where: { id, tenantId },
    });

    if (!existingMessage) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    const updatedMessage = await this.prisma.message.update({
      where: { id, tenantId },
      data: updateMessageDto,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Emitir evento WebSocket para notificar atualização
    this.messagesGateway.emitMessageUpdate(tenantId, updatedMessage);

    return updatedMessage;
  }

  async assumeConversation(
    id: string,
    tenantId: string,
    userId: string
  ): Promise<Message> {
    const message = await this.prisma.message.findFirst({
      where: { id, tenantId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    const updatedMessage = await this.prisma.message.update({
      where: { id, tenantId },
      data: {
        assumedBy: userId,
        assumedAt: new Date(),
        processedBy: 'NURSING', // Mudar para processamento manual
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Emitir evento WebSocket para notificar que mensagem foi assumida
    this.messagesGateway.emitMessageUpdate(tenantId, updatedMessage);

    return updatedMessage;
  }

  /**
   * Assumir todas as mensagens INBOUND não assumidas de um paciente.
   * Marca a conversa como lida quando o usuário abre a conversa.
   */
  async assumeAllForPatient(
    patientId: string,
    tenantId: string,
    userId: string
  ): Promise<{ count: number }> {
    const BATCH = 500;
    let totalCount = 0;
    const now = new Date();

    while (true) {
      const unassumedMessages = await this.prisma.message.findMany({
        where: {
          patientId,
          tenantId,
          direction: 'INBOUND',
          assumedBy: null,
        },
        select: { id: true },
        take: BATCH,
      });

      if (unassumedMessages.length === 0) {
        break;
      }

      await this.prisma.message.updateMany({
        where: {
          id: { in: unassumedMessages.map((m) => m.id) },
          tenantId,
        },
        data: {
          assumedBy: userId,
          assumedAt: now,
          processedBy: 'NURSING',
        },
      });

      const updatedMessages = await this.prisma.message.findMany({
        where: { id: { in: unassumedMessages.map((m) => m.id) }, tenantId },
        include: {
          patient: {
            select: { id: true, name: true },
          },
        },
      });
      for (const msg of updatedMessages) {
        this.messagesGateway.emitMessageUpdate(tenantId, msg);
      }

      totalCount += unassumedMessages.length;
      if (unassumedMessages.length < BATCH) {
        break;
      }
    }

    return { count: totalCount };
  }

  /**
   * Avaliar sugestão do agente IA em modo assistido.
   * ACCEPT → envia sem edição; EDIT → envia texto editado; REJECT → descarta.
   */
  async updateSuggestion(
    id: string,
    dto: UpdateSuggestionDto,
    tenantId: string,
    userId: string
  ): Promise<Message> {
    const message = await this.prisma.message.findFirst({
      where: { id, tenantId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    if (!message.suggestedResponse) {
      throw new BadRequestException(
        `Message ${id} has no pending suggestion`
      );
    }

    if (message.suggestionStatus && message.suggestionStatus !== 'PENDING') {
      throw new BadRequestException(
        `Suggestion for message ${id} has already been evaluated (status: ${message.suggestionStatus})`
      );
    }

    if (dto.action === 'EDIT' && !dto.editedText?.trim()) {
      throw new BadRequestException(
        'editedText is required when action is EDIT'
      );
    }

    const textToSend =
      dto.action === 'EDIT' ? dto.editedText! : message.suggestedResponse;

    const suggestionStatusMap = {
      ACCEPT: 'ACCEPTED',
      EDIT: 'EDITED',
      REJECT: 'REJECTED',
    } as const;

    const updatedMessage = await this.prisma.message.update({
      where: { id, tenantId },
      data: {
        suggestionStatus: suggestionStatusMap[dto.action],
        assumedBy: userId,
        assumedAt: new Date(),
        processedBy: 'NURSING',
      },
      include: {
        patient: {
          select: { id: true, name: true },
        },
      },
    });

    // Emitir evento WebSocket para atualizar o chat em tempo real
    this.messagesGateway.emitMessageUpdate(tenantId, updatedMessage);

    // Quando ACCEPT ou EDIT: enviar resposta ao paciente via agentService
    if (dto.action !== 'REJECT') {
      setImmediate(() => {
        this.agentService
          .sendAssistedReply(
            message.patientId,
            tenantId,
            message.conversationId ?? undefined,
            textToSend
          )
          .catch((error) =>
            this.logger.error(
              `Failed to send assisted reply for message ${id}`,
              error instanceof Error ? error.stack : String(error)
            )
          );
      });
    }

    return updatedMessage;
  }

  async getConversation(
    patientId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<Message[]> {
    // Verificar se paciente pertence ao tenant
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    const take = Math.min(Math.max(limit, 1), 200);

    return this.prisma.message.findMany({
      where: {
        patientId,
        tenantId,
      },
      orderBy: { createdAt: 'asc' }, // Ordem cronológica para conversa
      take,
    });
  }

  async getUnassumedCount(tenantId: string): Promise<number> {
    // Contar conversas (pacientes distintos) com mensagens INBOUND não assumidas
    const groups = await this.prisma.message.groupBy({
      by: ['patientId'],
      where: {
        tenantId,
        direction: 'INBOUND',
        assumedBy: null,
      },
    });
    return groups.length;
  }

  async getUnassumedPatientIds(tenantId: string): Promise<string[]> {
    const groups = await this.prisma.message.groupBy({
      by: ['patientId'],
      where: {
        tenantId,
        direction: 'INBOUND',
        assumedBy: null,
      },
    });
    return groups.map((g) => g.patientId);
  }

  private async resolveConversationId(
    tenantId: string,
    patientId: string,
    providedConversationId?: string
  ): Promise<string> {
    if (providedConversationId) {
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          id: providedConversationId,
          tenantId,
          patientId,
        },
      });

      if (!existingConversation) {
        throw new NotFoundException(
          `Conversation with ID ${providedConversationId} not found for patient ${patientId}`
        );
      }

      return existingConversation.id;
    }

    const activeConversation = await this.prisma.conversation.findFirst({
      where: {
        tenantId,
        patientId,
        channel: ChannelType.WHATSAPP,
        status: { in: ['ACTIVE', 'WAITING'] },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (activeConversation) {
      return activeConversation.id;
    }

    const createdConversation = await this.prisma.conversation.create({
      data: {
        tenantId,
        patientId,
        channel: ChannelType.WHATSAPP,
        status: 'ACTIVE',
        handledBy: 'AGENT',
        lastMessageAt: new Date(),
      },
    });

    return createdConversation.id;
  }
}
