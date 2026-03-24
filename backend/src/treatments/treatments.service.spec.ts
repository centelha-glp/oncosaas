import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TreatmentsService } from './treatments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';

describe('TreatmentsService', () => {
  const mockPrisma = {
    cancerDiagnosis: { findFirst: jest.fn() },
    treatment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: TreatmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TreatmentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(TreatmentsService);
  });

  it('should reject create when diagnosis is not found in tenant', async () => {
    mockPrisma.cancerDiagnosis.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          diagnosisId: 'diag-1',
          treatmentType: 'CHEMO',
        } as unknown as CreateTreatmentDto,
        'tenant-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create treatment using diagnosis patient and defaults', async () => {
    mockPrisma.cancerDiagnosis.findFirst.mockResolvedValue({
      id: 'diag-1',
      patientId: 'patient-1',
      patient: { id: 'patient-1' },
    });
    mockPrisma.treatment.create.mockResolvedValue({ id: 'treat-1' });

    await service.create(
      {
        diagnosisId: 'diag-1',
        treatmentType: 'CHEMO',
      } as unknown as CreateTreatmentDto,
      'tenant-1',
    );

    expect(mockPrisma.treatment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          patientId: 'patient-1',
          diagnosisId: 'diag-1',
          intent: 'CURATIVE',
          status: 'PLANNED',
          isActive: true,
        }),
      }),
    );
  });

  it('should scope update and delete writes by tenant', async () => {
    mockPrisma.treatment.findFirst.mockResolvedValue({ id: 't1' });
    mockPrisma.treatment.update.mockResolvedValue({ id: 't1' });
    mockPrisma.treatment.delete.mockResolvedValue({ id: 't1' });

    await service.update('t1', { status: 'ACTIVE' } as UpdateTreatmentDto, 'tenant-1');
    await service.remove('t1', 'tenant-1');

    expect(mockPrisma.treatment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1', tenantId: 'tenant-1' } }),
    );
    expect(mockPrisma.treatment.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1', tenantId: 'tenant-1' } }),
    );
  });
});
