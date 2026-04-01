import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InternalNotesService } from './internal-notes.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@generated/prisma/client';

describe('InternalNotesService', () => {
  const mockPrisma = {
    patient: { findFirst: jest.fn() },
    internalNote: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: InternalNotesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalNotesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(InternalNotesService);
  });

  it('should reject create when patient is outside tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(
      service.create({ patientId: 'p1', content: 'x' } as any, 'tenant-1', 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject update by non-author without admin privileges', async () => {
    mockPrisma.internalNote.findFirst.mockResolvedValue({ id: 'n1', authorId: 'author-1' });

    await expect(
      service.update('n1', 'tenant-1', { content: 'changed' } as any, 'other-user', UserRole.NURSE),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow ADMIN update and keep tenant-scoped write', async () => {
    mockPrisma.internalNote.findFirst.mockResolvedValue({ id: 'n1', authorId: 'author-1' });
    mockPrisma.internalNote.update.mockResolvedValue({ id: 'n1' });

    await service.update('n1', 'tenant-1', { content: 'changed' } as any, 'admin-1', UserRole.ADMIN);

    expect(mockPrisma.internalNote.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'n1', tenantId: 'tenant-1' } }),
    );
  });
});
