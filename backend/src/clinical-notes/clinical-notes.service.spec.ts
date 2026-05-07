import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ClinicalNoteStatus,
  ClinicalNoteType,
  ClinicalSubrole,
  UserRole,
} from '@generated/prisma/client';
import { ClinicalNotesService } from './clinical-notes.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CLINICAL_NOTE_CONTENT_MARKDOWN_MAX_LENGTH } from './clinical-notes.constants';

describe('ClinicalNotesService', () => {
  let service: ClinicalNotesService;

  const mockPrisma = {
    navigationStep: {
      findFirst: jest.fn(),
    },
    patient: {
      findFirst: jest.fn(),
    },
    clinicalNote: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalNotesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('x'.repeat(32)) },
        },
        { provide: AuditLogService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(ClinicalNotesService);
  });

  describe('normalizeAndValidateContentMarkdown', () => {
    it('accepts empty string', () => {
      expect(service.normalizeAndValidateContentMarkdown('')).toBe('');
    });

    it('rejects content exceeding max length', () => {
      const huge = 'x'.repeat(CLINICAL_NOTE_CONTENT_MARKDOWN_MAX_LENGTH + 1);
      expect(() => service.normalizeAndValidateContentMarkdown(huge)).toThrow(
        BadRequestException
      );
    });
  });

  describe('canCreateOrSignNoteType', () => {
    it('allows NURSE for NURSING', () => {
      expect(
        service.canCreateOrSignNoteType(UserRole.NURSE, null, ClinicalNoteType.NURSING)
      ).toBe(true);
    });

    it('allows COORDINATOR only with NURSING subrole for NURSING note', () => {
      expect(
        service.canCreateOrSignNoteType(
          UserRole.COORDINATOR,
          ClinicalSubrole.NURSING,
          ClinicalNoteType.NURSING
        )
      ).toBe(true);
      expect(
        service.canCreateOrSignNoteType(
          UserRole.COORDINATOR,
          null,
          ClinicalNoteType.NURSING
        )
      ).toBe(false);
    });

    it('allows ONCOLOGIST for MEDICAL', () => {
      expect(
        service.canCreateOrSignNoteType(
          UserRole.ONCOLOGIST,
          null,
          ClinicalNoteType.MEDICAL
        )
      ).toBe(true);
    });

    it('ADMIN exige clinicalSubrole alinhado ao tipo de nota', () => {
      expect(
        service.canCreateOrSignNoteType(
          UserRole.ADMIN,
          null,
          ClinicalNoteType.NURSING
        )
      ).toBe(false);
      expect(
        service.canCreateOrSignNoteType(
          UserRole.ADMIN,
          ClinicalSubrole.NURSING,
          ClinicalNoteType.NURSING
        )
      ).toBe(true);
      expect(
        service.canCreateOrSignNoteType(
          UserRole.ADMIN,
          ClinicalSubrole.NURSING,
          ClinicalNoteType.MEDICAL
        )
      ).toBe(false);
      expect(
        service.canCreateOrSignNoteType(
          UserRole.ADMIN,
          ClinicalSubrole.MEDICAL,
          ClinicalNoteType.MEDICAL
        )
      ).toBe(true);
    });
  });

  describe('validateNavigationStepForEvolution', () => {
    const patientId = 'patient-1';
    const tenantId = 'tenant-1';

    it('deve lançar NotFoundException quando navigationStep não existir para patient/tenant', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.validateNavigationStepForEvolution(
          'step-1',
          patientId,
          tenantId,
          ClinicalNoteType.MEDICAL
        )
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.navigationStep.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'step-1',
            tenantId,
            patientId,
          }),
        })
      );
    });

    it('deve lançar BadRequestException quando stepKey não corresponder ao tipo MEDICAL', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValueOnce({
        id: 'step-1',
        stepKey: 'navigation_consultation',
      });

      await expect(
        service.validateNavigationStepForEvolution(
          'step-1',
          patientId,
          tenantId,
          ClinicalNoteType.MEDICAL
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException quando stepKey não corresponder ao tipo NURSING', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValueOnce({
        id: 'step-1',
        stepKey: 'specialist_consultation',
      });

      await expect(
        service.validateNavigationStepForEvolution(
          'step-1',
          patientId,
          tenantId,
          ClinicalNoteType.NURSING
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('deve aceitar quando stepKey corresponder ao tipo MEDICAL', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValueOnce({
        id: 'step-1',
        stepKey: 'specialist_consultation',
      });

      await expect(
        service.validateNavigationStepForEvolution(
          'step-1',
          patientId,
          tenantId,
          ClinicalNoteType.MEDICAL
        )
      ).resolves.toBeUndefined();
    });

    it('deve aceitar quando stepKey corresponder ao tipo NURSING', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValueOnce({
        id: 'step-1',
        stepKey: 'navigation_consultation',
      });

      await expect(
        service.validateNavigationStepForEvolution(
          'step-1',
          patientId,
          tenantId,
          ClinicalNoteType.NURSING
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('toMutationResponse', () => {
    it('maps latest version', () => {
      const r = service.toMutationResponse({
        id: '1',
        patientId: 'p',
        status: ClinicalNoteStatus.DRAFT,
        noteType: ClinicalNoteType.NURSING,
        amendsClinicalNoteId: null,
        navigationStepId: 'ns-1',
        updatedAt: new Date(),
        versions: [{ versionNumber: 2, sectionsContentHash: 'abc' }],
      });
      expect(r.latestVersionNumber).toBe(2);
      expect(r.sectionsContentHash).toBe('abc');
      expect(r.navigationStepId).toBe('ns-1');
    });
  });

  describe('findAllForPatient', () => {
    const TENANT = 'tenant-1';
    const PATIENT = 'patient-1';
    const STEP = '11111111-1111-4111-8111-111111111111';

    beforeEach(() => {
      mockPrisma.patient.findFirst.mockReset();
      mockPrisma.clinicalNote.findMany.mockReset();
      mockPrisma.clinicalNote.count.mockReset();
    });

    it('deve lançar NotFoundException quando paciente não existir no tenant', async () => {
      mockPrisma.patient.findFirst.mockResolvedValueOnce(null);

      await expect(service.findAllForPatient(PATIENT, TENANT)).rejects.toThrow(
        NotFoundException
      );
      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
        where: { id: PATIENT, tenantId: TENANT },
        select: { id: true },
      });
    });

    it('deve listar notas sem navigationStepId quando filtro não é fornecido', async () => {
      mockPrisma.patient.findFirst.mockResolvedValueOnce({ id: PATIENT });
      mockPrisma.clinicalNote.findMany.mockResolvedValueOnce([]);
      mockPrisma.clinicalNote.count.mockResolvedValueOnce(0);

      await service.findAllForPatient(PATIENT, TENANT, 1, 20);

      expect(mockPrisma.clinicalNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT,
            patientId: PATIENT,
            status: { not: ClinicalNoteStatus.VOIDED },
          }),
        })
      );
      const callArg = (mockPrisma.clinicalNote.findMany as jest.Mock).mock.calls[0]?.[0];
      expect(callArg?.where).not.toHaveProperty('navigationStepId');
    });

    it('deve incluir navigationStepId no where quando filtro é fornecido', async () => {
      mockPrisma.patient.findFirst.mockResolvedValueOnce({ id: PATIENT });
      mockPrisma.clinicalNote.findMany.mockResolvedValueOnce([]);
      mockPrisma.clinicalNote.count.mockResolvedValueOnce(0);

      await service.findAllForPatient(PATIENT, TENANT, 1, 20, STEP);

      expect(mockPrisma.clinicalNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT,
            patientId: PATIENT,
            navigationStepId: STEP,
            status: { not: ClinicalNoteStatus.VOIDED },
          }),
        })
      );
      expect(mockPrisma.clinicalNote.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ navigationStepId: STEP }),
        })
      );
    });

    it('não deve vazar dados de outro tenant (patient.findFirst scoped)', async () => {
      mockPrisma.patient.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.findAllForPatient(PATIENT, 'other-tenant')
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PATIENT, tenantId: 'other-tenant' },
        })
      );
    });
  });
});
