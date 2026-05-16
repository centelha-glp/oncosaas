import {
  JourneyStage,
  NavigationStepStatus,
  Prisma,
  ProcessedBy,
  TreatmentIntent,
  TreatmentResponse,
  TreatmentStatus,
  TreatmentType,
} from '@generated/prisma/client';
import { applyComplementaryExamsFromAiItems } from './apply-complementary-exams';
import {
  LEDGER_OP_CREATE_CANCER_DIAGNOSIS,
  LEDGER_OP_CREATE_CLINICAL_PRESCRIPTION_LINE,
  LEDGER_OP_CREATE_OBSERVATION,
  LEDGER_OP_CREATE_PERFORMANCE_STATUS_HISTORY,
  LEDGER_OP_CREATE_QUESTIONNAIRE_RESPONSE,
  LEDGER_OP_CREATE_TREATMENT,
  LEDGER_OP_UPDATE_CANCER_DIAGNOSIS,
  LEDGER_OP_UPDATE_NAVIGATION_STEP,
  LEDGER_OP_UPDATE_PATIENT_JOURNEY,
} from './clinical-note-extraction.constants';
import type {
  AiClinicalEvolutionStructureResponse,
  AiDiagnosisItem,
  AiNavigationStepUpdateItem,
  AiObservationItem,
  AiPerformanceStatusItem,
  AiPrescriptionLineItem,
  AiQuestionnaireResponseItem,
  AiTreatmentItem,
} from './clinical-note-extraction.types';

export type MergedRejection = {
  domain: string;
  reason: string;
  field?: string | null;
};

export type ExtendedApplyResult = {
  diagnosisIds: string[];
  treatmentIds: string[];
  journeyUpdated: boolean;
  navigationStepIds: string[];
  complementaryExamIds: string[];
  observationIds: string[];
  performanceIds: string[];
  prescriptionLineIds: string[];
  questionnaireResponseIds: string[];
};

const TREATMENT_TYPE_SET = new Set<string>(Object.values(TreatmentType));
const TREATMENT_STATUS_SET = new Set<string>(Object.values(TreatmentStatus));
const TREATMENT_INTENT_SET = new Set<string>(Object.values(TreatmentIntent));
const TREATMENT_RESPONSE_SET = new Set<string>(Object.values(TreatmentResponse));
const JOURNEY_STAGE_SET = new Set<string>(Object.values(JourneyStage));
function normalizeKey(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseIsoDate(
  raw: string | null | undefined,
  rej: MergedRejection[],
  domain: string,
  field: string
): Date | null {
  if (raw == null || String(raw).trim() === '') {
    return null;
  }
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) {
    rej.push({ domain, reason: `data inválida: ${field}`, field });
    return null;
  }
  return d;
}

