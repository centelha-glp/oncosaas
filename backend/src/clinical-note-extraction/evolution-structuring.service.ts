import * as crypto from 'crypto';
import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClinicalNoteExtractionRunStatus,
  ClinicalNoteStatus,
  ComorbiditySeverity,
  ComorbidityType,
  HealthCoverageType,
  InterventionType,
  MedicationCategory,
  Prisma,
} from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getAiServiceConfig,
  getAiServiceHeadersWithTenant,
} from '../common/utils/ai-service.util';
import { decryptSensitiveData } from '../whatsapp-connections/utils/encryption.util';
import { decodeDecryptedClinicalNoteToMarkdown } from '../clinical-notes/clinical-note-legacy-content.util';
import {
  LEDGER_OP_CREATE_CLINICAL_EXAM_REQUEST,
  LEDGER_OP_CREATE_COMORBIDITY,
  LEDGER_OP_CREATE_INTERVENTION,
  LEDGER_OP_CREATE_INTERNAL_NOTE,
  LEDGER_OP_CREATE_MEDICATION,
  LEDGER_OP_UPDATE_PATIENT,
} from './clinical-note-extraction.constants';
import type {
  AiClinicalEvolutionStructureResponse,
  AiPatientPatch,
  ClinicalNoteExtractionJobPayload,
} from './clinical-note-extraction.types';
import { applyExtendedClinicalDomains } from './apply-extended-domains';

const STRUCTURE_TIMEOUT_MS = 120_000;
const MAX_DISPLAY_NAME_LEN = 400;
const MAX_MED_COMORB_NAME_LEN = 500;

const MED_ENUMS = new Set<string>(Object.values(MedicationCategory));
const COMORB_TYPE_ENUMS = new Set<string>(Object.values(ComorbidityType));
const COMORB_SEV_ENUMS = new Set<string>(Object.values(ComorbiditySeverity));
const HEALTH_COV_ENUMS = new Set<string>(Object.values(HealthCoverageType));

const PATIENT_PATCH_KEYS = [
  'cancerType',
  'stage',
  'performanceStatus',
  'occupation',
  'preferredEmergencyHospital',
  'healthCoverageType',
  'healthPlanName',
  'insuranceMemberId',
  'currentSpecialty',
] as const;

type PatientPatchKey = (typeof PATIENT_PATCH_KEYS)[number];

