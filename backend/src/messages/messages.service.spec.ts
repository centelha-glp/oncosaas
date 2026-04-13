import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    sendAssistedReply: jest.fn(),
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

  describe('findAll', () => {
    it('deve usar take 100 por omissão e no máximo 200', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);

      await service.findAll('tenant-1');
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, skip: 0 })
      );

      await service.findAll('tenant-1', undefined, 9999);
      expect(mockPrisma.message.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 200 })
      );
    });
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


  // ── updateSuggestion ───────────────────────────────────────────────────────

  describe('updateSuggestion', () => {
    const TENANT = 'tenant-1';
    const MSG_ID = 'msg-uuid-1';
    const USER_ID = 'user-uuid-1';
    const SUGGESTED = 'Sugestão do agente IA';

    const basePendingMessage = {
      id: MSG_ID,
      tenantId: TENANT,
      patientId: 'patient-uuid-1',
      conversationId: 'conv-uuid-1',
      suggestedResponse: SUGGESTED,
      suggestionStatus: 'PENDING',
    };

    const buildUpdated = (status: string) => ({
      ...basePendingMessage,
      suggestionStatus: status,
      assumedBy: USER_ID,
      assumedAt: expect.any(Date),
      processedBy: 'NURSING',
      patient: { id: 'patient-uuid-1', name: 'Paciente Teste', phone: null },
    });

    it('ACCEPT: marca suggestionStatus=ACCEPTED e emite evento WebSocket', async () => {
      mockPrisma.message.findFirst.mockResolvedValue(basePendingMessage);
      const updated = buildUpdated('ACCEPTED');
      mockPrisma.message.update.mockResolvedValue(updated);
      mockAgent.sendAssistedReply.mockResolvedValue(undefined);

      const result = await service.updateSuggestion(
        MSG_ID,
        { action: 'ACCEPT' },
        TENANT,
        USER_ID,
      );

      expect(result.suggestionStatus).toBe('ACCEPTED');
      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: MSG_ID, tenantId: TENANT }),
          data: expect.objectContaining({ suggestionStatus: 'ACCEPTED' }),
        }),
      );
      expect(mockGateway.emitMessageUpdate).toHaveBeenCalledWith(TENANT, updated);
    });

    it('ACCEPT: dispara sendAssistedReply com o texto sugerido original', async () => {
      mockPrisma.message.findFirst.mockResolvedValue(basePendingMessage);
      mockPrisma.message.update.mockResolvedValue(buildUpdated('ACCEPTED'));
      mockAgent.sendAssistedReply.mockResolvedValue(undefined);

      await service.updateSuggestion(MSG_ID, { action: 'ACCEPT' }, TENANT, USER_ID);
      jest.runAllTimers();

      expect(mockAgent.sendAssistedReply).toHaveBeenCalledWith(
        basePendingMessage.patientId,
        TENANT,
        basePendingMessage.conversationId,
        SUGGESTED,
      );
    });

    it('REJECT: marca suggestionStatus=REJECTED e NÃO dispara sendAssistedReply', async () => {
      mockPrisma.message.findFirst.mockResolvedValue(basePendingMessage);
      mockPrisma.message.update.mockResolvedValue(buildUpdated('REJECTED'));

      await service.updateSuggestion(MSG_ID, { action: 'REJECT' }, TENANT, USER_ID);
      jest.runAllTimers();

      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ suggestionStatus: 'REJECTED' }),
        }),
      );
      expect(mockAgent.sendAssistedReply).not.toHaveBeenCalled();
    });

    it('EDIT: envia editedText e marca suggestionStatus=EDITED', async () => {
      mockPrisma.message.findFirst.mockResolvedValue(basePendingMessage);
      mockPrisma.message.update.mockResolvedValue(buildUpdated('EDITED'));
      mockAgent.sendAssistedReply.mockResolvedValue(undefined);

      await service.updateSuggestion(
        MSG_ID,
        { action: 'EDIT', editedText: 'Texto editado pela enfermeira' },
        TENANT,
        USER_ID,
      );
      jest.runAllTimers();

      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ suggestionStatus: 'EDITED' }),
        }),
      );
      expect(mockAgent.sendAssistedReply).toHaveBeenCalledWith(
        basePendingMessage.patientId,
        TENANT,
        basePendingMessage.conversationId,
        'Texto editado pela enfermeira',
      );
    });

    it('EDIT sem editedText lança BadRequestException', async () => {
      mockPrisma.message.findFirst.mockResolvedValue(basePendingMessage);

      await expect(
        service.updateSuggestion(MSG_ID, { action: 'EDIT', editedText: '   ' }, TENANT, USER_ID),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });

    it('lança BadRequestException ao reavaliar sugestão já processada', async () => {
      mockPrisma.message.findFirst.mockResolvedValue({
        ...basePendingMessage,
        suggestionStatus: 'ACCEPTED',
      });

      await expect(
        service.updateSuggestion(MSG_ID, { action: 'REJECT' }, TENANT, USER_ID),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });

    it('lança BadRequestException quando mensagem não tem suggestedResponse', async () => {
      mockPrisma.message.findFirst.mockResolvedValue({
        ...basePendingMessage,
        suggestedResponse: null,
      });

      await expect(
        service.updateSuggestion(MSG_ID, { action: 'ACCEPT' }, TENANT, USER_ID),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException para mensagem de outro tenant', async () => {
      mockPrisma.message.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSuggestion(MSG_ID, { action: 'ACCEPT' }, 'outro-tenant', USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.message.update).not.toHaveBeenCalled();
    });

    it('inclui tenantId no where do findFirst e do update', async () => {
      mockPrisma.message.findFirst.mockResolvedValue(basePendingMessage);
      mockPrisma.message.update.mockResolvedValue(buildUpdated('ACCEPTED'));

      await service.updateSuggestion(MSG_ID, { action: 'ACCEPT' }, TENANT, USER_ID);

      expect(mockPrisma.message.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
      );
      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
      );
    });
  });

  // ─── LGPD: phone nao exposto em respostas públicas ───────────────────────────

  describe('LGPD — campo phone nao exposto nos selects de patient', () => {
    it('findAll nao deve solicitar phone no select de patient', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);

      await service.findAll('tenant-1');

      for (const [args] of mockPrisma.message.findMany.mock.calls) {
        const patientSelect = args?.include?.patient?.select ?? {};
        expect(patientSelect).not.toHaveProperty('phone');
      }
    });

    it('assumeAllForPatient nao deve solicitar phone em nenhuma query ao paciente', async () => {
      mockPrisma.message.findMany
        .mockResolvedValueOnce([{ id: 'msg-1' }])
        .mockResolvedValueOnce([]); // segundo batch — loop termina

      mockPrisma.message.updateMany.mockResolvedValue({ count: 1 });

      await service.assumeAllForPatient('patient-1', 'tenant-1', 'user-1');

      for (const [args] of mockPrisma.message.findMany.mock.calls) {
        const patientSelect = args?.include?.patient?.select ?? {};
        expect(patientSelect).not.toHaveProperty('phone');
      }
    });
  });
});