export async function applyExtendedClinicalDomains(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    patientId: string;
    runId: string;
    signedByUserId: string;
    clinicalNoteId: string;
    latestVersionNumber: number;
    mergedRejections: MergedRejection[];
    ai: AiClinicalEvolutionStructureResponse;
    nextSequence: () => number;
  }
): Promise<ExtendedApplyResult> {
  const {
    tenantId,
    patientId,
    runId,
    signedByUserId,
    clinicalNoteId,
    latestVersionNumber,
    mergedRejections: rej,
    ai,
    nextSequence,
  } = args;

  const result: ExtendedApplyResult = {
    diagnosisIds: [],
    treatmentIds: [],
    journeyUpdated: false,
    navigationStepIds: [],
    complementaryExamIds: [],
    observationIds: [],
    performanceIds: [],
    prescriptionLineIds: [],
    questionnaireResponseIds: [],
  };

  const pushLedger = async (
    operation: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue
  ) => {
    await tx.clinicalNoteExtractionLedgerLine.create({
      data: {
        tenantId,
        runId,
        sequence: nextSequence(),
        operation,
        entityId,
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
  };

  await applyJourneyPatch(tx, args, pushLedger, result);

  await applyDiagnoses(
    tx,
    tenantId,
    patientId,
    runId,
    rej,
    pushLedger,
    ai.diagnoses ?? [],
    result
  );

  const primaryDiagnosisId = await resolvePrimaryDiagnosisId(
    tx,
    tenantId,
    patientId
  );

  await applyTreatments(
    tx,
    {
      tenantId,
      patientId,
      signedByUserId,
      primaryDiagnosisId,
      rej,
      pushLedger,
    },
    ai.treatments ?? [],
    result
  );

  await applyNavigationStepUpdates(
    tx,
    {
      tenantId,
      patientId,
      signedByUserId,
      rej,
      pushLedger,
    },
    ai.navigation_step_updates ?? [],
    result
  );

  const compApply = await applyComplementaryExamsFromAiItems(
    tx,
    { tenantId, patientId, mergedRejections: rej, pushLedger },
    ai.complementary_exams ?? []
  );
  result.complementaryExamIds.push(...compApply.complementaryExamIds);

  await applyObservations(
    tx,
    { tenantId, patientId, rej, pushLedger },
    ai.observations ?? [],
    result
  );

  await applyPerformanceHistory(
    tx,
    { tenantId, patientId, signedByUserId, rej, pushLedger },
    ai.performance_status_history ?? [],
    result
  );

  await applyPrescriptionLines(
    tx,
    {
      tenantId,
      patientId,
      clinicalNoteId,
      latestVersionNumber,
      signedByUserId,
      rej,
      pushLedger,
    },
    ai.clinical_prescription_lines ?? [],
    result
  );

  await applyQuestionnaireResponses(
    tx,
    { tenantId, patientId, rej, pushLedger },
    ai.questionnaire_responses ?? [],
    result
  );

  return result;
}

async function resolvePrimaryDiagnosisId(
  tx: Prisma.TransactionClient,
  tenantId: string,
  patientId: string
): Promise<string | null> {
  const row = await tx.cancerDiagnosis.findFirst({
    where: { tenantId, patientId, isPrimary: true, isActive: true },
    select: { id: true },
    orderBy: { diagnosisDate: 'desc' },
  });
  return row?.id ?? null;
}

async function applyJourneyPatch(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    patientId: string;
    mergedRejections: MergedRejection[];
    ai: AiClinicalEvolutionStructureResponse;
    nextSequence: () => number;
    runId: string;
  },
  pushLedger: (op: string, eid: string, meta?: Prisma.InputJsonValue) => Promise<void>,
  result: ExtendedApplyResult
): Promise<void> {
  const patch = args.ai.journey_patch;
  if (!patch || typeof patch !== 'object') {
    return;
  }
  const raw = patch as Record<string, unknown>;
  const jPick = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (k in raw && raw[k] !== undefined) {
        return raw[k];
      }
    }
    return undefined;
  };
  const journey = await tx.patientJourney.findUnique({
    where: { patientId: args.patientId },
  });
  if (!journey || journey.tenantId !== args.tenantId) {
    args.mergedRejections.push({
      domain: 'journey_patch',
      reason: 'PatientJourney não encontrada para o paciente',
    });
    return;
  }

  const data: Prisma.PatientJourneyUpdateInput = {};
  const previousValues: Record<string, unknown> = {};

  const strFields: Array<[string, keyof typeof journey, number]> = [
    ['screeningResult', 'screeningResult', 2000],
    ['pathologyReport', 'pathologyReport', 4000],
    ['treatmentProtocol', 'treatmentProtocol', 500],
    ['currentStep', 'currentStep', 500],
    ['nextStep', 'nextStep', 500],
  ];
  for (const [patchKey, col, max] of strFields) {
    const snake = patchKey.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    const val = jPick(patchKey, snake);
    if (val === undefined) {
      continue;
    }
    const next =
      val === null ? null : String(val).trim().slice(0, max) || null;
    const cur = journey[col] as string | null | undefined;
    if ((cur ?? null) !== (next ?? null)) {
      previousValues[col as string] = cur ?? null;
      (data as Record<string, unknown>)[col as string] = next;
    }
  }

  const dateFields: Array<[string[], keyof typeof journey]> = [
    [['screeningDate', 'screening_date'], 'screeningDate'],
    [['diagnosisDate', 'diagnosis_date'], 'diagnosisDate'],
    [['stagingDate', 'staging_date'], 'stagingDate'],
    [['treatmentStartDate', 'treatment_start_date'], 'treatmentStartDate'],
    [['lastFollowUpDate', 'last_follow_up_date'], 'lastFollowUpDate'],
    [['nextFollowUpDate', 'next_follow_up_date'], 'nextFollowUpDate'],
  ];
  for (const [keys, col] of dateFields) {
    const val = jPick(...keys);
    if (val === undefined) {
      continue;
    }
    const d = parseIsoDate(
      val as string | null,
      args.mergedRejections,
      'journey_patch',
      keys[0]
    );
    const cur = journey[col] as Date | null | undefined;
    const curMs = cur ? cur.getTime() : null;
    const nextMs = d ? d.getTime() : null;
    if (curMs !== nextMs) {
      previousValues[col as string] = cur ?? null;
      (data as Record<string, unknown>)[col as string] = d;
    }
  }

  const dc = jPick('diagnosisConfirmed', 'diagnosis_confirmed');
  if (typeof dc === 'boolean') {
    if (journey.diagnosisConfirmed !== dc) {
      previousValues.diagnosisConfirmed = journey.diagnosisConfirmed;
      data.diagnosisConfirmed = dc;
    }
  }

  const tt = jPick('treatmentType', 'treatment_type');
  if (tt !== undefined && tt !== null) {
    const v = String(tt).trim().toUpperCase();
    if (TREATMENT_TYPE_SET.has(v)) {
      if (journey.treatmentType !== v) {
        previousValues.treatmentType = journey.treatmentType ?? null;
        data.treatmentType = v as TreatmentType;
      }
    } else {
      args.mergedRejections.push({
        domain: 'journey_patch',
        reason: `treatmentType inválido: ${v}`,
        field: 'treatmentType',
      });
    }
  }

  const cyclePairs: Array<[string[], 'currentCycle' | 'totalCycles']> = [
    [['currentCycle', 'current_cycle'], 'currentCycle'],
    [['totalCycles', 'total_cycles'], 'totalCycles'],
  ];
  for (const [keys, prismaCol] of cyclePairs) {
    const val = jPick(...keys);
    if (val === undefined) {
      continue;
    }
    if (val === null) {
      const cur = journey[prismaCol] as number | null;
      if (cur != null) {
        previousValues[prismaCol] = cur;
        (data as Record<string, unknown>)[prismaCol] = null;
      }
      continue;
    }
    const num = Number(val);
    if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
      args.mergedRejections.push({
        domain: 'journey_patch',
        reason: `${prismaCol} inválido`,
        field: prismaCol,
      });
      continue;
    }
    if (journey[prismaCol] !== num) {
      previousValues[prismaCol] = journey[prismaCol] ?? null;
      (data as Record<string, unknown>)[prismaCol] = num;
    }
  }

  const blockersVal = jPick('blockers');
  if (Array.isArray(blockersVal)) {
    const next = blockersVal
      .map((b) => String(b).trim())
      .filter(Boolean)
      .slice(0, 40);
    const cur = JSON.stringify(journey.blockers ?? []);
    const nxt = JSON.stringify(next);
    if (cur !== nxt) {
      previousValues.blockers = journey.blockers ?? [];
      data.blockers = { set: next };
    }
  }

  if (Object.keys(data).length === 0) {
    return;
  }

  await tx.patientJourney.update({
    where: { id: journey.id, tenantId: args.tenantId },
    data,
  });
  result.journeyUpdated = true;
  await pushLedger(LEDGER_OP_UPDATE_PATIENT_JOURNEY, journey.id, {
    previousValues,
  } as Prisma.InputJsonValue);
}