@Injectable()
export class EvolutionStructuringService {
  private readonly logger = new Logger(EvolutionStructuringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private get encryptionKey(): string {
    const k = this.configService.get<string>('ENCRYPTION_KEY');
    if (!k) {
      throw new Error('ENCRYPTION_KEY is not configured');
    }
    return k;
  }

  private decryptClinicalNoteToMarkdown(encrypted: string): string {
    const plaintext = decryptSensitiveData(encrypted, this.encryptionKey);
    return decodeDecryptedClinicalNoteToMarkdown(plaintext);
  }

  private normalizeDedupKey(s: string | null | undefined): string {
    return String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private medicationCategoryFromAi(
    raw: string | null | undefined,
    mergedRejections: Array<{ domain: string; reason: string; field?: string | null }>,
    idx: number
  ): MedicationCategory {
    const v = String(raw ?? '').trim().toUpperCase();
    if (!v) {
      return MedicationCategory.OTHER;
    }
    if (MED_ENUMS.has(v)) {
      return v as MedicationCategory;
    }
    mergedRejections.push({
      domain: 'medications',
      reason: `category inválida na posição ${idx}; usado OTHER`,
      field: 'category',
    });
    return MedicationCategory.OTHER;
  }

  private comorbidityTypeFromAi(
    raw: string | null | undefined,
    mergedRejections: Array<{ domain: string; reason: string; field?: string | null }>,
    idx: number
  ): ComorbidityType {
    const v = String(raw ?? '').trim().toUpperCase();
    if (!v) {
      return ComorbidityType.OTHER;
    }
    if (COMORB_TYPE_ENUMS.has(v)) {
      return v as ComorbidityType;
    }
    mergedRejections.push({
      domain: 'comorbidities',
      reason: `type inválido na posição ${idx}; usado OTHER`,
      field: 'type',
    });
    return ComorbidityType.OTHER;
  }

  private comorbiditySeverityFromAi(
    raw: string | null | undefined,
    mergedRejections: Array<{ domain: string; reason: string; field?: string | null }>,
    idx: number
  ): ComorbiditySeverity {
    const v = String(raw ?? '').trim().toUpperCase();
    if (!v) {
      return ComorbiditySeverity.MODERATE;
    }
    if (COMORB_SEV_ENUMS.has(v)) {
      return v as ComorbiditySeverity;
    }
    mergedRejections.push({
      domain: 'comorbidities',
      reason: `severity inválida na posição ${idx}; usado MODERATE`,
      field: 'severity',
    });
    return ComorbiditySeverity.MODERATE;
  }

  private parseHealthCoverage(
    raw: string | null | undefined,
    mergedRejections: Array<{ domain: string; reason: string; field?: string | null }>
  ): HealthCoverageType | null {
    const v = String(raw ?? '').trim().toUpperCase();
    if (!v) {
      return null;
    }
    if (HEALTH_COV_ENUMS.has(v)) {
      return v as HealthCoverageType;
    }
    mergedRejections.push({
      domain: 'patient_patch',
      reason: 'healthCoverageType inválido',
      field: 'healthCoverageType',
    });
    return null;
  }

  private async buildPatientSnapshotForStructure(
    tenantId: string,
    patientId: string
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: {
        id: true,
        name: true,
        cancerType: true,
        stage: true,
        diagnosisDate: true,
        performanceStatus: true,
        currentStage: true,
        currentSpecialty: true,
        preferredEmergencyHospital: true,
        occupation: true,
        healthCoverageType: true,
        healthPlanName: true,
        insuranceMemberId: true,
        medications: {
          where: { isActive: true },
          take: 80,
          select: {
            name: true,
            dosage: true,
            frequency: true,
            category: true,
          },
        },
        comorbidities: {
          take: 80,
          select: {
            name: true,
            type: true,
            severity: true,
            controlled: true,
          },
        },
        cancerDiagnoses: {
          where: { isActive: true },
          take: 10,
          orderBy: { diagnosisDate: 'desc' },
          select: {
            id: true,
            cancerType: true,
            icd10Code: true,
            stage: true,
            isPrimary: true,
          },
        },
        navigationSteps: {
          take: 40,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            stepKey: true,
            cancerType: true,
            journeyStage: true,
            stepName: true,
            isCompleted: true,
          },
        },
      },
    });
    return (row ?? { id: patientId }) as Record<string, unknown>;
  }

  async runFromJob(payload: ClinicalNoteExtractionJobPayload): Promise<void> {
    const {
      tenantId,
      patientId,
      clinicalNoteId,
      signedByUserId,
      latestVersionNumber,
      sectionsContentHash,
    } = payload;

    let run = await this.prisma.clinicalNoteExtractionRun.findFirst({
      where: { clinicalNoteId, sectionsContentHash, tenantId },
    });

    if (run?.status === ClinicalNoteExtractionRunStatus.APPLIED) {
      this.logger.debug(
        `Extraction already APPLIED note=${clinicalNoteId} hash=${sectionsContentHash.slice(0, 12)}`
      );
      return;
    }
    if (run?.status === ClinicalNoteExtractionRunStatus.ROLLED_BACK) {
      return;
    }

    if (!run) {
      try {
        run = await this.prisma.clinicalNoteExtractionRun.create({
          data: {
            tenantId,
            patientId,
            clinicalNoteId,
            sectionsContentHash,
            latestVersionNumber,
            signedByUserId,
            status: ClinicalNoteExtractionRunStatus.PENDING,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          run = await this.prisma.clinicalNoteExtractionRun.findFirstOrThrow({
            where: { clinicalNoteId, sectionsContentHash, tenantId },
          });
          if (run.status === ClinicalNoteExtractionRunStatus.APPLIED) {
            return;
          }
        } else {
          throw e;
        }
      }
    }

    const note = await this.prisma.clinicalNote.findFirst({
      where: { id: clinicalNoteId, tenantId, patientId },
      include: {
        versions: {
          where: { versionNumber: latestVersionNumber },
          take: 1,
        },
      },
    });

    if (!note || note.versions[0]?.sectionsContentHash !== sectionsContentHash) {
      await this.prisma.clinicalNoteExtractionRun.update({
        where: { id: run.id, tenantId },
        data: {
          status: ClinicalNoteExtractionRunStatus.FAILED,
          errorMessage: 'Versão ou nota incompatível com o job de extração.',
        },
      });
      return;
    }

    if (note.status !== ClinicalNoteStatus.SIGNED) {
      await this.prisma.clinicalNoteExtractionRun.update({
        where: { id: run.id, tenantId },
        data: {
          status: ClinicalNoteExtractionRunStatus.FAILED,
          errorMessage: 'Nota não está assinada; extração cancelada.',
        },
      });
      return;
    }

    const version = note.versions[0];
    const contentMarkdown = this.decryptClinicalNoteToMarkdown(
      version.sectionsPayloadEncrypted
    );

    let aiJson: AiClinicalEvolutionStructureResponse;
    try {
      aiJson = await this.callAiStructure({
        tenantId,
        patientId,
        clinicalNoteId,
        noteType: note.noteType,
        contentMarkdown,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message.slice(0, 2000) : 'Erro desconhecido';
      this.logger.warn(
        `AI structure failed note=${clinicalNoteId}: ${msg}`,
        err instanceof Error ? err.stack : undefined
      );
      await this.prisma.clinicalNoteExtractionRun.update({
        where: { id: run.id, tenantId },
        data: {
          status: ClinicalNoteExtractionRunStatus.FAILED,
          errorMessage: msg,
        },
      });
      return;
    }

    const mergedRejections: Array<{
      domain: string;
      reason: string;
      field?: string | null;
    }> = [...(aiJson.rejection_report ?? [])];

    if (!Array.isArray(aiJson.clinical_exam_requests)) {
      aiJson.clinical_exam_requests = [];
    }
    if (!Array.isArray(aiJson.medications)) {
      aiJson.medications = [];
    }
    if (!Array.isArray(aiJson.comorbidities)) {
      aiJson.comorbidities = [];
    }
    if (!aiJson.patient_patch || typeof aiJson.patient_patch !== 'object') {
      aiJson.patient_patch = {};
    }
    if (!aiJson.journey_patch || typeof aiJson.journey_patch !== 'object') {
      aiJson.journey_patch = {};
    }
    if (!Array.isArray(aiJson.diagnoses)) {
      aiJson.diagnoses = [];
    }
    if (!Array.isArray(aiJson.treatments)) {
      aiJson.treatments = [];
    }
    if (!Array.isArray(aiJson.navigation_step_updates)) {
      aiJson.navigation_step_updates = [];
    }
    if (!Array.isArray(aiJson.complementary_exams)) {
      aiJson.complementary_exams = [];
    }
    if (!Array.isArray(aiJson.observations)) {
      aiJson.observations = [];
    }
    if (!Array.isArray(aiJson.performance_status_history)) {
      aiJson.performance_status_history = [];
    }
    if (!Array.isArray(aiJson.clinical_prescription_lines)) {
      aiJson.clinical_prescription_lines = [];
    }
    if (!Array.isArray(aiJson.questionnaire_responses)) {
      aiJson.questionnaire_responses = [];
    }

    const patchKeysApplied: string[] = [];

    const { createdExamIds, createdMedicationIds, createdComorbidityIds } =
      await this.prisma.$transaction(async (tx) => {
        const examIds: string[] = [];
        const medicationIds: string[] = [];
        const comorbidityIds: string[] = [];
        let seq = 0;
        const nextSeq = (): number => {
          seq += 1;
          return seq;
        };

        for (const raw of aiJson.clinical_exam_requests ?? []) {
          const displayName = String(raw.display_name ?? '').trim();
          if (!displayName || displayName.length > MAX_DISPLAY_NAME_LEN) {
            mergedRejections.push({
              domain: 'clinical_exam_requests',
              reason: 'display_name inválido ou vazio',
              field: 'display_name',
            });
            continue;
          }
          const code =
            raw.code === null || raw.code === undefined
              ? null
              : String(raw.code).trim().slice(0, 64) || null;
          const loincCode =
            raw.loinc_code === null || raw.loinc_code === undefined
              ? null
              : String(raw.loinc_code).trim().slice(0, 32) || null;

          const rowEx = await tx.clinicalExamRequest.create({
            data: {
              tenantId,
              patientId,
              clinicalNoteId,
              clinicalNoteVersionNumber: latestVersionNumber,
              requestedById: signedByUserId,
              displayName: displayName.slice(0, MAX_DISPLAY_NAME_LEN),
              code,
              loincCode,
            },
          });
          examIds.push(rowEx.id);
          await tx.clinicalNoteExtractionLedgerLine.create({
            data: {
              tenantId,
              runId: run.id,
              sequence: nextSeq(),
              operation: LEDGER_OP_CREATE_CLINICAL_EXAM_REQUEST,
              entityId: rowEx.id,
            },
          });
        }

        const activeMeds = await tx.medication.findMany({
          where: { patientId, tenantId, isActive: true },
          select: { name: true, dosage: true },
        });
        const medDedupKeys = new Set(
          activeMeds.map(
            (m) =>
              `${this.normalizeDedupKey(m.name)}|${this.normalizeDedupKey(m.dosage ?? '')}`
          )
        );

        for (let mi = 0; mi < (aiJson.medications ?? []).length; mi++) {
          const raw = aiJson.medications![mi];
          const name = String(raw?.name ?? '').trim();
          if (!name || name.length > MAX_MED_COMORB_NAME_LEN) {
            mergedRejections.push({
              domain: 'medications',
              reason: 'name inválido ou vazio',
              field: 'name',
            });
            continue;
          }
          const dosage =
            raw.dosage === null || raw.dosage === undefined
              ? null
              : String(raw.dosage).trim().slice(0, 200) || null;
          const dk = `${this.normalizeDedupKey(name)}|${this.normalizeDedupKey(dosage ?? '')}`;
          if (medDedupKeys.has(dk)) {
            mergedRejections.push({
              domain: 'medications',
              reason: `duplicado em relação ao prontuário: ${name.slice(0, 80)}`,
              field: 'name',
            });
            continue;
          }
          medDedupKeys.add(dk);

          const cat = this.medicationCategoryFromAi(
            raw.category ?? null,
            mergedRejections,
            mi
          );

          const rowM = await tx.medication.create({
            data: {
              tenantId,
              patientId,
              name: name.slice(0, MAX_MED_COMORB_NAME_LEN),
              dosage,
              frequency:
                raw.frequency === null || raw.frequency === undefined
                  ? null
                  : String(raw.frequency).trim().slice(0, 200) || null,
              indication:
                raw.indication === null || raw.indication === undefined
                  ? null
                  : String(raw.indication).trim().slice(0, 500) || null,
              route:
                raw.route === null || raw.route === undefined
                  ? null
                  : String(raw.route).trim().slice(0, 80) || null,
              category: cat,
              notes:
                raw.notes === null || raw.notes === undefined
                  ? null
                  : String(raw.notes).trim().slice(0, 2000) || null,
              isAnticoagulant: cat === MedicationCategory.ANTICOAGULANT,
              isAntiplatelet: cat === MedicationCategory.ANTIPLATELET,
              isCorticosteroid: cat === MedicationCategory.CORTICOSTEROID,
              isImmunosuppressant: cat === MedicationCategory.IMMUNOSUPPRESSANT,
              isOpioid: cat === MedicationCategory.OPIOID_ANALGESIC,
              isNSAID: cat === MedicationCategory.NSAID,
              isGrowthFactor: cat === MedicationCategory.GROWTH_FACTOR,
            },
          });
          medicationIds.push(rowM.id);
          await tx.clinicalNoteExtractionLedgerLine.create({
            data: {
              tenantId,
              runId: run.id,
              sequence: nextSeq(),
              operation: LEDGER_OP_CREATE_MEDICATION,
              entityId: rowM.id,
            },
          });
        }

        const existingComorb = await tx.comorbidity.findMany({
          where: { patientId, tenantId },
          select: { name: true },
        });
        const comDedupKeys = new Set(
          existingComorb.map((c) => this.normalizeDedupKey(c.name))
        );

        for (let ci = 0; ci < (aiJson.comorbidities ?? []).length; ci++) {
          const raw = aiJson.comorbidities![ci];
          const name = String(raw?.name ?? '').trim();
          if (!name || name.length > MAX_MED_COMORB_NAME_LEN) {
            mergedRejections.push({
              domain: 'comorbidities',
              reason: 'name inválido ou vazio',
              field: 'name',
            });
            continue;
          }
          const ck = this.normalizeDedupKey(name);
          if (comDedupKeys.has(ck)) {
            mergedRejections.push({
              domain: 'comorbidities',
              reason: `duplicado em relação ao prontuário: ${name.slice(0, 80)}`,
              field: 'name',
            });
            continue;
          }
          comDedupKeys.add(ck);

          const ctype = this.comorbidityTypeFromAi(
            raw.type ?? null,
            mergedRejections,
            ci
          );
          const csev = this.comorbiditySeverityFromAi(
            raw.severity ?? null,
            mergedRejections,
            ci
          );

          const rowC = await tx.comorbidity.create({
            data: {
              tenantId,
              patientId,
              name: name.slice(0, MAX_MED_COMORB_NAME_LEN),
              type: ctype,
              severity: csev,
              controlled:
                typeof raw.controlled === 'boolean' ? raw.controlled : false,
              notes:
                raw.notes === null || raw.notes === undefined
                  ? null
                  : String(raw.notes).trim().slice(0, 2000) || null,
              increasesSepsisRisk: (
                [
                  ComorbidityType.DIABETES_TYPE_1,
                  ComorbidityType.DIABETES_TYPE_2,
                  ComorbidityType.CHRONIC_KIDNEY_DISEASE,
                  ComorbidityType.HIV_AIDS,
                ] as ComorbidityType[]
              ).includes(ctype),
              increasesBleedingRisk: false,
              increasesThrombosisRisk: (
                [
                  ComorbidityType.ATRIAL_FIBRILLATION,
                  ComorbidityType.DEEP_VEIN_THROMBOSIS,
                  ComorbidityType.PULMONARY_EMBOLISM,
                ] as ComorbidityType[]
              ).includes(ctype),
              affectsRenalClearance:
                ctype === ComorbidityType.CHRONIC_KIDNEY_DISEASE,
              affectsPulmonaryReserve: (
                [ComorbidityType.COPD, ComorbidityType.ASTHMA] as ComorbidityType[]
              ).includes(ctype),
            },
          });
          comorbidityIds.push(rowC.id);
          await tx.clinicalNoteExtractionLedgerLine.create({
            data: {
              tenantId,
              runId: run.id,
              sequence: nextSeq(),
              operation: LEDGER_OP_CREATE_COMORBIDITY,
              entityId: rowC.id,
            },
          });
        }

        const patch = aiJson.patient_patch as AiPatientPatch;
        const patientBefore = await tx.patient.findFirst({
          where: { id: patientId, tenantId },
        });
        if (patientBefore) {
          const data: Prisma.PatientUpdateInput = {};
          const previousValues: Partial<Record<PatientPatchKey, unknown>> = {};

          for (const key of PATIENT_PATCH_KEYS) {
            if (!(key in patch) || patch[key] === undefined) {
              continue;
            }
            const nextRaw = patch[key];
            if (key === 'performanceStatus') {
              if (nextRaw === null) {
                if (patientBefore.performanceStatus !== null && patientBefore.performanceStatus !== undefined) {
                  previousValues.performanceStatus =
                    patientBefore.performanceStatus;
                  data.performanceStatus = null;
                }
                continue;
              }
              const n = Number(nextRaw);
              if (!Number.isFinite(n) || !Number.isInteger(n)) {
                mergedRejections.push({
                  domain: 'patient_patch',
                  reason: 'performanceStatus deve ser inteiro ou null',
                  field: 'performanceStatus',
                });
                continue;
              }
              if (n < 0 || n > 100) {
                mergedRejections.push({
                  domain: 'patient_patch',
                  reason: 'performanceStatus fora do intervalo 0–100',
                  field: 'performanceStatus',
                });
                continue;
              }
              if (patientBefore.performanceStatus !== n) {
                previousValues.performanceStatus = patientBefore.performanceStatus;
                data.performanceStatus = n;
              }
              continue;
            }

            if (key === 'healthCoverageType') {
              const parsed = this.parseHealthCoverage(
                nextRaw as string | null,
                mergedRejections
              );
              if (parsed === null && nextRaw !== null && nextRaw !== '') {
                continue;
              }
              if (patientBefore.healthCoverageType !== parsed) {
                previousValues.healthCoverageType =
                  patientBefore.healthCoverageType ?? null;
                data.healthCoverageType = parsed;
              }
              continue;
            }

            const nextStr =
              nextRaw === null || nextRaw === undefined
                ? null
                : String(nextRaw).trim();
            const maxLens: Record<string, number> = {
              cancerType: 120,
              stage: 120,
              occupation: 300,
              preferredEmergencyHospital: 400,
              healthPlanName: 300,
              insuranceMemberId: 120,
              currentSpecialty: 120,
            };
            const maxL = maxLens[key] ?? 200;
            if (nextStr && nextStr.length > maxL) {
              mergedRejections.push({
                domain: 'patient_patch',
                reason: `${key} excede tamanho máximo (${maxL})`,
                field: key,
              });
              continue;
            }

            const curVal = patientBefore[key as keyof typeof patientBefore];
            const normalizedNext = nextStr === '' ? null : nextStr;
            const curComparable =
              curVal === undefined || curVal === null
                ? null
                : typeof curVal === 'string'
                  ? curVal
                  : String(curVal);

            if ((curComparable ?? null) !== (normalizedNext ?? null)) {
              (previousValues as Record<string, unknown>)[key] =
                curVal === undefined ? null : curVal;
              (data as Record<string, unknown>)[key] = normalizedNext;
            }
          }

          if (Object.keys(data).length > 0) {
            await tx.patient.update({
              where: { id: patientId, tenantId },
              data,
            });
            patchKeysApplied.push(...Object.keys(data));
            await tx.clinicalNoteExtractionLedgerLine.create({
              data: {
                tenantId,
                runId: run.id,
                sequence: nextSeq(),
                operation: LEDGER_OP_UPDATE_PATIENT,
                entityId: patientId,
                metadata: { previousValues } as Prisma.InputJsonValue,
              },
            });
          }
        }

        const extended = await applyExtendedClinicalDomains(tx, {
          tenantId,
          patientId,
          runId: run.id,
          signedByUserId,
          clinicalNoteId,
          latestVersionNumber,
          mergedRejections,
          ai: aiJson,
          nextSequence: nextSeq,
        });

        const extSummaryParts = [
          `jornada: ${extended.journeyUpdated ? 1 : 0}`,
          `dx: ${extended.diagnosisIds.length}`,
          `ttt: ${extended.treatmentIds.length}`,
          `nav: ${extended.navigationStepIds.length}`,
          `comp_ex: ${extended.complementaryExamIds.length}`,
          `obs: ${extended.observationIds.length}`,
          `ecog_hist: ${extended.performanceIds.length}`,
          `rx_lines: ${extended.prescriptionLineIds.length}`,
          `qnr: ${extended.questionnaireResponseIds.length}`,
        ].join(', ');

        const baseMutationCount =
          examIds.length +
          medicationIds.length +
          comorbidityIds.length +
          patchKeysApplied.length;
        const extendedMutationCount =
          extended.diagnosisIds.length +
          extended.treatmentIds.length +
          extended.navigationStepIds.length +
          extended.complementaryExamIds.length +
          extended.observationIds.length +
          extended.performanceIds.length +
          extended.prescriptionLineIds.length +
          extended.questionnaireResponseIds.length +
          (extended.journeyUpdated ? 1 : 0);

        const noteBody = [
          'Extração assistida da evolução assinada.',
          `Run: ${run.id}; Nota: ${clinicalNoteId}`,
          `Alterações aplicadas — pedidos de exame: ${examIds.length}, medicamentos: ${medicationIds.length}, comorbidades: ${comorbidityIds.length}, campos do cadastro (paciente): ${patchKeysApplied.length}; estendido [${extSummaryParts}].`,
          ...(baseMutationCount + extendedMutationCount === 0
            ? [
                '(Nenhuma mutação de domínio aplicável após validação — execução registrada como concluída.)',
              ]
            : []),
          `Versão: ${latestVersionNumber}; hash (prefixo): ${sectionsContentHash.slice(0, 16)}…`,
        ].join(' ');

        const internal = await tx.internalNote.create({
          data: {
            tenantId,
            patientId,
            authorId: signedByUserId,
            content: noteBody,
          },
        });
        await tx.clinicalNoteExtractionLedgerLine.create({
          data: {
            tenantId,
            runId: run.id,
            sequence: nextSeq(),
            operation: LEDGER_OP_CREATE_INTERNAL_NOTE,
            entityId: internal.id,
          },
        });

        const intervention = await tx.intervention.create({
          data: {
            tenantId,
            patientId,
            userId: signedByUserId,
            type: InterventionType.NOTE_ADDED,
            notes:
              `clinical_note_extraction_run=${run.id}; clinical_note=${clinicalNoteId}; ` +
              `NOTE_ADDED conforme ADR 0002 — domínios: exams=${examIds.length}, meds=${medicationIds.length}, ` +
              `comorb=${comorbidityIds.length}, patient_fields=${patchKeysApplied.length}; ` +
              `extended: journey=${extended.journeyUpdated ? 1 : 0}, dx=${extended.diagnosisIds.length}, ` +
              `ttt=${extended.treatmentIds.length}, nav=${extended.navigationStepIds.length}, ` +
              `cex=${extended.complementaryExamIds.length}, obs=${extended.observationIds.length}, ` +
              `ecog=${extended.performanceIds.length}, rx=${extended.prescriptionLineIds.length}, ` +
              `q=${extended.questionnaireResponseIds.length}.`,
          },
        });
        await tx.clinicalNoteExtractionLedgerLine.create({
          data: {
            tenantId,
            runId: run.id,
            sequence: nextSeq(),
            operation: LEDGER_OP_CREATE_INTERVENTION,
            entityId: intervention.id,
          },
        });

        const appliedPayloadHash = crypto
          .createHash('sha256')
          .update(
            JSON.stringify({
              v: 3,
              clinicalExamRequestIds: [...examIds].sort(),
              medicationIds: [...medicationIds].sort(),
              comorbidityIds: [...comorbidityIds].sort(),
              patientPatchKeys: [...patchKeysApplied].sort(),
              journeyUpdated: extended.journeyUpdated,
              diagnosisIds: [...extended.diagnosisIds].sort(),
              treatmentIds: [...extended.treatmentIds].sort(),
              navigationStepIds: [...extended.navigationStepIds].sort(),
              complementaryExamIds: [...extended.complementaryExamIds].sort(),
              observationIds: [...extended.observationIds].sort(),
              performanceStatusIds: [...extended.performanceIds].sort(),
              prescriptionLineIds: [...extended.prescriptionLineIds].sort(),
              questionnaireResponseIds: [
                ...extended.questionnaireResponseIds,
              ].sort(),
            }),
            'utf8'
          )
          .digest('hex');

        const warnDomains: string[] = [];
        if (
          examIds.length === 0 &&
          (aiJson.clinical_exam_requests?.length ?? 0) > 0
        ) {
          warnDomains.push('pedidos de exame');
        }
        if (
          medicationIds.length === 0 &&
          (aiJson.medications?.length ?? 0) > 0
        ) {
          warnDomains.push('medicamentos');
        }
        if (
          comorbidityIds.length === 0 &&
          (aiJson.comorbidities?.length ?? 0) > 0
        ) {
          warnDomains.push('comorbidades');
        }
        const patchAttempted = PATIENT_PATCH_KEYS.some(
          (k) => aiJson.patient_patch?.[k as keyof AiPatientPatch] !== undefined
        );
        if (patchKeysApplied.length === 0 && patchAttempted) {
          warnDomains.push('cadastro do paciente');
        }

        await tx.clinicalNoteExtractionRun.update({
          where: { id: run.id, tenantId },
          data: {
            status: ClinicalNoteExtractionRunStatus.APPLIED,
            rejectionReport: mergedRejections,
            appliedPayloadHash,
            appliedAt: new Date(),
            errorMessage:
              warnDomains.length > 0
                ? `Nenhuma alteração aplicável após validação em: ${warnDomains.join(', ')}.`
                : null,
          },
        });

        return {
          createdExamIds: examIds,
          createdMedicationIds: medicationIds,
          createdComorbidityIds: comorbidityIds,
        };
      });

    this.logger.log(
      `Extraction run=${run.id} note=${clinicalNoteId} exams=${createdExamIds.length} meds=${createdMedicationIds.length} comorb=${createdComorbidityIds.length}`
    );
  }

  private async callAiStructure(args: {
    tenantId: string;
    patientId: string;
    clinicalNoteId: string;
    noteType: string;
    contentMarkdown: string;
  }): Promise<AiClinicalEvolutionStructureResponse> {
    const { aiServiceUrl, headers: baseHeaders } = getAiServiceConfig(
      this.configService
    );
    const headers = {
      ...baseHeaders,
      ...getAiServiceHeadersWithTenant(this.configService, args.tenantId),
    };
    const url = `${aiServiceUrl}/api/v1/clinical-evolution/structure`;

    const patientSnapshot = await this.buildPatientSnapshotForStructure(
      args.tenantId,
      args.patientId
    );

    const body = {
      tenant_id: args.tenantId,
      patient_id: args.patientId,
      clinical_note_id: args.clinicalNoteId,
      note_type: args.noteType,
      content_markdown: args.contentMarkdown,
      patient_snapshot: patientSnapshot,
    };

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), STRUCTURE_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await res.text();
      if (!res.ok) {
        if (res.status === 503) {
          throw new ServiceUnavailableException(
            raw.slice(0, 500) || 'ai-service indisponível'
          );
        }
        throw new BadGatewayException(
          `ai-service status=${res.status} body=${raw.slice(0, 500)}`
        );
      }
      let parsed: AiClinicalEvolutionStructureResponse;
      try {
        parsed = JSON.parse(raw) as AiClinicalEvolutionStructureResponse;
      } catch {
        throw new BadGatewayException('Resposta JSON inválida do ai-service');
      }
      if (!parsed.extraction_schema_version) {
        parsed.extraction_schema_version = 'unknown';
      }
      if (!Array.isArray(parsed.clinical_exam_requests)) {
        parsed.clinical_exam_requests = [];
      }
      if (!Array.isArray(parsed.medications)) {
        parsed.medications = [];
      }
      if (!Array.isArray(parsed.comorbidities)) {
        parsed.comorbidities = [];
      }
      if (!parsed.patient_patch || typeof parsed.patient_patch !== 'object') {
        parsed.patient_patch = {};
      }
      if (!parsed.journey_patch || typeof parsed.journey_patch !== 'object') {
        parsed.journey_patch = {};
      }
      if (!Array.isArray(parsed.diagnoses)) {
        parsed.diagnoses = [];
      }
      if (!Array.isArray(parsed.treatments)) {
        parsed.treatments = [];
      }
      if (!Array.isArray(parsed.navigation_step_updates)) {
        parsed.navigation_step_updates = [];
      }
      if (!Array.isArray(parsed.complementary_exams)) {
        parsed.complementary_exams = [];
      }
      if (!Array.isArray(parsed.observations)) {
        parsed.observations = [];
      }
      if (!Array.isArray(parsed.performance_status_history)) {
        parsed.performance_status_history = [];
      }
      if (!Array.isArray(parsed.clinical_prescription_lines)) {
        parsed.clinical_prescription_lines = [];
      }
      if (!Array.isArray(parsed.questionnaire_responses)) {
        parsed.questionnaire_responses = [];
      }
      return parsed;
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      if (name === 'AbortError') {
        throw new BadGatewayException(
          'Timeout ao contactar o serviço de estruturação da evolução.'
        );
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
}
