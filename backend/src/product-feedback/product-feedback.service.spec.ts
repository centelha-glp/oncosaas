import { Test, TestingModule } from '@nestjs/testing';
import { ProductFeedbackService } from './product-feedback.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductFeedbackType } from '@generated/prisma/client';

const TENANT_A = 'tenant-a';
const USER_1 = 'user-uuid-1';

const createMockPrisma = (): {
  productFeedback: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
} => ({
  productFeedback: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

describe('ProductFeedbackService', () => {
  let service: ProductFeedbackService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductFeedbackService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductFeedbackService>(ProductFeedbackService);
  });

  describe('create', () => {
    it('deve persistir com tenantId e userId do contexto', async () => {
      const created = {
        id: 'fb-1',
        tenantId: TENANT_A,
        userId: USER_1,
        type: ProductFeedbackType.BUG,
        title: 'Erro',
        description: 'Descrição longa o suficiente',
        pageUrl: null,
        userAgent: 'jest',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.productFeedback.create.mockResolvedValue(created);

      const result = await service.create(
        {
          type: ProductFeedbackType.BUG,
          title: 'Erro',
          description: 'Descrição longa o suficiente',
        },
        TENANT_A,
        USER_1,
        'jest'
      );

      expect(mockPrisma.productFeedback.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT_A,
          userId: USER_1,
          type: ProductFeedbackType.BUG,
          title: 'Erro',
          description: 'Descrição longa o suficiente',
          pageUrl: null,
          userAgent: 'jest',
        },
      });
      expect(result).toEqual(created);
    });
  });

  describe('findAllForTenant', () => {
    it('deve filtrar apenas pelo tenantId', async () => {
      mockPrisma.productFeedback.findMany.mockResolvedValue([]);
      mockPrisma.productFeedback.count.mockResolvedValue(0);

      await service.findAllForTenant(TENANT_A, 1, 20);

      expect(mockPrisma.productFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A },
        })
      );
      expect(mockPrisma.productFeedback.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A },
      });
    });

    it('deve limitar take a no máximo 100', async () => {
      mockPrisma.productFeedback.findMany.mockResolvedValue([]);
      mockPrisma.productFeedback.count.mockResolvedValue(0);

      await service.findAllForTenant(TENANT_A, 1, 500);

      expect(mockPrisma.productFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });
  });
});
