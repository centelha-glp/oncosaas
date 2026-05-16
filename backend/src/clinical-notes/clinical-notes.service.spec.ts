import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ClinicalNoteStatus,
  ClinicalNoteType,
  ClinicalSubrole,
  UserRole,
} from '@generated/prisma/client';
import { ClinicalNotesService } from './clinical-notes.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { OncologyNavigationService } from '../oncology-navigation/oncology-navigation.service';
import { CLINICAL_NOTE_EXTRACTION_QUEUE } from '../clinical-note-extraction/clinical-note-extraction.constants';

describe('ClinicalNotesService', () => {
  let service: ClinicalNotesService;

  const mockOncologyNavigation = {
    bootstrapProntuarioEvolutionNavigationStep: jest.fn(),
    markConsultationNavigationStepCompletedFromSignedEvolution: jest.fn(),
  };

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
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    clinicalNoteExtractionRun: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };

  const mockAudit = { log: jest.fn() };

  const mockExtractionQueue = {
    add: jest.fn().mockResolvedValue(undefined),
  };

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
        {
          provide: OncologyNavigationService,
          useValue: mockOncologyNavigation,
        },
        {
          provide: getQueueToken(CLINICAL_NOTE_EXTRACTION_QUEUE),
          useValue: mockExtractionQueue,
        },
      ],
    }).compile();

    service = module.get(ClinicalNotesService);
  });

  describe('normalizeAndValidateContentMarkdown', () => {
    it('accepts empty string', () => {
      expect(service.normalizeAndValidateContentMarkdown('')).toBe('');
    });

    it('accepts conteúdo muito longo (sem limite artificial)', () => {
      const longContent = 'x'.repeat(450_000);
      expect(service.normalizeAndValidateContentMarkdown(longContent)).toBe(
        longContent
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

  describe('sign', () => {
    const tenantId = 'tenant-1';
    const noteId = '11111111-1111-4111-8111-111111111111';
    const stepId = '99999999-9999-4999-8999-999999999999';
    const actor = { id: 'user-n1', role: UserRole.NURSE, clinicalSubrole: null as null };

    const baseDraftNote = {
      id: noteId,
      patientId: 'p-1',
      tenantId,
      status: ClinicalNoteStatus.DRAFT,
      noteType: ClinicalNoteType.NURSING,
      navigationStepId: stepId,
      amendsClinicalNoteId: null,
      versions: [{ versionNumber: 1, sectionsContentHash: 'h1' }],
    };

    beforeEach(() => {
      mockOncologyNavigation.markConsultationNavigationStepCompletedFromSignedEvolution.mockReset();
    });

    it('após assinar com navigationStepId delega conclusão da etapa de consulta à oncology', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValueOnce(baseDraftNote);
      mockPrisma.clinicalNote.update.mockResolvedValueOnce({
        ...baseDraftNote,
        status: ClinicalNoteStatus.SIGNED,
        signedById: actor.id,
        signedAt: new Date(),
        versions: [{ versionNumber: 1, sectionsContentHash: 'h1' }],
      });

      await service.sign(noteId, tenantId, actor);

      expect(mockPrisma.clinicalNote.update).toHaveBeenCalled();
      expect(mockExtractionQueue.add).toHaveBeenCalled();
      expect(
        mockOncologyNavigation.markConsultationNavigationStepCompletedFromSignedEvolution
      ).toHaveBeenCalledWith(stepId, tenantId, actor.id);
    });

    it('persiste run FAILED quando enfileiramento BullMQ falha', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValueOnce(baseDraftNote);
      mockPrisma.clinicalNote.update.mockResolvedValueOnce({
        ...baseDraftNote,
        status: ClinicalNoteStatus.SIGNED,
        signedById: actor.id,
        signedAt: new Date(),
        versions: [{ versionNumber: 1, sectionsContentHash: 'h1' }],
      });
      mockExtractionQueue.add.mockRejectedValueOnce(new Error('redis unavailable'));

      await service.sign(noteId, tenantId, actor);

      expect(mockPrisma.clinicalNoteExtractionRun.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            clinicalNoteId_sectionsContentHash: {
              clinicalNoteId: noteId,
              sectionsContentHash: 'h1',
            },
          },
          create: expect.objectContaining({
            status: 'FAILED',
            errorMessage: expect.stringContaining('EXTRACTION_ENQUEUE_FAILED'),
          }),
        })
      );
    });

    it('não chama oncology quando a nota não tem navigationStepId', async () => {
      mockPrisma.clinicalNote.findFirst.mockResolvedValueOnce({
        ...baseDraftNote,
        navigationStepId: null,
      });
      mockPrisma.clinicalNote.update.mockResolvedValueOnce({
        ...baseDraftNote,
        status: ClinicalNoteStatus.SIGNED,
        navigationStepId: null,
        versions: [{ versionNumber: 1, sectionsContentHash: 'h1' }],
      });

      await service.sign(noteId, tenantId, actor);

      expect(mockExtractionQueue.add).toHaveBeenCalled();
      expect(
        mockOncologyNavigation.markConsultationNavigationStepCompletedFromSignedEvolution
      ).not.toHaveBeenCalled();
    });
  });

  describe('bootstrapEvolutionNavigationStep', () => {
    const patientId = '22222222-2222-4222-8222-222222222222';
    const tenantId = 'tenant-1';

    beforeEach(() => {
      mockOncologyNavigation.bootstrapProntuarioEvolutionNavigationStep.mockReset();
    });

    it('deve lançar ForbiddenException quando o papel não pode criar o tipo de nota', async () => {
      await expect(
        service.bootstrapEvolutionNavigationStep(
          patientId,
          tenantId,
          { id: 'u1', role: UserRole.NURSE, clinicalSubrole: null },
          ClinicalNoteType.MEDICAL
        )
      ).rejects.toThrow(ForbiddenException);
      expect(
        mockOncologyNavigation.bootstrapProntuarioEvolutionNavigationStep
      ).not.toHaveBeenCalled();
    });

    it('NURSE+NURSING delega oncology com navigation_consultation e devolve id', async () => {
      mockPrisma.patient.findFirst.mockResolvedValueOnce({ id: patientId });
      mockOncologyNavigation.bootstrapProntuarioEvolutionNavigationStep.mockResolvedValueOnce(
        { id: 'new-step' }
      );

      const r = await service.bootstrapEvolutionNavigationStep(
        patientId,
        tenantId,
        { id: 'n1', role: UserRole.NURSE, clinicalSubrole: null },
        ClinicalNoteType.NURSING
      );

      expect(r).toEqual({ id: 'new-step' });
      expect(
        mockOncologyNavigation.bootstrapProntuarioEvolutionNavigationStep
      ).toHaveBeenCalledWith(tenantId, patientId, 'n1', 'navigation_consultation');
    });

    it('DOCTOR+MEDICAL delega com specialist_consultation', async () => {
      mockPrisma.patient.findFirst.mockResolvedValueOnce({ id: patientId });
      mockOncologyNavigation.bootstrapProntuarioEvolutionNavigationStep.mockResolvedValueOnce(
        { id: 's1' }
      );

      await service.bootstrapEvolutionNavigationStep(
        patientId,
        tenantId,
        { id: 'd1', role: UserRole.DOCTOR, clinicalSubrole: null },
        ClinicalNoteType.MEDICAL
      );

      expect(
        mockOncologyNavigation.bootstrapProntuarioEvolutionNavigationStep
      ).toHaveBeenCalledWith(tenantId, patientId, 'd1', 'specialist_consultation');
    });

    it('propaga BadRequestException da oncology (elegibilidade do profissional à consulta)', async () => {
      mockPrisma.patient.findFirst.mockResolvedValueOnce({ id: patientId });
      mockOncologyNavigation.bootstrapProntuarioEvolutionNavigationStep.mockRejectedValueOnce(
        new BadRequestException(
          'Consulta especializada: selecione um médico (ou coordenador/administrador com subpapel médico)'
        )
      );

      await expect(
        service.bootstrapEvolutionNavigationStep(
          patientId,
          tenantId,
          { id: 'u1', role: UserRole.DOCTOR, clinicalSubrole: null },
          ClinicalNoteType.MEDICAL
        )
      ).rejects.toThrow(BadRequestException);
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
