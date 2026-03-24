import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PriorityRecalculationService } from './priority-recalculation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PriorityRecalculationService', () => {
  const mockPrisma = {
    patient: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn(),
  };

  let service: PriorityRecalculationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriorityRecalculationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(PriorityRecalculationService);
    mockConfig.get.mockReturnValue('http://ai');
  });

  it('should return false when patient is not found in tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    const ok = await service.recalculate('patient-1', 'tenant-1');

    expect(ok).toBe(false);
    expect(mockPrisma.patient.update).not.toHaveBeenCalled();
  });

  it('should return false when AI service returns non-OK status', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: 'patient-1',
      cancerType: 'lung',
      stage: 'II',
      performanceStatus: 1,
      birthDate: null,
      lastInteraction: null,
      questionnaireResponses: [],
      observations: [],
      treatments: [],
    });
    (global as any).fetch.mockResolvedValue({ ok: false, status: 503 });

    const ok = await service.recalculate('patient-1', 'tenant-1');

    expect(ok).toBe(false);
    expect(mockPrisma.patient.update).not.toHaveBeenCalled();
  });

  it('should persist mapped priority result with tenant-scoped update', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: 'patient-1',
      cancerType: 'lung',
      stage: 'II',
      performanceStatus: 1,
      birthDate: null,
      lastInteraction: null,
      questionnaireResponses: [],
      observations: [],
      treatments: [],
    });
    (global as any).fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ priority_score: 88.6, priority_category: 'high', reason: 'risk up' }),
    });
    mockPrisma.patient.update.mockResolvedValue({ id: 'patient-1' });

    const ok = await service.recalculate('patient-1', 'tenant-1');

    expect(ok).toBe(true);
    expect(mockPrisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'patient-1', tenantId: 'tenant-1' },
        data: expect.objectContaining({ priorityScore: 89, priorityCategory: 'HIGH' }),
      }),
    );
  });
});