async function applyDiagnoses(
  tx: Prisma.TransactionClient,
  tenantId: string,
  patientId: string,
  _runId: string,
  rej: MergedRejection[],
  pushLedger: (op: string, eid: string, meta?: Prisma.InputJsonValue) => Promise<void>,
  items: AiDiagnosisItem[],
  result: ExtendedApplyResult
): Promise<void> {
  const primary = await tx.cancerDiagnosis.findFirst({
    where: { tenantId, patientId, isPrimary: true, isActive: true },
    orderBy: { diagnosisDate: 'desc' },
  });

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const cancerType = String(raw?.cancer_type ?? '').trim();
    if (!cancerType || cancerType.length > 200) {
      rej.push({
        domain: 'diagnoses',
        reason: 'cancer_type inválido',
        field: `diagnoses[${i}].cancer_type`,
      });
      continue;
    }

    const matchPrimary =
      primary &&
      normalizeKey(primary.cancerType) === normalizeKey(cancerType);

    if (matchPrimary) {
      const data: Prisma.CancerDiagnosisUpdateInput = {};
      const previousValues: Record<string, unknown> = {};

      const optionalStrings = [
        ['icd10Code', raw.icd10_code, 32],
        ['stage', raw.stage, 200],
        ['tStage', raw.t_stage, 16],
        ['nStage', raw.n_stage, 16],
        ['mStage', raw.m_stage, 16],
        ['grade', raw.grade, 16],
        ['histologicalType', raw.histological_type, 200],
        ['pathologyReport', raw.pathology_report, 4000],
      ] as const;
      for (const [field, val, max] of optionalStrings) {
        if (val === undefined) {
          continue;
        }
        const next =
          val === null ? null : String(val).trim().slice(0, max) || null;
        const cur = primary[field as keyof typeof primary] as string | null;
        if ((cur ?? null) !== (next ?? null)) {
          previousValues[field] = cur ?? null;
          (data as Record<string, unknown>)[field] = next;
        }
      }

      if (raw.staging_date !== undefined) {
        const d = parseIsoDate(
          raw.staging_date,
          rej,
          'diagnoses',
          `diagnoses[${i}].staging_date`
        );
        const cur = primary.stagingDate;
        const cm = cur?.getTime() ?? null;
        const nm = d?.getTime() ?? null;
        if (cm !== nm) {
          previousValues.stagingDate = cur ?? null;
          data.stagingDate = d;
        }
      }

      if (Object.keys(data).length === 0) {
        continue;
      }

      await tx.cancerDiagnosis.update({
        where: { id: primary.id, tenantId },
        data,
      });
      await pushLedger(LEDGER_OP_UPDATE_CANCER_DIAGNOSIS, primary.id, {
        previousValues,
      } as Prisma.InputJsonValue);
      continue;
    }

    if (primary) {
      rej.push({
        domain: 'diagnoses',
        reason: `tipo de câncer divergente do primário (${cancerType.slice(0, 80)}); apenas atualização do primário é aplicada automaticamente`,
        field: `diagnoses[${i}]`,
      });
      continue;
    }

    const diagnosisDate =
      parseIsoDate(
        raw.diagnosis_date,
        rej,
        'diagnoses',
        `diagnoses[${i}].diagnosis_date`
      ) ?? new Date();

    const row = await tx.cancerDiagnosis.create({
      data: {
        tenantId,
        patientId,
        cancerType: cancerType.slice(0, 200),
        icd10Code:
          raw.icd10_code == null
            ? null
            : String(raw.icd10_code).trim().slice(0, 32) || null,
        stage:
          raw.stage == null
            ? null
            : String(raw.stage).trim().slice(0, 200) || null,
        tStage:
          raw.t_stage == null
            ? null
            : String(raw.t_stage).trim().slice(0, 16) || null,
        nStage:
          raw.n_stage == null
            ? null
            : String(raw.n_stage).trim().slice(0, 16) || null,
        mStage:
          raw.m_stage == null
            ? null
            : String(raw.m_stage).trim().slice(0, 16) || null,
        grade:
          raw.grade == null
            ? null
            : String(raw.grade).trim().slice(0, 16) || null,
        histologicalType:
          raw.histological_type == null
            ? null
            : String(raw.histological_type).trim().slice(0, 200) || null,
        stagingDate: raw.staging_date
          ? parseIsoDate(
              raw.staging_date,
              rej,
              'diagnoses',
              `diagnoses[${i}].staging_date`
            )
          : null,
        pathologyReport:
          raw.pathology_report == null
            ? null
            : String(raw.pathology_report).trim().slice(0, 4000) || null,
        diagnosisDate,
        isPrimary: true,
        isActive: true,
        diagnosisConfirmed: true,
      },
    });
    result.diagnosisIds.push(row.id);
    await pushLedger(LEDGER_OP_CREATE_CANCER_DIAGNOSIS, row.id);
  }
}

