import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ObservationsService } from './observations.service';
import { PrismaService } from '../prisma/prisma.service';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import { FHIRSyncService } from '../integrations/fhir/services/fhir-sync.service';
import { FHIRConfigService } from '../integrations/fhir/services/fhir-config.service';

describe('ObservationsService', () => {
  const mockPrisma = {
    patient: { findFirst: jest.fn() },
    message: { findFirst: jest.fn() },
    observation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockPriority = {
    triggerRecalculation: jest.fn(),
  };

  const mockFhirSync = {
    syncObservationToEHR: jest.fn(),
  };

  const mockFhirConfig = {
    isEnabled: jest.fn(),
    getConfig: jest.fn(),
  };

  let service: ObservationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObservationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PriorityRecalculationService, useValue: mockPriority },
        { provide: FHIRSyncService, useValue: mockFhirSync },
        { provide: FHIRConfigService, useValue: mockFhirConfig },
      ],
    }).compile();

    service = module.get(ObservationsService);
  });

  it('should reject create when patient does not belong to tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          patientId: 'patient-1',
          effectiveDateTime: new Date().toISOString(),
        } as any,
        'tenant-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject create when messageId does not match tenant/patient', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
    mockPrisma.message.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          patientId: 'patient-1',
          messageId: 'msg-1',
          effectiveDateTime: new Date().toISOString(),
        } as any,
        'tenant-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create observation and trigger priority recalculation', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
    mockPrisma.observation.create.mockResolvedValue({
      id: 'obs-1',
      patientId: 'patient-1',
    });
    mockFhirConfig.isEnabled.mockResolvedValue(false);

    const result = await service.create(
      {
        patientId: 'patient-1',
        effectiveDateTime: new Date().toISOString(),
      } as any,
      'tenant-1',
    );

    expect(result).toEqual(expect.objectContaining({ id: 'obs-1' }));
    expect(mockPriority.triggerRecalculation).toHaveBeenCalledWith('patient-1', 'tenant-1');
  });

  it('should scope markAsSynced update by tenant', async () => {
    mockPrisma.observation.findFirst.mockResolvedValue({ id: 'obs-1' });
    mockPrisma.observation.update.mockResolvedValue({ id: 'obs-1', syncedToEHR: true });

    await service.markAsSynced('obs-1', 'tenant-1', 'fhir-1');

    expect(mockPrisma.observation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'obs-1', tenantId: 'tenant-1' },
      }),
    );
  });
});
