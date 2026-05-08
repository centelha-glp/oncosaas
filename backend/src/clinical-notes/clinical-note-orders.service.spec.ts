import { BadRequestException } from '@nestjs/common';
import { ClinicalNoteStatus, ClinicalNoteType, UserRole } from '@generated/prisma/client';
import { ClinicalNoteOrdersService } from './clinical-note-orders.service';
import { ClinicalNotesService } from './clinical-notes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClinicalNoteOrdersService', () => {
  let service: ClinicalNoteOrdersService;
  const mockPrisma = {
    clinicalNote: { findFirst: jest.fn() },
    clinicalNoteVersion: { findFirst: jest.fn() },
    clinicalExamRequest: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    clinicalPrescriptionLine: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
  const mockClinicalNotes = {
    canCreateOrSignNoteType: jest.fn(),
  };

  const actor = {
    id: 'user-1',
    role: UserRole.ONCOLOGIST,
    clinicalSubrole: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClinicalNoteOrdersService(
      mockPrisma as unknown as PrismaService,
      mockClinicalNotes as unknown as ClinicalNotesService
    );
  });

  describe('createExamRequest', () => {
    it('scopes note to patient and tenant', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: ClinicalNoteStatus.DRAFT,
        noteType: ClinicalNoteType.MEDICAL,
        patientId: 'pat-1',
      });
      mockPrisma.clinicalNoteVersion.findFirst.mockResolvedValue({
        versionNumber: 2,
      });
      mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
      mockPrisma.clinicalExamRequest.create.mockResolvedValue({
        id: 'ex-1',
        clinicalNoteVersionNumber: 2,
        displayName: 'Hemograma',
        code: null,
        loincCode: null,
        requestedBy: { id: actor.id, name: 'Dra.' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.createExamRequest(
        'pat-1',
        'note-1',
        'tenant-1',
        actor,
        { displayName: 'Hemograma' }
      );

      expect(mockPrisma.clinicalNote.findFirst).toHaveBeenCalledWith({
        where: { id: 'note-1', tenantId: 'tenant-1', patientId: 'pat-1' },
        select: expect.any(Object),
      });
    });

    it('allows when note is signed', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: ClinicalNoteStatus.SIGNED,
        noteType: ClinicalNoteType.MEDICAL,
        patientId: 'pat-1',
      });

      mockPrisma.clinicalNoteVersion.findFirst.mockResolvedValue({
        versionNumber: 2,
      });
      mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
      mockPrisma.clinicalExamRequest.create.mockResolvedValue({
        id: 'ex-1',
        clinicalNoteVersionNumber: 2,
        displayName: 'Hemograma',
        code: null,
        loincCode: null,
        requestedBy: { id: actor.id, name: 'Dra.' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.createExamRequest('pat-1', 'note-1', 'tenant-1', actor, {
          displayName: 'Hemograma',
        })
      ).resolves.toBeTruthy();
    });
  });

  describe('createPrescriptionLine', () => {
    it('rejects nursing evolution', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: ClinicalNoteStatus.DRAFT,
        noteType: ClinicalNoteType.NURSING,
        patientId: 'pat-1',
      });

      await expect(
        service.createPrescriptionLine(
          'pat-1',
          'note-1',
          'tenant-1',
          actor,
          { medicationName: 'X' }
        )
      ).rejects.toThrow(BadRequestException);
    });
  });
});
