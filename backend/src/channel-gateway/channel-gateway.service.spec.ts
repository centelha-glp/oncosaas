import { Test, TestingModule } from '@nestjs/testing';
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
  ensureWhatsAppIntakePatient: jest.fn(),
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
    it('sem phone_number_id: não consulta WhatsAppConnection e retorna null se paciente inexistente', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      const result = await service.processIncomingMessage(
        '+5511999999999',
        'Olá',
        'WHATSAPP',
        'ext-no-pnid',
        new Date()
      );

      expect(result).toBeNull();
      expect(mockPrisma.whatsAppConnection.findFirst).not.toHaveBeenCalled();
      expect(mockAgent.ensureWhatsAppIntakePatient).not.toHaveBeenCalled();
    });

    it('com phone_number_id sem conexão ativa: retorna null e não chama intake', async () => {
      mockPrisma.whatsAppConnection.findFirst.mockResolvedValue(null);
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      const result = await service.processIncomingMessage(
        '+5511999999999',
        'Olá',
        'WHATSAPP',
        'ext-bad-pnid',
        new Date(),
        'TEXT',
        undefined,
        undefined,
        'meta-phone-number-id-invalido'
      );

      expect(result).toBeNull();
      expect(mockAgent.ensureWhatsAppIntakePatient).not.toHaveBeenCalled();
    });

    it('com phone_number_id e conexão: usa tenant da conexão e pode criar intake', async () => {
      mockPrisma.whatsAppConnection.findFirst.mockResolvedValue({
        tenantId: TENANT,
      });
      mockPrisma.patient.findFirst.mockResolvedValue(null);
      mockAgent.ensureWhatsAppIntakePatient.mockResolvedValue({
        id: PATIENT_ID,
        tenantId: TENANT,
      });
      mockPrisma.message.findUnique.mockResolvedValue(null);
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        patientId: PATIENT_ID,
        direction: 'INBOUND',
        type: 'TEXT',
        content: 'Olá',
        patient: { id: PATIENT_ID, name: 'X' },
      });
      mockAgent.processIncomingMessage.mockResolvedValue(undefined);

      const result = await service.processIncomingMessage(
        '+5511999999999',
        'Olá',
        'WHATSAPP',
        'ext-intake-1',
        new Date(),
        'TEXT',
        undefined,
        undefined,
        'pnid-123'
      );

      expect(mockPrisma.whatsAppConnection.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            phoneNumberId: 'pnid-123',
            isActive: true,
            status: 'CONNECTED',
          }),
        })
      );
      expect(mockAgent.ensureWhatsAppIntakePatient).toHaveBeenCalledWith(
        TENANT,
        '+5511999999999'
      );
      expect(result?.patient?.id).toBe(PATIENT_ID);
    });

    it('com phone_number_id e conexão: paciente já existente no tenant não chama intake', async () => {
      mockPrisma.whatsAppConnection.findFirst.mockResolvedValue({
        tenantId: TENANT,
      });
      mockPrisma.patient.findFirst.mockResolvedValue({
        id: PATIENT_ID,
        tenantId: TENANT,
      });
      mockPrisma.message.findUnique.mockResolvedValue(null);
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        patientId: PATIENT_ID,
        direction: 'INBOUND',
        type: 'TEXT',
        content: 'Oi',
        patient: { id: PATIENT_ID, name: 'Paciente' },
      });
      mockAgent.processIncomingMessage.mockResolvedValue(undefined);

      await service.processIncomingMessage(
        '+5511999999999',
        'Oi',
        'WHATSAPP',
        'ext-existing-pnid',
        new Date(),
        'TEXT',
        undefined,
        undefined,
        'pnid-existing-456'
      );

      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT,
          }),
        })
      );
      expect(mockAgent.ensureWhatsAppIntakePatient).not.toHaveBeenCalled();
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
