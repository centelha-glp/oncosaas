import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { Message } from '@prisma/client';
import { MessagesGateway } from '../gateways/messages.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesGateway: MessagesGateway
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

    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit && limit > 0 ? Math.min(limit, 200) : undefined,
      skip: offset && offset > 0 ? offset : undefined,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
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
            phone: true,
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

    const message = await this.prisma.message.create({
      data: {
        ...createMessageDto,
        tenantId, // SEMPRE incluir tenantId
        whatsappTimestamp: new Date(createMessageDto.whatsappTimestamp),
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    // Emitir evento WebSocket para notificar clientes conectados
    if (message.direction === 'INBOUND') {
      this.messagesGateway.emitNewMessage(tenantId, message);
    } else {
      this.messagesGateway.emitMessageSent(tenantId, message);
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
      where: { id },
      data: updateMessageDto,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
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
      where: { id },
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
            phone: true,
          },
        },
      },
    });

    // Emitir evento WebSocket para notificar que mensagem foi assumida
    this.messagesGateway.emitMessageUpdate(tenantId, updatedMessage);

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

    return this.prisma.message.findMany({
      where: {
        patientId,
        tenantId,
      },
      orderBy: { createdAt: 'asc' }, // Ordem cronológica para conversa
      take: limit,
    });
  }

  async getUnassumedCount(tenantId: string): Promise<number> {
    // Contar mensagens INBOUND não assumidas pela enfermagem
    return this.prisma.message.count({
      where: {
        tenantId,
        direction: 'INBOUND',
        assumedBy: null, // Não assumidas
      },
    });
  }
}