async function applyTreatments(
  tx: Prisma.TransactionClient,
  ctx: {
    tenantId: string;
    patientId: string;
    signedByUserId: string;
    primaryDiagnosisId: string | null;
    rej: MergedRejection[];
    pushLedger: (op: string, eid: string, meta?: Prisma.InputJsonValue) => Promise<void>;
  },
  items: AiTreatmentItem[],
  result: ExtendedApplyResult
): Promise<void> {
  const { tenantId, patientId, primaryDiagnosisId, rej, pushLedger } = ctx;
  if (!primaryDiagnosisId && items.length > 0) {
    rej.push({
      domain: 'treatments',
      reason: 'Nenhum diagnóstico primário ativo para vincular tratamentos',
    });
    return;
  }

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const tt = String(raw?.treatment_type ?? '').trim().toUpperCase();
    if (!TREATMENT_TYPE_SET.has(tt)) {
      rej.push({
        domain: 'treatments',
        reason: `treatment_type inválido em [${i}]`,
        field: 'treatment_type',
      });
      continue;
    }

    let status: TreatmentStatus = TreatmentStatus.PLANNED;
    if (raw.status) {
      const st = String(raw.status).trim().toUpperCase();
      if (TREATMENT_STATUS_SET.has(st)) {
        status = st as TreatmentStatus;
      } else {
        rej.push({
          domain: 'treatments',
          reason: `status inválido em [${i}]; usado PLANNED`,
          field: 'status',
        });
      }
    }

    let intent: TreatmentIntent = TreatmentIntent.CURATIVE;
    if (raw.intent) {
      const it = String(raw.intent).trim().toUpperCase();
      if (TREATMENT_INTENT_SET.has(it)) {
        intent = it as TreatmentIntent;
      } else {
        rej.push({
          domain: 'treatments',
          reason: `intent inválido em [${i}]; usado CURATIVE`,
          field: 'intent',
        });
      }
    }

    let response: TreatmentResponse | null = null;
    if (raw.response) {
      const rs = String(raw.response).trim().toUpperCase();
      if (TREATMENT_RESPONSE_SET.has(rs)) {
        response = rs as TreatmentResponse;
      } else {
        rej.push({
          domain: 'treatments',
          reason: `response inválida em [${i}]`,
          field: 'response',
        });
      }
    }

    const row = await tx.treatment.create({
      data: {
        tenantId,
        patientId,
        diagnosisId: primaryDiagnosisId!,
        treatmentType: tt as TreatmentType,
        treatmentName:
          raw.treatment_name == null
            ? null
            : String(raw.treatment_name).trim().slice(0, 300) || null,
        protocol:
          raw.protocol == null
            ? null
            : String(raw.protocol).trim().slice(0, 500) || null,
        line:
          raw.line == null
            ? null
            : Number.isFinite(Number(raw.line))
              ? Number(raw.line)
              : null,
        intent,
        startDate: raw.start_date
          ? parseIsoDate(raw.start_date, rej, 'treatments', `treatments[${i}].start_date`)
          : null,
        plannedEndDate: raw.planned_end_date
          ? parseIsoDate(
              raw.planned_end_date,
              rej,
              'treatments',
              `treatments[${i}].planned_end_date`
            )
          : null,
        status,
        isActive: raw.is_active !== false,
        notes:
          raw.notes == null
            ? null
            : String(raw.notes).trim().slice(0, 4000) || null,
        medications: raw.medications_json as Prisma.InputJsonValue | undefined,
        toxicities: raw.toxicities_json as Prisma.InputJsonValue | undefined,
        response,
        responseDate: raw.response_date
          ? parseIsoDate(
              raw.response_date,
              rej,
              'treatments',
              `treatments[${i}].response_date`
            )
          : null,
        responseNotes:
          raw.response_notes == null
            ? null
            : String(raw.response_notes).trim().slice(0, 2000) || null,
      },
    });
    result.treatmentIds.push(row.id);
    await pushLedger(LEDGER_OP_CREATE_TREATMENT, row.id);
  }
}

