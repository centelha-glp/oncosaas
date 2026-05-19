import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ClinicalNoteExtractionRunStatus,
  ClinicalNoteStatus,
} from '@generated/prisma/client';
import { EvolutionStructuringService } from './evolution-structuring.service';
import type { AiClinicalEvolutionStructureResponse } from './clinical-note-extraction.types';
import { PrismaService } from '../prisma/prisma.service';

/** Apenas para `jest.spyOn` em métodos privados (evita inferência `never`). */
type EvolutionStructuringPrivateTestApi = {
  decryptClinicalNoteToMarkdown(encrypted: string): string;
  callAiStructure(args: {
    tenantId: string;
    patientId: string;
    clinicalNoteId: string;
    noteType: string;
    contentMarkdown: string;
  }): Promise<AiClinicalEvolutionStructureResponse>;
};

describe('EvolutionStructuringService', () => {
  let service: EvolutionStructuringService;
  const prisma = {
    clinicalNoteExtractionRun: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    clinicalNote: { findFirst: jest.fn() },
    patient: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const config = {
    get: jest.fn((k: string) => {
      if (k === 'ENCRYPTION_KEY') return 'test-encryption-key-32-chars-min!!';
      if (k === 'AI_SERVICE_URL') return 'http://localhost:8001';
      if (k === 'BACKEND_SERVICE_TOKEN') return 'test-token';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvolutionStructuringService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(EvolutionStructuringService);
  });

  it('marca run FAILED quando AI devolve degraded', async () => {
    prisma.clinicalNoteExtractionRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: ClinicalNoteExtractionRunStatus.PENDING,
      tenantId: 't1',
    });
    prisma.clinicalNote.findFirst.mockResolvedValue({
      id: 'note-1',
      status: ClinicalNoteStatus.SIGNED,
      noteType: 'MEDICAL',
      versions: [
        {
          versionNumber: 1,
          sectionsContentHash: 'hash1',
          sectionsPayloadEncrypted: 'enc',
        },
      ],
    });
    const spyApi = service as unknown as EvolutionStructuringPrivateTestApi;
    jest
      .spyOn(spyApi, 'decryptClinicalNoteToMarkdown')
      .mockReturnValue('# Evolução sintética');
    const degradedAi: AiClinicalEvolutionStructureResponse = {
      extraction_schema_version: '2026-05-15-v3',
      degraded: true,
      parse_ok: false,
      llm_available: true,
      rejection_report: [{ domain: 'llm', reason: 'JSON inválido' }],
      clinical_exam_requests: [],
      medications: [],
      comorbidities: [],
      patient_patch: {},
      journey_patch: {},
      diagnoses: [],
      treatments: [],
      navigation_step_updates: [],
      complementary_exams: [],
      observations: [],
      performance_status_history: [],
      clinical_prescription_lines: [],
      questionnaire_responses: [],
    };
    jest.spyOn(spyApi, 'callAiStructure').mockResolvedValue(degradedAi);
    prisma.clinicalNoteExtractionRun.update.mockResolvedValue({});

    await service.runFromJob({
      tenantId: 't1',
      patientId: 'p1',
      clinicalNoteId: 'note-1',
      signedByUserId: 'u1',
      latestVersionNumber: 1,
      sectionsContentHash: 'hash1',
    });

    expect(prisma.clinicalNoteExtractionRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1', tenantId: 't1' },
        data: expect.objectContaining({
          status: ClinicalNoteExtractionRunStatus.FAILED,
        }),
      })
    );
  });

  it('define AWAITING_REVIEW quando AI estrutura com sucesso', async () => {
    prisma.clinicalNoteExtractionRun.findFirst.mockResolvedValue({
      id: 'run-2',
      status: ClinicalNoteExtractionRunStatus.PENDING,
      tenantId: 't1',
    });
    prisma.clinicalNote.findFirst.mockResolvedValue({
      id: 'note-2',
      status: ClinicalNoteStatus.SIGNED,
      noteType: 'MEDICAL',
      versions: [
        {
          versionNumber: 1,
          sectionsContentHash: 'hash2',
          sectionsPayloadEncrypted: 'enc',
        },
      ],
    });
    const spyApi2 = service as unknown as EvolutionStructuringPrivateTestApi;
    jest
      .spyOn(spyApi2, 'decryptClinicalNoteToMarkdown')
      .mockReturnValue('Solicito hemograma.');
    const successAi: AiClinicalEvolutionStructureResponse = {
      extraction_schema_version: '2026-05-15-v3',
      degraded: false,
      parse_ok: true,
      llm_available: true,
      rejection_report: [],
      clinical_exam_requests: [{ display_name: 'Hemograma' }],
      medications: [],
      comorbidities: [],
      patient_patch: {},
      journey_patch: {},
      diagnoses: [],
      treatments: [],
      navigation_step_updates: [],
      complementary_exams: [],
      observations: [],
      performance_status_history: [],
      clinical_prescription_lines: [],
      questionnaire_responses: [],
    };
    jest.spyOn(spyApi2, 'callAiStructure').mockResolvedValue(successAi);
    prisma.clinicalNoteExtractionRun.update.mockResolvedValue({});

    await service.runFromJob({
      tenantId: 't1',
      patientId: 'p1',
      clinicalNoteId: 'note-2',
      signedByUserId: 'u1',
      latestVersionNumber: 1,
      sectionsContentHash: 'hash2',
    });

    expect(prisma.clinicalNoteExtractionRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ClinicalNoteExtractionRunStatus.AWAITING_REVIEW,
          proposedPayload: expect.any(Object),
          errorMessage: null,
        }),
      })
    );
  });
});
