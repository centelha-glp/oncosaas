import {
  ComplementaryExamType,
  Prisma,
} from '@generated/prisma/client';
import { normalizeExamLabelKey } from './collapse-redundant-components.util';

const YMD_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type ComplementaryExamMatchBatchCache = Map<
  string,
  { id: string; name: string }
>;

export function buildComplementaryExamMatchKey(
  type: string,
  name: string,
  code?: string | null,
): string {
  const codePart =
    code === null || code === undefined || String(code).trim() === ''
      ? ''
      : normalizeExamLabelKey(String(code).trim());
  return `${type}|${normalizeExamLabelKey(name)}|${codePart}`;
}

/**
 * Data só com YYYY-MM-DD → início do dia UTC (00:00:00.000Z).
 * ISO com hora → instante exato após parse.
 */
export function parseComplementaryPerformedAt(
  raw: string | null | undefined,
): Date | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return null;
  }
  const s = String(raw).trim();
  if (YMD_ONLY.test(s)) {
    return new Date(`${s}T00:00:00.000Z`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function examRowMatchesKey(
  row: { type: ComplementaryExamType; name: string; code: string | null },
  matchKey: string,
): boolean {
  return (
    buildComplementaryExamMatchKey(row.type, row.name, row.code) === matchKey
  );
}

export async function findOrCreateComplementaryExam(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    patientId: string;
    type: ComplementaryExamType;
    name: string;
    code?: string | null;
    loincCode?: string | null;
    batchCache?: ComplementaryExamMatchBatchCache;
  },
): Promise<{ id: string; created: boolean }> {
  const { tenantId, patientId, type, name, code, loincCode, batchCache } = args;
  const trimmedName = name.trim().slice(0, 400);
  const trimmedCode =
    code === null || code === undefined
      ? null
      : String(code).trim().slice(0, 64) || null;
  const matchKey = buildComplementaryExamMatchKey(type, trimmedName, trimmedCode);

  const cached = batchCache?.get(matchKey);
  if (cached) {
    return { id: cached.id, created: false };
  }

  const existingRows = await tx.complementaryExam.findMany({
    where: { tenantId, patientId, type },
    select: { id: true, name: true, code: true, type: true },
  });
  const found = existingRows.find((row) => examRowMatchesKey(row, matchKey));
  if (found) {
    batchCache?.set(matchKey, { id: found.id, name: found.name });
    return { id: found.id, created: false };
  }

  const created = await tx.complementaryExam.create({
    data: {
      tenantId,
      patientId,
      type,
      name: trimmedName,
      code: trimmedCode,
      loincCode:
        loincCode === null || loincCode === undefined
          ? null
          : String(loincCode).trim().slice(0, 32) || null,
    },
  });
  batchCache?.set(matchKey, { id: created.id, name: created.name });
  return { id: created.id, created: true };
}

export type UpsertComplementaryExamResultPayload = {
  valueNumeric?: number | null;
  valueText?: string | null;
  unit?: string | null;
  referenceRange?: string | null;
  isAbnormal?: boolean | null;
  report?: string | null;
  components?: Prisma.InputJsonValue | undefined;
};

export async function upsertComplementaryExamResult(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    examId: string;
    performedAt: Date;
    collectionId?: string | null;
    payload: UpsertComplementaryExamResultPayload;
  },
): Promise<{ id: string; created: boolean }> {
  const { tenantId, examId, performedAt, collectionId, payload } = args;

  const existing = await tx.complementaryExamResult.findFirst({
    where: {
      tenantId,
      examId,
      performedAt,
      deletedAt: null,
    },
    select: { id: true },
  });

  const collection =
    collectionId !== null &&
    collectionId !== undefined &&
    collectionId !== ''
      ? { collectionId }
      : {};

  if (existing) {
    const updated = await tx.complementaryExamResult.update({
      where: { id: existing.id },
      data: {
        valueNumeric: payload.valueNumeric ?? null,
        valueText: payload.valueText ?? null,
        unit: payload.unit ?? null,
        referenceRange: payload.referenceRange ?? null,
        isAbnormal: payload.isAbnormal ?? null,
        report: payload.report ?? null,
        components: payload.components,
        ...collection,
      },
    });
    return { id: updated.id, created: false };
  }

  const created = await tx.complementaryExamResult.create({
    data: {
      tenantId,
      examId,
      performedAt,
      ...collection,
      valueNumeric: payload.valueNumeric ?? null,
      valueText: payload.valueText ?? null,
      unit: payload.unit ?? null,
      referenceRange: payload.referenceRange ?? null,
      isAbnormal: payload.isAbnormal ?? null,
      report: payload.report ?? null,
      components: payload.components,
    },
  });
  return { id: created.id, created: true };
}
