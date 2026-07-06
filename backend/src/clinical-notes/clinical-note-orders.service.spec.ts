import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClinicalNoteStatus, ClinicalNoteType, UserRole } from '@generated/prisma/client';
import { ClinicalNoteOrdersService } from './clinical-note-orders.service';
import { ClinicalNotesService } from './clinical-notes.service';
import { MedicationCatalogService } from '../medication-catalog/medication-catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClinicalNoteOrdersService', () => {
  let service: ClinicalNoteOrdersService;
  const mockPrisma = {
    clinicalNote: { findFirst: jest.fn() },
    clinicalNoteVersion: { findFirst: jest.fn() },
    patient: { findFirst: jest.fn() },
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
      count: jest.fn(),
    },
  };
  const mockClinicalNotes = {
    canCreateOrSignNoteType: jest.fn(),
  };
  const mockMedicationCatalog = {
    findDrugByCode: jest.fn(),
    findPresentationByCode: jest.fn(),
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
      mockClinicalNotes as unknown as ClinicalNotesService,
      mockMedicationCatalog as unknown as MedicationCatalogService
    );
  });

  describe('createExamRequest', () => {
    it('rejects when note belongs to another tenant or patient', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue(null);

      await expect(
        service.createExamRequest('pat-1', 'note-1', 'tenant-1', actor, {
          displayName: 'Hemograma',
        })
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.clinicalExamRequest.create).not.toHaveBeenCalled();
    });

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
        examCatalogCode: null,
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
      expect(mockPrisma.clinicalExamRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            patientId: 'pat-1',
            clinicalNoteId: 'note-1',
          }),
        })
      );
    });

    it.each([ClinicalNoteStatus.SIGNED, ClinicalNoteStatus.VOIDED])(
      'rejects changes when note is %s',
      async (status) => {
        mockPrisma.clinicalNote.findFirst.mockResolvedValue({
          id: 'note-1',
          status,
          noteType: ClinicalNoteType.MEDICAL,
          patientId: 'pat-1',
        });

        await expect(
          service.createExamRequest('pat-1', 'note-1', 'tenant-1', actor, {
            displayName: 'Hemograma',
          })
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.clinicalExamRequest.create).not.toHaveBeenCalled();
      }
    );
  });

  describe('deleteExamRequest', () => {
    it('rejects when note belongs to another tenant or patient', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteExamRequest(
          'pat-1',
          'note-1',
          'exam-request-1',
          'tenant-1',
          actor
        )
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.clinicalExamRequest.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.clinicalExamRequest.delete).not.toHaveBeenCalled();
    });

    it('scopes ownership lookup and delete by tenant', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: ClinicalNoteStatus.DRAFT,
        noteType: ClinicalNoteType.MEDICAL,
        patientId: 'pat-1',
      });
      mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
      mockPrisma.clinicalExamRequest.findFirst.mockResolvedValue({
        id: 'exam-request-1',
      });
      mockPrisma.clinicalExamRequest.delete.mockResolvedValue({
        id: 'exam-request-1',
      });

      await service.deleteExamRequest(
        'pat-1',
        'note-1',
        'exam-request-1',
        'tenant-1',
        actor
      );

      expect(mockPrisma.clinicalExamRequest.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'exam-request-1',
          tenantId: 'tenant-1',
          clinicalNoteId: 'note-1',
          patientId: 'pat-1',
        },
        select: { id: true },
      });
      expect(mockPrisma.clinicalExamRequest.delete).toHaveBeenCalledWith({
        where: { id: 'exam-request-1', tenantId: 'tenant-1' },
      });
    });

    it.each([ClinicalNoteStatus.SIGNED, ClinicalNoteStatus.VOIDED])(
      'rejects deleting exam request when note is %s',
      async (status) => {
        mockPrisma.clinicalNote.findFirst.mockResolvedValue({
          id: 'note-1',
          status,
          noteType: ClinicalNoteType.MEDICAL,
          patientId: 'pat-1',
        });

        await expect(
          service.deleteExamRequest(
            'pat-1',
            'note-1',
            'exam-request-1',
            'tenant-1',
            actor
          )
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.clinicalExamRequest.delete).not.toHaveBeenCalled();
      }
    );
  });

  describe('createPrescriptionLine', () => {
    it('rejects create when note belongs to another tenant or patient', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue(null);

      await expect(
        service.createPrescriptionLine(
          'pat-1',
          'note-1',
          'tenant-1',
          actor,
          { medicationName: 'Ondansetrona' }
        )
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.clinicalPrescriptionLine.create).not.toHaveBeenCalled();
    });

    it('scopes create payload to tenant, patient, and note', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: ClinicalNoteStatus.DRAFT,
        noteType: ClinicalNoteType.MEDICAL,
        patientId: 'pat-1',
      });
      mockPrisma.clinicalNoteVersion.findFirst.mockResolvedValue({
        versionNumber: 3,
      });
      mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
      mockPrisma.clinicalPrescriptionLine.create.mockResolvedValue({
        id: 'line-1',
        clinicalNoteVersionNumber: 3,
        medicationName: 'Ondansetrona',
        catalogKey: null,
        presentationCatalogCode: null,
        dosage: null,
        frequency: null,
        route: null,
        duration: null,
        indication: null,
        prescribedBy: { id: actor.id, name: 'Dra.' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.createPrescriptionLine(
        'pat-1',
        'note-1',
        'tenant-1',
        actor,
        { medicationName: 'Ondansetrona' }
      );

      expect(mockPrisma.clinicalPrescriptionLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            patientId: 'pat-1',
            clinicalNoteId: 'note-1',
            clinicalNoteVersionNumber: 3,
            prescribedById: actor.id,
          }),
        })
      );
    });

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

    it('rejects route not allowed for catalog drug', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: ClinicalNoteStatus.DRAFT,
        noteType: ClinicalNoteType.MEDICAL,
        patientId: 'pat-1',
      });
      mockPrisma.clinicalNoteVersion.findFirst.mockResolvedValue({
        versionNumber: 1,
      });
      mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
      mockMedicationCatalog.findDrugByCode.mockResolvedValue({
        code: 'WARFARIN',
        displayName: 'Varfarina',
        allowedRoutes: ['VO'],
      });

      await expect(
        service.createPrescriptionLine('pat-1', 'note-1', 'tenant-1', actor, {
          medicationName: 'x',
          catalogKey: 'WARFARIN',
          route: 'IV',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it.each([ClinicalNoteStatus.SIGNED, ClinicalNoteStatus.VOIDED])(
      'rejects creating prescription line when note is %s',
      async (status) => {
        mockPrisma.clinicalNote.findFirst.mockResolvedValue({
          id: 'note-1',
          status,
          noteType: ClinicalNoteType.MEDICAL,
          patientId: 'pat-1',
        });

        await expect(
          service.createPrescriptionLine(
            'pat-1',
            'note-1',
            'tenant-1',
            actor,
            { medicationName: 'Ondansetrona' }
          )
        ).rejects.toThrow(BadRequestException);
        expect(
          mockPrisma.clinicalPrescriptionLine.create
        ).not.toHaveBeenCalled();
      }
    );

    it('rejects delete when note belongs to another tenant or patient', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePrescriptionLine(
          'pat-1',
          'note-1',
          'line-1',
          'tenant-1',
          actor
        )
      ).rejects.toThrow(NotFoundException);
      expect(
        mockPrisma.clinicalPrescriptionLine.findFirst
      ).not.toHaveBeenCalled();
      expect(mockPrisma.clinicalPrescriptionLine.delete).not.toHaveBeenCalled();
    });

    it('scopes prescription delete ownership and tenant where', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: ClinicalNoteStatus.DRAFT,
        noteType: ClinicalNoteType.MEDICAL,
        patientId: 'pat-1',
      });
      mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
      mockPrisma.clinicalPrescriptionLine.findFirst.mockResolvedValue({
        id: 'line-1',
      });
      mockPrisma.clinicalPrescriptionLine.delete.mockResolvedValue({
        id: 'line-1',
      });

      await service.deletePrescriptionLine(
        'pat-1',
        'note-1',
        'line-1',
        'tenant-1',
        actor
      );

      expect(mockPrisma.clinicalPrescriptionLine.findFirst).toHaveBeenCalledWith(
        {
          where: {
            id: 'line-1',
            tenantId: 'tenant-1',
            clinicalNoteId: 'note-1',
            patientId: 'pat-1',
          },
          select: { id: true },
        }
      );
      expect(mockPrisma.clinicalPrescriptionLine.delete).toHaveBeenCalledWith({
        where: { id: 'line-1', tenantId: 'tenant-1' },
      });
    });

    it.each([ClinicalNoteStatus.SIGNED, ClinicalNoteStatus.VOIDED])(
      'rejects deleting prescription line when note is %s',
      async (status) => {
        mockPrisma.clinicalNote.findFirst.mockResolvedValue({
          id: 'note-1',
          status,
          noteType: ClinicalNoteType.MEDICAL,
          patientId: 'pat-1',
        });

        await expect(
          service.deletePrescriptionLine(
            'pat-1',
            'note-1',
            'line-1',
            'tenant-1',
            actor
          )
        ).rejects.toThrow(BadRequestException);
        expect(
          mockPrisma.clinicalPrescriptionLine.delete
        ).not.toHaveBeenCalled();
      }
    );
  });

  describe('listPrescriptionHistory', () => {
    it('scopes by tenant and patient', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: 'pat-1' });
      mockPrisma.clinicalPrescriptionLine.findMany.mockResolvedValue([]);
      mockPrisma.clinicalPrescriptionLine.count.mockResolvedValue(0);

      await service.listPrescriptionHistory('pat-1', 'tenant-1', {
        limit: 10,
        offset: 0,
      });

      expect(mockPrisma.clinicalPrescriptionLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            patientId: 'pat-1',
            clinicalNote: { status: { not: ClinicalNoteStatus.VOIDED } },
          }),
        })
      );
    });
  });
});