async function applyNavigationStepUpdates(
  tx: Prisma.TransactionClient,
  ctx: {
    tenantId: string;
    patientId: string;
    signedByUserId: string;
    rej: MergedRejection[];
    pushLedger: (op: string, eid: string, meta?: Prisma.InputJsonValue) => Promise<void>;
  },
  items: AiNavigationStepUpdateItem[],
  result: ExtendedApplyResult
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    let step = null as { id: string } & Record<string, unknown> | null;

    if (raw.navigation_step_id) {
      step = await tx.navigationStep.findFirst({
        where: {
          id: raw.navigation_step_id,
          tenantId: ctx.tenantId,
          patientId: ctx.patientId,
        },
      });
    } else if (raw.step_key && raw.cancer_type && raw.journey_stage) {
      const js = String(raw.journey_stage).trim().toUpperCase();
      if (!JOURNEY_STAGE_SET.has(js)) {
        ctx.rej.push({
          domain: 'navigation_step_updates',
          reason: `journey_stage inválido em [${i}]`,
          field: 'journey_stage',
        });
        continue;
      }
      step = await tx.navigationStep.findFirst({
        where: {
          tenantId: ctx.tenantId,
          patientId: ctx.patientId,
          stepKey: String(raw.step_key).trim(),
          cancerType: String(raw.cancer_type).trim().slice(0, 120),
          journeyStage: js as JourneyStage,
        },
        orderBy: { updatedAt: 'desc' },
      });
    } else {
      ctx.rej.push({
        domain: 'navigation_step_updates',
        reason: `item [${i}]: informe navigation_step_id ou (step_key+cancer_type+journey_stage)`,
      });
      continue;
    }

    if (!step) {
      ctx.rej.push({
        domain: 'navigation_step_updates',
        reason: `etapa não encontrada [${i}]`,
      });
      continue;
    }

    const full = await tx.navigationStep.findFirstOrThrow({
      where: { id: step.id, tenantId: ctx.tenantId },
    });

    const data: Prisma.NavigationStepUpdateInput = {};
    const previousValues: Record<string, unknown> = {};

    if (raw.result !== undefined) {
      const next =
        raw.result === null
          ? null
          : String(raw.result).trim().slice(0, 8000) || null;
      if ((full.result ?? null) !== (next ?? null)) {
        previousValues.result = full.result ?? null;
        data.result = next;
      }
    }
    if (raw.notes !== undefined) {
      const next =
        raw.notes === null
          ? null
          : String(raw.notes).trim().slice(0, 8000) || null;
      if ((full.notes ?? null) !== (next ?? null)) {
        previousValues.notes = full.notes ?? null;
        data.notes = next;
      }
    }
    if (raw.institution_name !== undefined) {
      const next =
        raw.institution_name === null
          ? null
          : String(raw.institution_name).trim().slice(0, 400) || null;
      if ((full.institutionName ?? null) !== (next ?? null)) {
        previousValues.institutionName = full.institutionName ?? null;
        data.institutionName = next;
      }
    }
    if (raw.professional_name !== undefined) {
      const next =
        raw.professional_name === null
          ? null
          : String(raw.professional_name).trim().slice(0, 400) || null;
      if ((full.professionalName ?? null) !== (next ?? null)) {
        previousValues.professionalName = full.professionalName ?? null;
        data.professionalName = next;
      }
    }

    if (raw.findings !== undefined) {
      previousValues.findings = full.findings ?? null;
      data.findings = raw.findings as Prisma.InputJsonValue;
    }
    if (raw.metadata !== undefined) {
      previousValues.metadata = full.metadata ?? null;
      data.metadata = raw.metadata as Prisma.InputJsonValue;
    }

    if (raw.actual_date !== undefined) {
      const d = parseIsoDate(
        raw.actual_date,
        ctx.rej,
        'navigation_step_updates',
        `navigation_step_updates[${i}].actual_date`
      );
      const cm = full.actualDate?.getTime() ?? null;
      const nm = d?.getTime() ?? null;
      if (raw.actual_date === null || raw.actual_date === '') {
        if (full.actualDate != null) {
          previousValues.actualDate = full.actualDate;
          data.actualDate = null;
        }
      } else if (cm !== nm && d) {
        previousValues.actualDate = full.actualDate ?? null;
        data.actualDate = d;
      }
    }

    if (raw.mark_completed === true) {
      if (!full.isCompleted) {
        previousValues.isCompleted = full.isCompleted;
        previousValues.completedAt = full.completedAt ?? null;
        previousValues.completedBy = full.completedBy ?? null;
        previousValues.status = full.status;
        data.isCompleted = true;
        data.completedAt = full.actualDate ?? new Date();
        data.completedBy = ctx.signedByUserId;
        data.status = NavigationStepStatus.COMPLETED;
      }
    }

    if (Object.keys(data).length === 0) {
      continue;
    }

    await tx.navigationStep.update({
      where: { id: full.id, tenantId: ctx.tenantId },
      data,
    });
    result.navigationStepIds.push(full.id);
    await ctx.pushLedger(LEDGER_OP_UPDATE_NAVIGATION_STEP, full.id, {
      previousValues,
    } as Prisma.InputJsonValue);
  }
}

