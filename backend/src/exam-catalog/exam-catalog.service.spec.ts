import { Test, TestingModule } from '@nestjs/testing';
import { ExamCatalogService } from './exam-catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { ComplementaryExamType } from '@generated/prisma/client';

describe('ExamCatalogService', () => {
  let service: ExamCatalogService;
  const prismaMock = {
    examCatalogItem: {
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamCatalogService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(ExamCatalogService);
  });

  describe('search', () => {
    it('returns items and total', async () => {
      prismaMock.examCatalogItem.findMany.mockResolvedValue([
        {
          id: '1',
          code: '40301010',
          name: 'Hemograma',
          type: ComplementaryExamType.LABORATORY,
        },
      ]);
      prismaMock.examCatalogItem.count.mockResolvedValue(1);

      const result = await service.search({
        q: 'hema',
        type: ComplementaryExamType.LABORATORY,
        limit: 50,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(prismaMock.examCatalogItem.findMany).toHaveBeenCalled();
    });
  });

  describe('importBatch', () => {
    it('upserts each row', async () => {
      prismaMock.examCatalogItem.upsert.mockResolvedValue({});

      const out = await service.importBatch(
        [
          {
            code: '40301010',
            name: 'Hemograma',
            type: ComplementaryExamType.LABORATORY,
          },
        ],
        'ANS-2026-01',
      );

      expect(out.upserted).toBe(1);
      expect(prismaMock.examCatalogItem.upsert).toHaveBeenCalledTimes(1);
    });
  });
});
