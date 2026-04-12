import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChannelGatewayService } from './channel-gateway.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from '../gateways/messages.gateway';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import { AgentService } from '../agent/agent.service';
import { RedisService } from '../redis/redis.service';

const mockPrisma = {
  patient: { findFirst: jest.fn() },
  conversation: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  message: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  whatsAppConnection: { findFirst: jest.fn() },
};

const mockGateway = {
  emitNewMessage: jest.fn(),
  emitMessageSent: jest.fn(),
};

const mockWhatsApp = {
  send: jest.fn(),
};

const mockAgent = {
  processIncomingMessage: jest.fn(),
};

const mockRedis = {
  isConnected: jest.fn().mockReturnValue(false),
  get: jest.fn().mockResolvedValue(null),
  increment: jest.fn().mockResolvedValue(1),
};

const TENANT = 'tenant-uuid-1';
const PATIENT_ID = 'patient-uuid-1';

describe('ChannelGatewayService', () => {
  let service: ChannelGatewayService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelGatewayService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagesGateway, useValue: mockGateway },
        { provide: WhatsAppChannel, useValue: mockWhatsApp },
        { provide: AgentService, useValue: mockAgent },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ChannelGatewayService>(ChannelGatewayService);
  });

  describe('processIncomingMessage', () => {
    it('deve retornar null quando paciente nao encontrado pelo hash de telefone', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      const result = await service.processIncomingMessage(
        '+5511999999999',
        'Olá',
        'WHATSAPP',
        'ext-msg-1',
        new Date()
      );

      expect(result).toBeNull();
    });

    it('[A-06] com Redis ativo, incrementa contador ao não encontrar paciente', async () => {
      mockRedis.isConnected.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await service.processIncomingMessage(
        '+5511777777777',
        'Olá',
        'WHATSAPP',
        'ext-unknown-redis',
        new Date()
      );

      expect(mockRedis.increment).toHaveBeenCalled();
      mockRedis.isConnected.mockReturnValue(false);
      mockRedis.get.mockResolvedValue(null);
    });

    it('[A-06] deve retornar null sem consultar paciente quando anti-flood Redis ativo', async () => {
      mockRedis.isConnected.mockReturnValue(true);
      mockRedis.get.mockResolvedValue('48');

      const result = await service.processIncomingMessage(
        '+5511888888888',
        'Olá',
        'WHATSAPP',
        'ext-msg-flood',
        new Date()
      );

      expect(result).toBeNull();
      expect(mockPrisma.patient.findFirst).not.toHaveBeenCalled();
      mockRedis.isConnected.mockReturnValue(false);
      mockRedis.get.mockResolvedValue(null);
    });

    it('deve retornar null quando mensagem duplicada (mesmo externalMessageId)', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
      mockPrisma.message.findUnique.mockResolvedValue({ id: 'existing-msg' }); // duplicada
      mockPrisma.message.findFirst.mockResolvedValue({ id: 'existing-msg' });

      const result = await service.processIncomingMessage(
        '+5511999999999',
        'Olá',
        'WHATSAPP',
        'ext-msg-duplicate',
        new Date()
      );

      expect(result).toBeNull();
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
    });
  });

  describe('LGPD — campo phone nao exposto nos selects de patient ao persistir mensagem', () => {
    it('processIncomingMessage nao deve solicitar phone no select de patient ao criar mensagem', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID, tenantId: TENANT });
      mockPrisma.message.findUnique.mockResolvedValue(null); // sem duplicata
      mockPrisma.message.findFirst.mockResolvedValue(null);
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        patientId: PATIENT_ID,
        direction: 'INBOUND',
        type: 'TEXT',
        content: 'Olá',
        patient: { id: PATIENT_ID, name: 'Ana Silva' }, // sem phone
      });
      mockAgent.processIncomingMessage.mockResolvedValue(undefined);

      await service.processIncomingMessage(
        '+5511999999999',
        'Olá',
        'WHATSAPP',
        'ext-msg-1',
        new Date()
      );

      const createCall = mockPrisma.message.create.mock.calls[0]?.[0];
      if (createCall?.include?.patient?.select) {
        expect(createCall.include.patient.select).not.toHaveProperty('phone');
      }
    });
  });
});