async function applyObservations(
  tx: Prisma.TransactionClient,
  ctx: {
    tenantId: string;
    patientId: string;
    rej: MergedRejection[];
    pushLedger: (op: string, eid: string, meta?: Prisma.InputJsonValue) => Promise<void>;
  },
  items: AiObservationItem[],
  result: ExtendedApplyResult
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const code = String(raw?.code ?? '').trim();
    const display = String(raw?.display ?? '').trim();
    if (!code || !display) {
      ctx.rej.push({
        domain: 'observations',
        reason: `code/display obrigatórios em [${i}]`,
      });
      continue;
    }
    const eff = parseIsoDate(
      raw.effective_date_time,
      ctx.rej,
      'observations',
      `observations[${i}].effective_date_time`
    );
    if (!eff) {
      continue;
    }

    const row = await tx.observation.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
        code: code.slice(0, 64),
        display: display.slice(0, 500),
        effectiveDateTime: eff,
        valueQuantity:
          raw.value_quantity == null || raw.value_quantity === ''
            ? null
            : new Prisma.Decimal(String(raw.value_quantity).trim()),
        valueString:
          raw.value_string == null
            ? null
            : String(raw.value_string).trim().slice(0, 2000) || null,
        unit:
          raw.unit == null
            ? null
            : String(raw.unit).trim().slice(0, 64) || null,
      },
    });
    result.observationIds.push(row.id);
    await ctx.pushLedger(LEDGER_OP_CREATE_OBSERVATION, row.id);
  }
}

