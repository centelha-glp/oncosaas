import { NotFoundException } from '@nestjs/common';
import { MedicationCatalogService } from './medication-catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MedicationCatalogService', () => {
  let service: MedicationCatalogService;
  const mockPrisma = {
    medicationCatalogDrug: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    medicationCatalogPresentation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MedicationCatalogService(
      mockPrisma as unknown as PrismaService
    );
  });

  describe('searchEntries', () => {
    it('returns flat entries from presentations', async () => {
      mockPrisma.medicationCatalogPresentation.findMany.mockResolvedValue([
        {
          code: 'OMEPRAZOLE_20MG_CP',
          label: 'Omeprazol 20 mg',
          strength: '20 mg',
          form: 'comprimido',
          drug: {
            code: 'OMEPRAZOLE',
            displayName: 'Omeprazol',
            allowedRoutes: ['VO'],
          },
        },
      ]);
      mockPrisma.medicationCatalogDrug.findMany.mockResolvedValue([]);

      const result = await service.searchEntries({ q: 'ome', limit: 80 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].label).toContain('Omeprazol');
      expect(result.items[0].presentationCode).toBe('OMEPRAZOLE_20MG_CP');
    });
  });

  describe('search', () => {
    it('returns paginated drugs', async () => {
      mockPrisma.medicationCatalogDrug.findMany.mockResolvedValue([
        { code: 'WARFARIN', displayName: 'Varfarina' },
      ]);
      mockPrisma.medicationCatalogDrug.count.mockResolvedValue(1);

      const result = await service.search({ limit: 10, offset: 0 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('listPresentations', () => {
    it('throws when drug missing', async () => {
      mockPrisma.medicationCatalogDrug.findUnique.mockResolvedValue(null);

      await expect(
        service.listPresentations('UNKNOWN', { limit: 10 })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listRoutes', () => {
    it('returns canonical routes', () => {
      const { routes } = service.listRoutes();
      expect(routes.some((r) => r.code === 'VO')).toBe(true);
    });
  });
});
