import { BadRequestException } from '@nestjs/common';
import { ClinicalNoteStatus, ClinicalNoteType, UserRole } from '@generated/prisma/client';
import { ClinicalNoteOrdersService } from './clinical-note-orders.service';
import { ClinicalNotesService } from './clinical-notes.service';
import { MedicationCatalogService } from '../medication-catalog/medication-catalog.service';
import { EvolutionStructuringService } from '../clinical-note-extraction/evolution-structuring.service';
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
      update: jest.fn(),
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
  const mockEvolutionStructuring = {
    previewOrdersFromMarkdown: jest.fn(),
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
      mockMedicationCatalog as unknown as MedicationCatalogService,
      mockEvolutionStructuring as unknown as EvolutionStructuringService
    );
  });

  describe('suggestOrdersFromEvolution', () => {
    it('rejects when note is not DRAFT', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: ClinicalNoteStatus.SIGNED,
        noteType: ClinicalNoteType.MEDICAL,
        patientId: 'pat-1',
      });

      await expect(
        service.suggestOrdersFromEvolution(
          'pat-1',
          'note-1',
          'tenant-1',
          actor,
          '# Evolução'
        )
      ).rejects.toThrow(BadRequestException);

      expect(mockEvolutionStructuring.previewOrdersFromMarkdown).not.toHaveBeenCalled();
    });

    it('calls ai preview for DRAFT note with tenant scope', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: ClinicalNoteStatus.DRAFT,
        noteType: ClinicalNoteType.MEDICAL,
        patientId: 'pat-1',
      });
      mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
      mockEvolutionStructuring.previewOrdersFromMarkdown.mockResolvedValue({
        clinical_exam_requests: [{ display_name: 'Hemograma' }],
        clinical_prescription_lines: [],
      });

      const result = await service.suggestOrdersFromEvolution(
        'pat-1',
        'note-1',
        'tenant-1',
        actor,
        '  # Evolução  '
      );

      expect(mockPrisma.clinicalNote.findFirst).toHaveBeenCalledWith({
        where: { id: 'note-1', tenantId: 'tenant-1', patientId: 'pat-1' },
        select: expect.any(Object),
      });
      expect(mockEvolutionStructuring.previewOrdersFromMarkdown).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        patientId: 'pat-1',
        clinicalNoteId: 'note-1',
        noteType: ClinicalNoteType.MEDICAL,
        contentMarkdown: '# Evolução',
      });
      expect(result.clinical_exam_requests).toHaveLength(1);
    });
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
          {
            medicationName: 'X',
            quantity: '1',
            dosage: 'cp',
            frequency: '1x/dia',
            route: 'VO',
            duration: '7 dias',
          }
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
          quantity: '1',
          dosage: 'comprimido',
          frequency: '12/12 h',
          route: 'IV',
          duration: '7 dias',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePrescriptionLine', () => {
    it('updates line with structured fields', async () => {
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
      mockPrisma.clinicalPrescriptionLine.findFirst.mockResolvedValue({
        id: 'line-1',
      });
      mockPrisma.clinicalPrescriptionLine.update.mockResolvedValue({
        id: 'line-1',
        clinicalNoteVersionNumber: 2,
        medicationName: 'Omeprazol',
        catalogKey: null,
        presentationCatalogCode: null,
        quantity: '1',
        dosage: 'comprimido',
        frequency: '1x/dia',
        route: 'VO',
        duration: '7 dias',
        indication: null,
        prescribedBy: { id: actor.id, name: 'Dr.' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updatePrescriptionLine(
        'pat-1',
        'note-1',
        'line-1',
        'tenant-1',
        actor,
        {
          medicationName: 'Omeprazol',
          quantity: '1',
          dosage: 'comprimido',
          frequency: '1x/dia',
          route: 'VO',
          duration: '7 dias',
        }
      );

      expect(result.observation).toBeNull();
      expect(result.quantity).toBe('1');
    });
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