async function applyPerformanceHistory(
  tx: Prisma.TransactionClient,
  ctx: {
    tenantId: string;
    patientId: string;
    signedByUserId: string;
    rej: MergedRejection[];
    pushLedger: (op: string, eid: string, meta?: Prisma.InputJsonValue) => Promise<void>;
  },
  items: AiPerformanceStatusItem[],
  result: ExtendedApplyResult
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const ecog = Number(raw?.ecog_score);
    if (!Number.isInteger(ecog) || ecog < 0 || ecog > 4) {
      ctx.rej.push({
        domain: 'performance_status_history',
        reason: `ecog_score deve ser inteiro 0–4 em [${i}]`,
        field: 'ecog_score',
      });
      continue;
    }
    const assessedAt =
      parseIsoDate(
        raw.assessed_at,
        ctx.rej,
        'performance_status_history',
        `performance_status_history[${i}].assessed_at`
      ) ?? new Date();

    const row = await tx.performanceStatusHistory.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
        ecogScore: ecog,
        assessedAt,
        assessedBy: ctx.signedByUserId,
        source: 'MANUAL',
        notes:
          raw.notes == null
            ? null
            : String(raw.notes).trim().slice(0, 2000) || null,
      },
    });
    result.performanceIds.push(row.id);
    await ctx.pushLedger(LEDGER_OP_CREATE_PERFORMANCE_STATUS_HISTORY, row.id);
  }
}

