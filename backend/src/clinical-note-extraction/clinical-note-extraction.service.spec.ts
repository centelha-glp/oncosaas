import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ClinicalNoteExtractionRunStatus,
  ClinicalNoteType,
  UserRole,
} from '@generated/prisma/client';
import { ClinicalNoteExtractionService } from './clinical-note-extraction.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalNotesService } from '../clinical-notes/clinical-notes.service';
import { EvolutionStructuringService } from './evolution-structuring.service';

describe('ClinicalNoteExtractionService', () => {
  let service: ClinicalNoteExtractionService;
  const mockClinicalNotes = {
    canCreateOrSignNoteType: jest.fn().mockReturnValue(true),
  };
  const mockStructuring = {
    applyApprovedExtraction: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrisma = {
    patient: { findFirst: jest.fn(), update: jest.fn() },
    clinicalNote: { findFirst: jest.fn() },
    clinicalNoteExtractionRun: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    clinicalNoteExtractionLedgerLine: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    clinicalExamRequest: { deleteMany: jest.fn() },
    tissSpsadtGuideItem: { deleteMany: jest.fn() },
    medication: { deleteMany: jest.fn() },
    comorbidity: { deleteMany: jest.fn() },
    internalNote: { deleteMany: jest.fn() },
    intervention: { deleteMany: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn(mockPrisma)
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalNoteExtractionService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('7') },
        },
        { provide: ClinicalNotesService, useValue: mockClinicalNotes },
        { provide: EvolutionStructuringService, useValue: mockStructuring },
      ],
    }).compile();
    service = module.get(ClinicalNoteExtractionService);
  });

  it('getExtractionStatus throws when note missing', async () => {
    mockPrisma.clinicalNote.findFirst.mockResolvedValue(null);
    await expect(
      service.getExtractionStatus('nid', 'tid')
    ).rejects.toThrow(NotFoundException);
  });

  it('getExtractionStatus returns PENDING when signed and no run', async () => {
    mockPrisma.clinicalNote.findFirst.mockResolvedValue({ status: 'SIGNED' });
    mockPrisma.clinicalNoteExtractionRun.findFirst.mockResolvedValue(null);
    const r = await service.getExtractionStatus('nid', 'tid');
    expect(r.status).toBe('PENDING');
    expect(r.runId).toBeNull();
  });

  it('undoExtraction forbids when canCreateOrSignNoteType false', async () => {
    mockPrisma.clinicalNote.findFirst.mockResolvedValue({
      id: 'n1',
      noteType: ClinicalNoteType.MEDICAL,
    });
    mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(false);
    await expect(
      service.undoExtraction('n1', 'tid', {
        id: 'u1',
        role: UserRole.NURSE,
        clinicalSubrole: null,
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it('undoExtraction applies ledger in transaction', async () => {
    const appliedAt = new Date();
    mockPrisma.clinicalNote.findFirst.mockResolvedValue({
      id: 'n1',
      noteType: ClinicalNoteType.MEDICAL,
    });
    mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
    mockPrisma.clinicalNoteExtractionRun.findFirst.mockResolvedValue({
      id: 'run1',
      tenantId: 'tid',
      status: ClinicalNoteExtractionRunStatus.APPLIED,
      appliedAt,
    });
    mockPrisma.clinicalNoteExtractionLedgerLine.findMany.mockResolvedValue([
      {
        operation: 'CREATE_INTERVENTION',
        entityId: 'int1',
        tenantId: 'tid',
      },
      {
        operation: 'CREATE_INTERNAL_NOTE',
        entityId: 'in1',
        tenantId: 'tid',
      },
      {
        operation: 'CREATE_CLINICAL_EXAM_REQUEST',
        entityId: 'ex1',
        tenantId: 'tid',
      },
    ]);

    await service.undoExtraction('n1', 'tid', {
      id: 'u1',
      role: UserRole.ONCOLOGIST,
      clinicalSubrole: null,
    });

    expect(mockPrisma.intervention.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.internalNote.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.tissSpsadtGuideItem.deleteMany).toHaveBeenCalledWith({
      where: { examRequestId: 'ex1', tenantId: 'tid' },
    });
    expect(mockPrisma.clinicalExamRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: 'ex1', tenantId: 'tid' },
    });
    expect(mockPrisma.clinicalNoteExtractionRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ClinicalNoteExtractionRunStatus.ROLLED_BACK,
        }),
      })
    );
  });

  it('getExtractionStatus exposes proposal summary when awaiting review', async () => {
    mockPrisma.clinicalNote.findFirst.mockResolvedValue({ status: 'SIGNED' });
    mockPrisma.clinicalNoteExtractionRun.findFirst.mockResolvedValue({
      id: 'run-await',
      status: ClinicalNoteExtractionRunStatus.AWAITING_REVIEW,
      appliedAt: null,
      rejectionReport: null,
      appliedPayloadHash: null,
      errorMessage: null,
      proposedPayload: {
        extraction_schema_version: '1',
        clinical_exam_requests: [],
        medications: [{ name: 'Med A' }],
      },
    });
    const r = await service.getExtractionStatus('nid', 'tid');
    expect(r.status).toBe('AWAITING_REVIEW');
    expect(r.canApprove).toBe(true);
    expect(r.proposalSummary?.medications).toBe(1);
  });

  it('approveExtraction calls structuring apply with tenant scope', async () => {
    mockPrisma.clinicalNote.findFirst.mockResolvedValue({
      noteType: ClinicalNoteType.MEDICAL,
    });
    mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
    mockPrisma.clinicalNoteExtractionRun.findFirst
      .mockResolvedValueOnce({
        id: 'run-await',
        status: ClinicalNoteExtractionRunStatus.AWAITING_REVIEW,
      })
      .mockResolvedValueOnce({
        id: 'run-await',
        status: ClinicalNoteExtractionRunStatus.APPLIED,
        appliedAt: new Date(),
        rejectionReport: null,
        appliedPayloadHash: 'abc',
        errorMessage: null,
        proposedPayload: null,
      });
    await service.approveExtraction('n1', 'tid', {
      id: 'u1',
      role: UserRole.ONCOLOGIST,
      clinicalSubrole: null,
    });
    expect(mockStructuring.applyApprovedExtraction).toHaveBeenCalledWith(
      'run-await',
      'tid',
      'u1'
    );
  });

  it('rejectExtraction sets REJECTED without calling apply', async () => {
    mockPrisma.clinicalNote.findFirst.mockResolvedValue({
      noteType: ClinicalNoteType.MEDICAL,
    });
    mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
    mockPrisma.clinicalNoteExtractionRun.findFirst
      .mockResolvedValueOnce({
        id: 'run-await',
        tenantId: 'tid',
        status: ClinicalNoteExtractionRunStatus.AWAITING_REVIEW,
      })
      .mockResolvedValueOnce({
        id: 'run-await',
        status: ClinicalNoteExtractionRunStatus.REJECTED,
        appliedAt: null,
        rejectionReport: null,
        appliedPayloadHash: null,
        errorMessage: 'Rejeitada pelo profissional.',
        proposedPayload: null,
      });
    await service.rejectExtraction('n1', 'tid', {
      id: 'u1',
      role: UserRole.ONCOLOGIST,
      clinicalSubrole: null,
    });
    expect(mockStructuring.applyApprovedExtraction).not.toHaveBeenCalled();
    expect(mockPrisma.clinicalNoteExtractionRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-await', tenantId: 'tid' },
        data: expect.objectContaining({
          status: ClinicalNoteExtractionRunStatus.REJECTED,
        }),
      })
    );
  });

  it('listPendingExtractions scopes by tenant and patient', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    mockPrisma.clinicalNoteExtractionRun.findMany.mockResolvedValue([
      {
        id: 'run1',
        clinicalNoteId: 'n1',
        latestVersionNumber: 1,
        sectionsContentHash: 'hash',
        createdAt: new Date('2026-05-18T12:00:00Z'),
        proposedPayload: {
          extraction_schema_version: '1',
          clinical_exam_requests: [{ display_name: 'TC' }],
        },
      },
    ]);
    const rows = await service.listPendingExtractions('p1', 'tenant-a');
    expect(mockPrisma.clinicalNoteExtractionRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          patientId: 'p1',
          status: ClinicalNoteExtractionRunStatus.AWAITING_REVIEW,
        },
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].proposalSummary.clinicalExamRequests).toBe(1);
  });

  it('undoExtraction removes medications and restores patient snapshot', async () => {
    const appliedAt = new Date();
    mockPrisma.clinicalNote.findFirst.mockResolvedValue({
      id: 'n1',
      noteType: ClinicalNoteType.MEDICAL,
    });
    mockClinicalNotes.canCreateOrSignNoteType.mockReturnValue(true);
    mockPrisma.clinicalNoteExtractionRun.findFirst.mockResolvedValue({
      id: 'run1',
      tenantId: 'tid',
      status: ClinicalNoteExtractionRunStatus.APPLIED,
      appliedAt,
    });
    mockPrisma.clinicalNoteExtractionLedgerLine.findMany.mockResolvedValue([
      {
        operation: 'CREATE_INTERVENTION',
        entityId: 'int1',
        tenantId: 'tid',
      },
      {
        operation: 'CREATE_INTERNAL_NOTE',
        entityId: 'in1',
        tenantId: 'tid',
      },
      {
        operation: 'CREATE_MEDICATION',
        entityId: 'med1',
        tenantId: 'tid',
      },
      {
        operation: 'UPDATE_PATIENT',
        entityId: 'patient-1',
        tenantId: 'tid',
        metadata: { previousValues: { occupation: null } },
      },
    ]);

    await service.undoExtraction('n1', 'tid', {
      id: 'u1',
      role: UserRole.ONCOLOGIST,
      clinicalSubrole: null,
    });

    expect(mockPrisma.medication.deleteMany).toHaveBeenCalledWith({
      where: { id: 'med1', tenantId: 'tid' },
    });
    expect(mockPrisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'patient-1', tenantId: 'tid' },
      data: { occupation: null },
    });
  });
});
