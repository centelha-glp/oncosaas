import {
  ComplementaryExamType,
  Prisma,
} from '@generated/prisma/client';
import { collapseRedundantComponentsForSave } from '../complementary-exams/collapse-redundant-components.util';
import {
  type ComplementaryExamMatchBatchCache,
  findOrCreateComplementaryExam,
  parseComplementaryPerformedAt,
  upsertComplementaryExamResult,
} from '../complementary-exams/complementary-exam-match.util';
import { LEDGER_OP_CREATE_COMPLEMENTARY_EXAM } from './clinical-note-extraction.constants';
import type { AiComplementaryExamItem } from './clinical-note-extraction.types';

const COMP_EXAM_TYPE_SET = new Set<string>(Object.values(ComplementaryExamType));

type RejectionSink = Array<{
  domain: string;
  reason: string;
  field?: string | null;
}>;

export type ApplyComplementaryExamsFromAiResult = {
  complementaryExamIds: string[];
  complementaryExamResultIds: string[];
};

/**
 * Find-or-create ComplementaryExam + upsert ComplementaryExamResult a partir de itens da IA.
 * Usado na extração de evolução e no exam-ingest (sem ledger quando pushLedger omitido).
 */
export async function applyComplementaryExamsFromAiItems(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    patientId: string;
    mergedRejections: RejectionSink;
    pushLedger?: (
      operation: string,
      entityId: string,
      metadata?: Prisma.InputJsonValue
    ) => Promise<void>;
    /** UUID comum a todos os resultados criados neste lote (exam-ingest). */
    collectionId?: string | null;
  },
  items: AiComplementaryExamItem[]
): Promise<ApplyComplementaryExamsFromAiResult> {
  const { tenantId, patientId, mergedRejections: rej, pushLedger, collectionId } =
    args;

  const complementaryExamIds: string[] = [];
  const complementaryExamResultIds: string[] = [];
  const seenExamIds = new Set<string>();
  const batchCache: ComplementaryExamMatchBatchCache = new Map();

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const typ = String(raw?.type ?? '').trim().toUpperCase();
    if (!COMP_EXAM_TYPE_SET.has(typ)) {
      rej.push({
        domain: 'complementary_exams',
        reason: `type inválido em [${i}]`,
        field: 'type',
      });
      continue;
    }
    const name = String(raw?.name ?? '').trim();
    if (!name || name.length > 400) {
      rej.push({
        domain: 'complementary_exams',
        reason: `name inválido em [${i}]`,
        field: 'name',
      });
      continue;
    }

    const { id: examId, created: examCreated } = await findOrCreateComplementaryExam(
      tx,
      {
        tenantId,
        patientId,
        type: typ as ComplementaryExamType,
        name,
        code: raw.code,
        loincCode: raw.loinc_code,
        batchCache,
      },
    );

    if (!seenExamIds.has(examId)) {
      seenExamIds.add(examId);
      complementaryExamIds.push(examId);
    }
    if (examCreated && pushLedger) {
      await pushLedger(LEDGER_OP_CREATE_COMPLEMENTARY_EXAM, examId);
    }

    const res = raw.result;
    if (!res) {
      continue;
    }
    const performedAt =
      parseComplementaryPerformedAt(res.performed_at) ?? new Date();
    if (
      res.performed_at !== null &&
      res.performed_at !== undefined &&
      String(res.performed_at).trim() !== '' &&
      parseComplementaryPerformedAt(res.performed_at) === null
    ) {
      rej.push({
        domain: 'complementary_exams',
        reason: `data inválida: complementary_exams[${i}].result.performed_at`,
        field: `complementary_exams[${i}].result.performed_at`,
      });
      continue;
    }

    const collapsed = collapseRedundantComponentsForSave(name, {
      valueNumeric:
        res.value_numeric === null || res.value_numeric === undefined
          ? null
          : Number.isFinite(Number(res.value_numeric))
            ? Number(res.value_numeric)
            : null,
      valueText:
        res.value_text === null || res.value_text === undefined
          ? null
          : String(res.value_text).trim().slice(0, 8000) || null,
      unit:
        res.unit === null || res.unit === undefined
          ? null
          : String(res.unit).trim().slice(0, 64) || null,
      referenceRange:
        res.reference_range === null || res.reference_range === undefined
          ? null
          : String(res.reference_range).trim().slice(0, 200) || null,
      isAbnormal:
        typeof res.is_abnormal === 'boolean' ? res.is_abnormal : null,
      report:
        res.report === null || res.report === undefined
          ? null
          : String(res.report).trim().slice(0, 12000) || null,
      components: res.components,
    });

    const { id: resultId } = await upsertComplementaryExamResult(tx, {
      tenantId,
      examId,
      performedAt,
      collectionId,
      payload: {
        valueNumeric: collapsed.valueNumeric ?? null,
        valueText: collapsed.valueText ?? null,
        unit: collapsed.unit ?? null,
        referenceRange: collapsed.referenceRange ?? null,
        isAbnormal: collapsed.isAbnormal ?? null,
        report: collapsed.report ?? null,
        components:
          collapsed.components &&
          Array.isArray(collapsed.components) &&
          collapsed.components.length > 0
            ? (collapsed.components as Prisma.InputJsonValue)
            : null,
      },
    });
    complementaryExamResultIds.push(resultId);
  }

  return { complementaryExamIds, complementaryExamResultIds };
}
