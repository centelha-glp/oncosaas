import { Test, TestingModule } from '@nestjs/testing';
import { EmergencyReferencesService } from './emergency-references.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  emergencyReference: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const TENANT = 'tenant-abc';

const baseRef = {
  id: 'ref-1',
  tenantId: TENANT,
  hospitalName: 'Hospital São Lucas',
  hospitalPhone: '+5511333333333',
  oncologyUnitPhone: '+5511444444444',
  emergencyAddress: 'Rua das Flores, 100',
};

describe('EmergencyReferencesService', () => {
  let service: EmergencyReferencesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyReferencesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EmergencyReferencesService>(EmergencyReferencesService);
  });

  // ─── findByTenant ────────────────────────────────────────────────────────────

  describe('findByTenant', () => {
    it('deve buscar a referência pelo tenantId', async () => {
      mockPrisma.emergencyReference.findUnique.mockResolvedValue(baseRef);

      const result = await service.findByTenant(TENANT);

      expect(result).toEqual(baseRef);
      expect(mockPrisma.emergencyReference.findUnique).toHaveBeenCalledWith({
        where: { tenantId: TENANT },
      });
    });

    it('deve retornar null quando não existe referência para o tenant', async () => {
      mockPrisma.emergencyReference.findUnique.mockResolvedValue(null);

      const result = await service.findByTenant(TENANT);

      expect(result).toBeNull();
    });
  });

  // ─── upsert ──────────────────────────────────────────────────────────────────

  describe('upsert', () => {
    const dto = {
      hospitalName: 'Hospital São Lucas',
      hospitalPhone: '+5511333333333',
    };

    it('deve criar referência quando não existe', async () => {
      mockPrisma.emergencyReference.upsert.mockResolvedValue({ ...baseRef, ...dto });

      await service.upsert(TENANT, dto);

      expect(mockPrisma.emergencyReference.upsert).toHaveBeenCalledWith({
        where: { tenantId: TENANT },
        create: { tenantId: TENANT, ...dto },
        update: { ...dto },
      });
    });

    it('deve atualizar referência existente', async () => {
      const updatedRef = { ...baseRef, hospitalName: 'Hospital Novo' };
      mockPrisma.emergencyReference.upsert.mockResolvedValue(updatedRef);

      const result = await service.upsert(TENANT, { hospitalName: 'Hospital Novo' });

      expect(result.hospitalName).toBe('Hospital Novo');
    });

    it('deve sempre incluir tenantId no create', async () => {
      mockPrisma.emergencyReference.upsert.mockResolvedValue(baseRef);

      await service.upsert(TENANT, dto);

      const call = mockPrisma.emergencyReference.upsert.mock.calls[0][0];
      expect(call.create.tenantId).toBe(TENANT);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deve remover referências do tenant via deleteMany', async () => {
      mockPrisma.emergencyReference.deleteMany.mockResolvedValue({ count: 1 });

      await service.remove(TENANT);

      expect(mockPrisma.emergencyReference.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT },
      });
    });

    it('deve não lançar erro quando não há referência para o tenant', async () => {
      mockPrisma.emergencyReference.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove(TENANT)).resolves.not.toThrow();
    });
  });
});
