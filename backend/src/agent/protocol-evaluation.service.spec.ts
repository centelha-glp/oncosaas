import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProtocolEvaluationService } from './protocol-evaluation.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalProtocolsService } from '../clinical-protocols/clinical-protocols.service';
import {
  ChannelType,
  JourneyStage,
  ScheduledActionStatus,
} from '@generated/prisma/client';

describe('ProtocolEvaluationService', () => {
  let service: ProtocolEvaluationService;
  const mockPrisma = {
    patient: { findFirst: jest.fn() },
    conversation: { findFirst: jest.fn() },
    clinicalProtocol: { findFirst: jest.fn() },
    questionnaireResponse: { findFirst: jest.fn() },
    scheduledAction: { findFirst: jest.fn(), create: jest.fn() },
  };
  const mockClinicalProtocols = {
    getCheckInRules: jest.fn(),
  };
  const mockConfig = {
    get: jest.fn((k: string) =>
      k === 'AI_SERVICE_URL' ? 'http://localhost:8001' : undefined,
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProtocolEvaluationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: ClinicalProtocolsService, useValue: mockClinicalProtocols },
      ],
    }).compile();

    service = module.get(ProtocolEvaluationService);
  });

  it('deve incluir tenantId nas queries Prisma do paciente e conversa', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await service.syncScheduledProtocolActions('pid-1', 'tenant-1');

    expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'pid-1',
          tenantId: 'tenant-1',
        }),
      }),
    );
  });

  it('deve criar QUESTIONNAIRE quando evaluate-protocol devolve START_QUESTIONNAIRE', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: 'pid-1',
      tenantId: 'tenant-1',
      cancerType: 'bladder',
      currentStage: JourneyStage.TREATMENT,
    });
    mockPrisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      channel: ChannelType.WHATSAPP,
      agentState: {},
    });
    mockPrisma.clinicalProtocol.findFirst.mockResolvedValue({
      checkInRules: {},
      criticalSymptoms: [],
      definition: {},
      cancerType: 'bladder',
    });
    mockClinicalProtocols.getCheckInRules.mockResolvedValue({
      TREATMENT: { frequency: 'daily', questionnaire: 'ESAS' },
    });
    mockPrisma.questionnaireResponse.findFirst.mockResolvedValue({
      completedAt: new Date('2020-01-01'),
    });
    mockPrisma.scheduledAction.findFirst.mockResolvedValue(null);
    mockPrisma.scheduledAction.create.mockResolvedValue({});

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        actions: [
          {
            type: 'START_QUESTIONNAIRE',
            questionnaire_type: 'ESAS',
          },
        ],
      }),
    });

    const result = await service.syncScheduledProtocolActions('pid-1', 'tenant-1');

    expect(result.questionnairesCreated).toBe(1);
    expect(mockPrisma.scheduledAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          patientId: 'pid-1',
          actionType: 'QUESTIONNAIRE',
        }),
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8001/api/v1/agent/evaluate-protocol',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"tenant_id":"tenant-1"'),
      }),
    );
  });

  it('não deve duplicar QUESTIONNAIRE pendente', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: 'pid-1',
      tenantId: 'tenant-1',
      cancerType: 'bladder',
      currentStage: JourneyStage.TREATMENT,
    });
    mockPrisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      channel: ChannelType.WHATSAPP,
      agentState: {},
    });
    mockPrisma.clinicalProtocol.findFirst.mockResolvedValue(null);
    mockClinicalProtocols.getCheckInRules.mockResolvedValue({
      TREATMENT: { frequency: 'weekly', questionnaire: 'ESAS' },
    });
    mockPrisma.questionnaireResponse.findFirst.mockResolvedValue(null);
    mockPrisma.scheduledAction.findFirst.mockResolvedValue({
      id: 'existing',
      status: ScheduledActionStatus.PENDING,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        actions: [{ type: 'START_QUESTIONNAIRE', questionnaire_type: 'ESAS' }],
      }),
    });

    const result = await service.syncScheduledProtocolActions('pid-1', 'tenant-1');

    expect(result.questionnairesCreated).toBe(0);
    expect(mockPrisma.scheduledAction.create).not.toHaveBeenCalled();
  });
});
