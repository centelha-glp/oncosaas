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

describe('ClinicalNoteExtractionService', () => {
  let service: ClinicalNoteExtractionService;
  const mockClinicalNotes = {
    canCreateOrSignNoteType: jest.fn().mockReturnValue(true),
  };

  const mockPrisma = {
    clinicalNote: { findFirst: jest.fn() },
    clinicalNoteExtractionRun: { findFirst: jest.fn(), update: jest.fn() },
    clinicalNoteExtractionLedgerLine: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    clinicalExamRequest: { deleteMany: jest.fn() },
    tissSpsadtGuideItem: { deleteMany: jest.fn() },
    medication: { deleteMany: jest.fn() },
    comorbidity: { deleteMany: jest.fn() },
    patient: { update: jest.fn() },
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
