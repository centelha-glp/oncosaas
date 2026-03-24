import { Test, TestingModule } from '@nestjs/testing';
import { DecisionGateService } from './decision-gate.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentDecisionType } from '@prisma/client';
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
});
