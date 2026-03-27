import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClinicalProtocolsService } from './clinical-protocols.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClinicalProtocolsService', () => {
  const mockPrisma = {
    clinicalProtocol: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: ClinicalProtocolsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalProtocolsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(ClinicalProtocolsService);
  });

  it('should throw when active protocol is missing for tenant/cancer type', async () => {
    mockPrisma.clinicalProtocol.findFirst.mockResolvedValue(null);

    await expect(service.findActive('tenant-1', 'lung')).rejects.toThrow(NotFoundException);
  });

  it('should normalize cancer type to lowercase when creating', async () => {
    mockPrisma.clinicalProtocol.create.mockResolvedValue({ id: 'cp-1' });

    await service.create(
      {
        cancerType: 'LUNG',
        name: 'Lung protocol',
        definition: {},
        checkInRules: {},
        criticalSymptoms: {},
      } as any,
      'tenant-1',
    );

    expect(mockPrisma.clinicalProtocol.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cancerType: 'lung' }) }),
    );
  });

  it('should be idempotent when defaults already exist', async () => {
    mockPrisma.clinicalProtocol.findFirst.mockResolvedValue({ id: 'existing' });

    const results = await service.initializeDefaultProtocols('tenant-1');

    expect(results.length).toBeGreaterThan(0);
    expect(mockPrisma.clinicalProtocol.create).not.toHaveBeenCalled();
  });
});
