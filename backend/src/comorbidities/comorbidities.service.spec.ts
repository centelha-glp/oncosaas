import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ComorbiditiesService } from './comorbidities.service';
import { PrismaService } from '../prisma/prisma.service';
import { ComorbidityType } from '@generated/prisma/client';

const mockPrisma = {
  comorbidity: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ComorbiditiesService', () => {
  let service: ComorbiditiesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComorbiditiesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ComorbiditiesService>(ComorbiditiesService);
  });

  it('should derive clinical risk flags when creating comorbidity', async () => {
    mockPrisma.comorbidity.create.mockResolvedValue({ id: 'com-1' });

    await service.create('patient-1', 'tenant-1', {
      name: 'CKD',
      type: ComorbidityType.CHRONIC_KIDNEY_DISEASE,
    } as any);

    expect(mockPrisma.comorbidity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'patient-1',
          tenantId: 'tenant-1',
          affectsRenalClearance: true,
          increasesSepsisRisk: true,
        }),
      }),
    );
  });

  it('should reject cross-tenant update access', async () => {
    mockPrisma.comorbidity.findFirst.mockResolvedValue(null);

    await expect(
      service.update('com-1', 'other-tenant', { name: 'x' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('should scope update and delete writes by tenant', async () => {
    mockPrisma.comorbidity.findFirst.mockResolvedValue({ id: 'com-1', tenantId: 'tenant-1' });
    mockPrisma.comorbidity.update.mockResolvedValue({ id: 'com-1' });
    mockPrisma.comorbidity.delete.mockResolvedValue({ id: 'com-1' });

    await service.update('com-1', 'tenant-1', { name: 'updated' } as any);
    await service.remove('com-1', 'tenant-1');

    expect(mockPrisma.comorbidity.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'com-1', tenantId: 'tenant-1' } }),
    );
    expect(mockPrisma.comorbidity.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'com-1', tenantId: 'tenant-1' } }),
    );
  });
});
