import { Test, TestingModule } from '@nestjs/testing';
import { ConversationService } from './conversation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ConversationService', () => {
  let service: ConversationService;

  const mockPrisma = {
    message: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
  });

  describe('getRecentHistory', () => {
    it('fetches last N messages by createdAt desc then returns oldest-first', async () => {
      const newest = {
        id: 'm3',
        content: 'c',
        direction: 'INBOUND',
        type: 'TEXT',
        processedBy: 'AGENT',
        createdAt: new Date('2026-05-03T12:00:00Z'),
        structuredData: null,
        criticalSymptomsDetected: null,
      };
      const mid = {
        ...newest,
        id: 'm2',
        content: 'b',
        createdAt: new Date('2026-05-02T12:00:00Z'),
      };
      const oldest = {
        ...newest,
        id: 'm1',
        content: 'a',
        createdAt: new Date('2026-05-01T12:00:00Z'),
      };
      mockPrisma.message.findMany.mockResolvedValue([newest, mid, oldest]);

      const result = await service.getRecentHistory('conv-1', 3);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: 'conv-1' },
          orderBy: { createdAt: 'desc' },
          take: 3,
        }),
      );
      expect(result.map((m: { id: string }) => m.id)).toEqual(['m1', 'm2', 'm3']);
    });

    it('caps take at 200', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      await service.getRecentHistory('conv-1', 500);
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });
  });
});
