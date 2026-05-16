import { Test, TestingModule } from '@nestjs/testing';
import { DecisionGateService } from './decision-gate.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentDecisionType } from '@generated/prisma/client';
import { AgentDecision } from './interfaces/agent-decision.interface';

describe('DecisionGateService', () => {
  const mockPrisma = {
    agentDecisionLog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: DecisionGateService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionGateService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(DecisionGateService);
  });

  it('should auto-approve known safe actions and require approval for unknown actions', () => {
    const result = service.evaluate([
      {
        decisionType: AgentDecisionType.RESPONSE_GENERATED,
        reasoning: 'safe',
        inputData: {},
        outputAction: { type: 'GREETING_RESPONSE' },
        requiresApproval: false,
      },
      {
        decisionType: AgentDecisionType.RESPONSE_GENERATED,
        reasoning: 'unknown',
        inputData: {},
        outputAction: { type: 'CUSTOM_UNMAPPED_ACTION' },
        requiresApproval: false,
      },
    ] as unknown as AgentDecision[]);

    expect(result.autoApproved).toHaveLength(1);
    expect(result.needsApproval).toHaveLength(1);
  });

  it('should reject approving a decision already approved', async () => {
    mockPrisma.agentDecisionLog.findFirst.mockResolvedValue({ id: 'd1', approvedBy: 'user-1' });

    await expect(service.approveDecision('d1', 'tenant-1', 'user-2')).rejects.toThrow(
      'already been approved',
    );
  });

  it('should update approval using tenant-scoped where clause', async () => {
    mockPrisma.agentDecisionLog.findFirst.mockResolvedValue({ id: 'd1', approvedBy: null });
    mockPrisma.agentDecisionLog.update.mockResolvedValue({ id: 'd1' });

    await service.approveDecision('d1', 'tenant-1', 'user-1');

    expect(mockPrisma.agentDecisionLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1', tenantId: 'tenant-1' } }),
    );
  });

  it('getPendingDecisions deve limitar take a no máximo 200', async () => {
    mockPrisma.agentDecisionLog.findMany.mockResolvedValue([]);

    await service.getPendingDecisions('tenant-1', 9999);

    expect(mockPrisma.agentDecisionLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    );
  });

  it('auto-aprova CREATE_CONSULTATION_APPOINTMENT quando payload passa no gate e requiresApproval false', () => {
    const result = service.evaluate([
      {
        decisionType: AgentDecisionType.RESPONSE_GENERATED,
        reasoning: 'agendar',
        inputData: {},
        outputAction: {
          type: 'CREATE_CONSULTATION_APPOINTMENT',
          payload: {
            scheduledProfessionalId: '550e8400-e29b-41d4-a716-446655440000',
            expectedDate: '2026-06-15T14:00:00.000Z',
            stepKey: 'navigation_consultation',
            stepName: 'Consulta de navegação',
            journeyStage: 'TREATMENT',
          },
        },
        requiresApproval: false,
      },
    ] as unknown as AgentDecision[]);

    expect(result.autoApproved).toHaveLength(1);
    expect(result.needsApproval).toHaveLength(0);
  });

  it('exige aprovação para CREATE_CONSULTATION_APPOINTMENT quando payload incompleto', () => {
    const result = service.evaluate([
      {
        decisionType: AgentDecisionType.RESPONSE_GENERATED,
        reasoning: 'agendar',
        inputData: {},
        outputAction: {
          type: 'CREATE_CONSULTATION_APPOINTMENT',
          payload: {
            stepKey: 'navigation_consultation',
            stepName: 'Consulta',
            journeyStage: 'TREATMENT',
          },
        },
        requiresApproval: false,
      },
    ] as unknown as AgentDecision[]);

    expect(result.needsApproval).toHaveLength(1);
    expect(result.autoApproved).toHaveLength(0);
  });

  it('exige aprovação para ações da secretária quando requiresApproval true', () => {
    const result = service.evaluate([
      {
        decisionType: AgentDecisionType.RESPONSE_GENERATED,
        reasoning: 'agendar',
        inputData: {},
        outputAction: {
          type: 'RESCHEDULE_CONSULTATION_APPOINTMENT',
          payload: {
            navigationStepId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            newExpectedDate: '2026-07-01T10:00:00.000Z',
          },
        },
        requiresApproval: true,
      },
    ] as unknown as AgentDecision[]);

    expect(result.needsApproval).toHaveLength(1);
    expect(result.autoApproved).toHaveLength(0);
  });

  it('auto-aprova CHECK_CONSULTATION_AVAILABILITY com payload válido', () => {
    const result = service.evaluate([
      {
        decisionType: AgentDecisionType.RESPONSE_GENERATED,
        reasoning: 'vagas',
        inputData: {},
        outputAction: {
          type: 'CHECK_CONSULTATION_AVAILABILITY',
          payload: {
            scheduledProfessionalId: '550e8400-e29b-41d4-a716-446655440000',
            stepKey: 'navigation_consultation',
            from: '2026-06-01T00:00:00.000Z',
            to: '2026-06-10T00:00:00.000Z',
          },
        },
        requiresApproval: false,
      },
    ] as unknown as AgentDecision[]);

    expect(result.autoApproved).toHaveLength(1);
    expect(result.needsApproval).toHaveLength(0);
  });

  it('auto-aprova CHECK_CONSULTATION_AVAILABILITY mesmo quando payload precisa fallback operacional', () => {
    const result = service.evaluate([
      {
        decisionType: AgentDecisionType.RESPONSE_GENERATED,
        reasoning: 'vagas',
        inputData: {},
        outputAction: {
          type: 'CHECK_CONSULTATION_AVAILABILITY',
          payload: {
            scheduledProfessionalId: '550e8400-e29b-41d4-a716-446655440000',
            stepKey: 'navigation_consultation',
            from: '2026-06-01T00:00:00.000Z',
            to: '2026-08-15T00:00:00.000Z',
          },
        },
        requiresApproval: false,
      },
    ] as unknown as AgentDecision[]);

    expect(result.autoApproved).toHaveLength(1);
    expect(result.needsApproval).toHaveLength(0);
    expect(result.autoApproved[0].requiresApproval).toBe(false);
  });

  it('auto-aprova CHECK_CONSULTATION_AVAILABILITY sem revisão humana mesmo com stepKey inválido', () => {
    const result = service.evaluate([
      {
        decisionType: AgentDecisionType.RESPONSE_GENERATED,
        reasoning: 'vagas',
        inputData: {},
        outputAction: {
          type: 'CHECK_CONSULTATION_AVAILABILITY',
          payload: {
            scheduledProfessionalId: '550e8400-e29b-41d4-a716-446655440000',
            stepKey: 'etapa_invalida',
            from: '2026-06-01T00:00:00.000Z',
            to: '2026-06-10T00:00:00.000Z',
          },
        },
        requiresApproval: false,
      },
    ] as unknown as AgentDecision[]);

    expect(result.autoApproved).toHaveLength(1);
    expect(result.needsApproval).toHaveLength(0);
  });

  it('auto-aprova SCHEDULING_INTAKE_PENDING como decisão informativa sem revisão humana', () => {
    const result = service.evaluate([
      {
        decisionType: 'SCHEDULING_INTAKE_PENDING',
        reasoning: 'faltam dados para consultar vagas',
        inputData: {},
        outputAction: {
          type: 'SCHEDULING_INTAKE_PENDING',
          payload: {
            tool_name: 'consultar_vagas_consulta',
            missing_fields: ['scheduledProfessionalId'],
          },
        },
        requiresApproval: false,
      },
    ] as unknown as AgentDecision[]);

    expect(result.autoApproved).toHaveLength(1);
    expect(result.needsApproval).toHaveLength(0);
  });
});