async function applyPrescriptionLines(
  tx: Prisma.TransactionClient,
  ctx: {
    tenantId: string;
    patientId: string;
    clinicalNoteId: string;
    latestVersionNumber: number;
    signedByUserId: string;
    rej: MergedRejection[];
    pushLedger: (op: string, eid: string, meta?: Prisma.InputJsonValue) => Promise<void>;
  },
  items: AiPrescriptionLineItem[],
  result: ExtendedApplyResult
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const med = String(raw?.medication_name ?? '').trim();
    if (!med || med.length > 400) {
      ctx.rej.push({
        domain: 'clinical_prescription_lines',
        reason: `medication_name inválido em [${i}]`,
        field: 'medication_name',
      });
      continue;
    }
    const row = await tx.clinicalPrescriptionLine.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
        clinicalNoteId: ctx.clinicalNoteId,
        clinicalNoteVersionNumber: ctx.latestVersionNumber,
        prescribedById: ctx.signedByUserId,
        medicationName: med.slice(0, 400),
        catalogKey:
          raw.catalog_key == null
            ? null
            : String(raw.catalog_key).trim().slice(0, 128) || null,
        dosage:
          raw.dosage == null
            ? null
            : String(raw.dosage).trim().slice(0, 200) || null,
        frequency:
          raw.frequency == null
            ? null
            : String(raw.frequency).trim().slice(0, 200) || null,
        route:
          raw.route == null
            ? null
            : String(raw.route).trim().slice(0, 80) || null,
        duration:
          raw.duration == null
            ? null
            : String(raw.duration).trim().slice(0, 200) || null,
        indication:
          raw.indication == null
            ? null
            : String(raw.indication).trim().slice(0, 500) || null,
      },
    });
    result.prescriptionLineIds.push(row.id);
    await ctx.pushLedger(LEDGER_OP_CREATE_CLINICAL_PRESCRIPTION_LINE, row.id);
  }
}

async function applyQuestionnaireResponses(
  tx: Prisma.TransactionClient,
  ctx: {
    tenantId: string;
    patientId: string;
    rej: MergedRejection[];
    pushLedger: (op: string, eid: string, meta?: Prisma.InputJsonValue) => Promise<void>;
  },
  items: AiQuestionnaireResponseItem[],
  result: ExtendedApplyResult
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const code = String(raw?.questionnaire_code ?? '').trim();
    if (!code) {
      ctx.rej.push({
        domain: 'questionnaire_responses',
        reason: `questionnaire_code obrigatório em [${i}]`,
      });
      continue;
    }
    const q = await tx.questionnaire.findFirst({
      where: { tenantId: ctx.tenantId, code },
    });
    if (!q) {
      ctx.rej.push({
        domain: 'questionnaire_responses',
        reason: `questionário não encontrado para código "${code}"`,
        field: 'questionnaire_code',
      });
      continue;
    }
    if (!raw.responses || typeof raw.responses !== 'object') {
      ctx.rej.push({
        domain: 'questionnaire_responses',
        reason: `responses obrigatório (objeto) em [${i}]`,
      });
      continue;
    }

    const completedAt =
      parseIsoDate(
        raw.completed_at,
        ctx.rej,
        'questionnaire_responses',
        `questionnaire_responses[${i}].completed_at`
      ) ?? new Date();

    const row = await tx.questionnaireResponse.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
        questionnaireId: q.id,
        responses: raw.responses as Prisma.InputJsonValue,
        completedAt,
        appliedBy: ProcessedBy.AGENT,
        scores: raw.scores as Prisma.InputJsonValue | undefined,
      },
    });
    result.questionnaireResponseIds.push(row.id);
    await ctx.pushLedger(LEDGER_OP_CREATE_QUESTIONNAIRE_RESPONSE, row.id);
  }
}
