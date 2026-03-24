import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceStatusService } from './performance-status.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  performanceStatusHistory: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  patient: {
    update: jest.fn(),
  },
};

describe('PerformanceStatusService', () => {
  let service: PerformanceStatusService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceStatusService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PerformanceStatusService>(PerformanceStatusService);
  });

  it('should create entry and sync latest ECOG on patient record', async () => {
    const created = { id: 'ps-1', ecogScore: 2 };
    mockPrisma.performanceStatusHistory.create.mockResolvedValue(created);
    mockPrisma.patient.update.mockResolvedValue({ id: 'patient-1' });

    const result = await service.create('patient-1', 'tenant-1', {
      ecogScore: 2,
      assessedBy: 'nurse-1',
    } as any);

    expect(result).toEqual(created);
    expect(mockPrisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'patient-1', tenantId: 'tenant-1' },
        data: { performanceStatus: 2 },
      }),
    );
  });

  it('should return null delta when there is insufficient history', async () => {
    mockPrisma.performanceStatusHistory.findMany.mockResolvedValue([{ ecogScore: 1 }]);

    const delta = await service.getDelta('patient-1', 'tenant-1');

    expect(delta).toBeNull();
  });

  it('should return positive delta when condition worsens', async () => {
    mockPrisma.performanceStatusHistory.findMany.mockResolvedValue([
      { ecogScore: 3 },
      { ecogScore: 1 },
    ]);

    const delta = await service.getDelta('patient-1', 'tenant-1');

    expect(delta).toBe(2);
  });
});
