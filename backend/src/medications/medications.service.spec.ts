import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MedicationsService } from './medications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MedicationCategory } from '@prisma/client';

const mockPrisma = {
  medication: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('MedicationsService', () => {
  let service: MedicationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MedicationsService>(MedicationsService);
  });

  it('should derive medication risk flags on create', async () => {
    mockPrisma.medication.create.mockResolvedValue({ id: 'med-1' });

    await service.create('patient-1', 'tenant-1', {
      name: 'Warfarin',
      category: MedicationCategory.ANTICOAGULANT,
    } as any);

    expect(mockPrisma.medication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'patient-1',
          tenantId: 'tenant-1',
          isAnticoagulant: true,
        }),
      }),
    );
  });

  it('should reject cross-tenant update access', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(null);

    await expect(
      service.update('med-1', 'other-tenant', { name: 'x' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('should scope update and delete writes by tenant', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue({ id: 'med-1', tenantId: 'tenant-1' });
    mockPrisma.medication.update.mockResolvedValue({ id: 'med-1' });
    mockPrisma.medication.delete.mockResolvedValue({ id: 'med-1' });

    await service.update('med-1', 'tenant-1', { notes: 'ok' } as any);
    await service.remove('med-1', 'tenant-1');

    expect(mockPrisma.medication.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'med-1', tenantId: 'tenant-1' } }),
    );
    expect(mockPrisma.medication.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'med-1', tenantId: 'tenant-1' } }),
    );
  });
});
