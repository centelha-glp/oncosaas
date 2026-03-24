import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from '../gateways/messages.gateway';
import { AgentService } from '../agent/agent.service';

describe('MessagesService', () => {
  const mockPrisma = {
    patient: { findFirst: jest.fn() },
    message: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockGateway = {
    emitNewMessage: jest.fn(),
    emitMessageSent: jest.fn(),
    emitMessageUpdate: jest.fn(),
  };

  const mockAgent = {
    processIncomingMessage: jest.fn(),
  };

  let service: MessagesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagesGateway, useValue: mockGateway },
        { provide: AgentService, useValue: mockAgent },
      ],
    }).compile();

    service = module.get(MessagesService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should reject create when patient does not belong to tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          patientId: 'patient-1',
          conversationId: 'conv-1',
          channel: 'WHATSAPP',
          whatsappMessageId: 'm1',
          whatsappTimestamp: new Date().toISOString(),
          type: 'TEXT',
          direction: 'INBOUND',
          content: 'hello',
        } as any,
        'tenant-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject provided conversationId that is not tenant/patient scoped', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
    mockPrisma.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          patientId: 'patient-1',
          conversationId: 'conv-missing',
          channel: 'WHATSAPP',
          whatsappMessageId: 'm1',
          whatsappTimestamp: new Date().toISOString(),
          type: 'TEXT',
          direction: 'INBOUND',
          content: 'hello',
        } as any,
        'tenant-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should emit inbound event and trigger agent pipeline for inbound text', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
    mockPrisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    mockPrisma.message.create.mockResolvedValue({
      id: 'msg-1',
      patientId: 'patient-1',
      direction: 'INBOUND',
      type: 'TEXT',
      content: 'hello',
      whatsappMessageId: 'sim_123',
    });
    mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-1' });
    mockAgent.processIncomingMessage.mockResolvedValue(undefined);

    await service.create(
      {
        patientId: 'patient-1',
        conversationId: 'conv-1',
        channel: 'WHATSAPP',
        whatsappMessageId: 'sim_123',
        whatsappTimestamp: new Date().toISOString(),
        type: 'TEXT',
        direction: 'INBOUND',
        content: 'hello',
      } as any,
      'tenant-1',
    );

    expect(mockGateway.emitNewMessage).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ id: 'msg-1' }),
    );

    jest.runAllTimers();

    expect(mockAgent.processIncomingMessage).toHaveBeenCalledWith(
      'patient-1',
      'tenant-1',
      'conv-1',
      'hello',
      { skipExternalSend: true },
    );
  });

  it('should return zero without writes when no unassumed inbound messages exist', async () => {
    mockPrisma.message.findMany.mockResolvedValueOnce([]);

    const result = await service.assumeAllForPatient('patient-1', 'tenant-1', 'user-1');

    expect(result).toEqual({ count: 0 });
    expect(mockPrisma.message.updateMany).not.toHaveBeenCalled();
  });
});
