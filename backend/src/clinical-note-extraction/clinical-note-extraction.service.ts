import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClinicalNoteExtractionRunStatus,
  ClinicalSubrole,
  Prisma,
  UserRole,
} from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalNotesService } from '../clinical-notes/clinical-notes.service';
import type { ClinicalNoteActor } from '../clinical-notes/clinical-notes.service';
import {
  LEDGER_OP_CREATE_CANCER_DIAGNOSIS,
  LEDGER_OP_CREATE_CLINICAL_EXAM_REQUEST,
  LEDGER_OP_CREATE_CLINICAL_PRESCRIPTION_LINE,
  LEDGER_OP_CREATE_COMPLEMENTARY_EXAM,
  LEDGER_OP_CREATE_COMORBIDITY,
  LEDGER_OP_CREATE_INTERVENTION,
  LEDGER_OP_CREATE_INTERNAL_NOTE,
  LEDGER_OP_CREATE_MEDICATION,
  LEDGER_OP_CREATE_OBSERVATION,
  LEDGER_OP_CREATE_PERFORMANCE_STATUS_HISTORY,
  LEDGER_OP_CREATE_QUESTIONNAIRE_RESPONSE,
  LEDGER_OP_CREATE_TREATMENT,
  LEDGER_OP_UPDATE_CANCER_DIAGNOSIS,
  LEDGER_OP_UPDATE_NAVIGATION_STEP,
  LEDGER_OP_UPDATE_PATIENT,
  LEDGER_OP_UPDATE_PATIENT_JOURNEY,
} from './clinical-note-extraction.constants';

export type ExtractionStatusDto = {
  runId: string | null;
  status:
    | 'NONE'
    | 'PENDING'
    | 'APPLIED'
    | 'FAILED'
    | 'ROLLED_BACK'
    | (string & {});
  appliedAt: string | null;
  canUndoUntil: string | null;
  undoWindowDays: number;
  rejectionReport: unknown;
  appliedPayloadHash: string | null;
  errorMessage: string | null;
};

@Injectable()
export class ClinicalNoteExtractionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly clinicalNotesService: ClinicalNotesService
  ) {}

  private undoWindowMs(): number {
    const days = Number(
      this.configService.get<string>('CLINICAL_NOTE_EXTRACTION_UNDO_DAYS') ??
        '7'
    );
    const safe = Number.isFinite(days) && days > 0 ? days : 7;
    return safe * 86_400_000;
  }

  async getExtractionStatus(
    clinicalNoteId: string,
    tenantId: string
  ): Promise<ExtractionStatusDto> {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id: clinicalNoteId, tenantId },
      select: { status: true },
    });
    if (!note) {
      throw new NotFoundException(`Clinical note ${clinicalNoteId} not found`);
    }

    const run = await this.prisma.clinicalNoteExtractionRun.findFirst({
      where: { clinicalNoteId, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const windowMs = this.undoWindowMs();
    const undoDays = Math.round(windowMs / 86_400_000);

    if (!run) {
      if (note.status === 'SIGNED') {
        return {
          runId: null,
          status: 'PENDING',
          appliedAt: null,
          canUndoUntil: null,
          undoWindowDays: undoDays,
          rejectionReport: null,
          appliedPayloadHash: null,
          errorMessage: null,
        };
      }
      return {
        runId: null,
        status: 'NONE',
        appliedAt: null,
        canUndoUntil: null,
        undoWindowDays: undoDays,
        rejectionReport: null,
        appliedPayloadHash: null,
        errorMessage: null,
      };
    }

    const appliedAt = run.appliedAt;
    const canUndoUntil =
      run.status === ClinicalNoteExtractionRunStatus.APPLIED && appliedAt
        ? new Date(appliedAt.getTime() + windowMs).toISOString()
        : null;

    return {
      runId: run.id,
      status: run.status,
      appliedAt: appliedAt ? appliedAt.toISOString() : null,
      canUndoUntil,
      undoWindowDays: undoDays,
      rejectionReport: run.rejectionReport ?? null,
      appliedPayloadHash: run.appliedPayloadHash,
      errorMessage: run.errorMessage,
    };
  }

  async undoExtraction(
    clinicalNoteId: string,
    tenantId: string,
    actor: ClinicalNoteActor
  ): Promise<{ ok: true }> {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id: clinicalNoteId, tenantId },
    });
    if (!note) {
      throw new NotFoundException(`Clinical note ${clinicalNoteId} not found`);
    }
    if (
      !this.clinicalNotesService.canCreateOrSignNoteType(
        actor.role as UserRole,
        actor.clinicalSubrole as ClinicalSubrole | null | undefined,
        note.noteType
      )
    ) {
      throw new ForbiddenException('Sem permissão para desfazer esta extração');
    }

    const run = await this.prisma.clinicalNoteExtractionRun.findFirst({
      where: {
        clinicalNoteId,
        tenantId,
        status: ClinicalNoteExtractionRunStatus.APPLIED,
        appliedAt: { not: null },
      },
      orderBy: { appliedAt: 'desc' },
    });

    if (!run || !run.appliedAt) {
      throw new BadRequestException('Não há extração aplicada para desfazer');
    }

    const deadline = run.appliedAt.getTime() + this.undoWindowMs();
    if (Date.now() > deadline) {
      throw new BadRequestException('Prazo para desfazer a extração expirou');
    }

    const lines = await this.prisma.clinicalNoteExtractionLedgerLine.findMany({
      where: { runId: run.id, tenantId },
      orderBy: { sequence: 'desc' },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        if (line.operation === LEDGER_OP_CREATE_CLINICAL_EXAM_REQUEST) {
          await tx.tissSpsadtGuideItem.deleteMany({
            where: { examRequestId: line.entityId, tenantId },
          });
          await tx.clinicalExamRequest.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_CREATE_MEDICATION) {
          await tx.medication.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_CREATE_COMORBIDITY) {
          await tx.comorbidity.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_UPDATE_PATIENT) {
          const meta = line.metadata as {
            previousValues?: Record<string, unknown>;
          } | null;
          const prev = meta?.previousValues;
          if (prev && typeof prev === 'object') {
            await tx.patient.update({
              where: { id: line.entityId, tenantId },
              data: prev as Prisma.PatientUpdateInput,
            });
          }
        } else if (line.operation === LEDGER_OP_UPDATE_PATIENT_JOURNEY) {
          const meta = line.metadata as {
            previousValues?: Record<string, unknown>;
          } | null;
          const prev = meta?.previousValues;
          if (prev && typeof prev === 'object') {
            await tx.patientJourney.update({
              where: { id: line.entityId, tenantId },
              data: prev as Prisma.PatientJourneyUpdateInput,
            });
          }
        } else if (line.operation === LEDGER_OP_UPDATE_CANCER_DIAGNOSIS) {
          const meta = line.metadata as {
            previousValues?: Record<string, unknown>;
          } | null;
          const prev = meta?.previousValues;
          if (prev && typeof prev === 'object') {
            await tx.cancerDiagnosis.update({
              where: { id: line.entityId, tenantId },
              data: prev as Prisma.CancerDiagnosisUpdateInput,
            });
          }
        } else if (line.operation === LEDGER_OP_UPDATE_NAVIGATION_STEP) {
          const meta = line.metadata as {
            previousValues?: Record<string, unknown>;
          } | null;
          const prev = meta?.previousValues;
          if (prev && typeof prev === 'object') {
            await tx.navigationStep.update({
              where: { id: line.entityId, tenantId },
              data: prev as Prisma.NavigationStepUpdateInput,
            });
          }
        } else if (line.operation === LEDGER_OP_CREATE_CANCER_DIAGNOSIS) {
          await tx.cancerDiagnosis.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_CREATE_TREATMENT) {
          await tx.treatment.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_CREATE_COMPLEMENTARY_EXAM) {
          await tx.complementaryExam.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_CREATE_OBSERVATION) {
          await tx.observation.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_CREATE_PERFORMANCE_STATUS_HISTORY) {
          await tx.performanceStatusHistory.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_CREATE_CLINICAL_PRESCRIPTION_LINE) {
          await tx.clinicalPrescriptionLine.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_CREATE_QUESTIONNAIRE_RESPONSE) {
          await tx.questionnaireResponse.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_CREATE_INTERNAL_NOTE) {
          await tx.internalNote.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        } else if (line.operation === LEDGER_OP_CREATE_INTERVENTION) {
          await tx.intervention.deleteMany({
            where: { id: line.entityId, tenantId },
          });
        }
      }

      await tx.clinicalNoteExtractionLedgerLine.deleteMany({
        where: { runId: run.id, tenantId },
      });

      await tx.clinicalNoteExtractionRun.update({
        where: { id: run.id, tenantId },
        data: {
          status: ClinicalNoteExtractionRunStatus.ROLLED_BACK,
          rolledBackAt: new Date(),
        },
      });
    });

    return { ok: true };
  }
}
