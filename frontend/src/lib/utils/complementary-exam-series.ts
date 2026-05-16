import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  ComplementaryExam,
  ComplementaryExamResult,
  ComplementaryExamResultComponent,
} from '@/lib/api/patients';

/**
 * Garante array de subitens a partir do JSON do backend/Prisma.
 * Aceita array, string JSON ou null; ignora formatos inválidos.
 */
export function normalizeComplementaryResultComponents(
  raw: unknown
): ComplementaryExamResultComponent[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    try {
      return normalizeComplementaryResultComponents(JSON.parse(t) as unknown);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: ComplementaryExamResultComponent[] = [];
  for (const el of raw) {
    if (!el || typeof el !== 'object' || Array.isArray(el)) continue;
    const o = el as Record<string, unknown>;
    const nameRaw = o.name;
    if (typeof nameRaw !== 'string' || !nameRaw.trim()) continue;
    const vn = o.valueNumeric ?? o.value_numeric;
    let valueNumeric: number | null | undefined;
    if (vn === null || vn === undefined || vn === '') {
      valueNumeric = vn === null ? null : undefined;
    } else if (typeof vn === 'number' && Number.isFinite(vn)) {
      valueNumeric = vn;
    } else {
      const n = Number(vn);
      valueNumeric = Number.isFinite(n) ? n : null;
    }
    const vt = o.valueText ?? o.value_text;
    const u = o.unit;
    const rr = o.referenceRange ?? o.reference_range;
    const ia = o.isAbnormal ?? o.is_abnormal;
    out.push({
      name: nameRaw.trim(),
      valueNumeric: valueNumeric ?? null,
      valueText:
        vt === null || vt === undefined
          ? null
          : String(vt).trim().slice(0, 8000) || null,
      unit: u === null || u === undefined ? null : String(u).trim() || null,
      referenceRange:
        rr === null || rr === undefined ? null : String(rr).trim() || null,
      isAbnormal: typeof ia === 'boolean' ? ia : null,
    });
  }
  return out;
}

export interface ComplementaryExamChartPoint {
  date: string;
  dateSort: number;
  value: number;
}

export function filterActiveComplementaryResults(
  results: ComplementaryExamResult[]
): ComplementaryExamResult[] {
  return results.filter((r) => r.deletedAt == null);
}

export function examHasPanelComponents(exam: ComplementaryExam): boolean {
  return exam.results.some(
    (r) => normalizeComplementaryResultComponents(r.components).length > 0
  );
}

/** Nomes únicos estáveis (chave case-insensitive, rótulo preserva primeira grafia vista). */
export function collectUniqueComponentNames(exam: ComplementaryExam): string[] {
  const byKey = new Map<string, string>();
  for (const r of exam.results) {
    for (const c of normalizeComplementaryResultComponents(r.components)) {
      const raw = c.name?.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, raw);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function findComponentInResult(
  result: ComplementaryExamResult,
  componentDisplayName: string
): ComplementaryExamResultComponent | undefined {
  const want = componentDisplayName.trim().toLowerCase();
  return normalizeComplementaryResultComponents(result.components).find(
    (c) => c.name && c.name.trim().toLowerCase() === want
  );
}

export function buildParentNumericChartPoints(
  results: ComplementaryExamResult[]
): ComplementaryExamChartPoint[] {
  return results
    .filter((r) => r.valueNumeric != null)
    .map((r) => ({
      date: format(new Date(r.performedAt), 'dd/MM/yyyy', { locale: ptBR }),
      dateSort: new Date(r.performedAt).getTime(),
      value: r.valueNumeric as number,
    }))
    .sort((a, b) => a.dateSort - b.dateSort);
}

export function buildComponentNumericChartPoints(
  results: ComplementaryExamResult[],
  componentDisplayName: string
): ComplementaryExamChartPoint[] {
  const want = componentDisplayName.trim().toLowerCase();
  return results
    .map((r) => {
      const c = normalizeComplementaryResultComponents(r.components).find(
        (x) => x.name && x.name.trim().toLowerCase() === want
      );
      return {
        date: format(new Date(r.performedAt), 'dd/MM/yyyy', { locale: ptBR }),
        dateSort: new Date(r.performedAt).getTime(),
        value: c?.valueNumeric ?? null,
      };
    })
    .filter((row): row is ComplementaryExamChartPoint => row.value != null)
    .sort((a, b) => a.dateSort - b.dateSort);
}

/** Unidade preferida para tooltip do subitem (primeiro componente com unit). */
export function guessComponentUnit(
  exam: ComplementaryExam,
  componentDisplayName: string
): string | null {
  const want = componentDisplayName.trim().toLowerCase();
  for (const r of exam.results) {
    const c = normalizeComplementaryResultComponents(r.components).find(
      (x) => x.name && x.name.trim().toLowerCase() === want
    );
    if (c?.unit?.trim()) return c.unit.trim();
  }
  return exam.unit?.trim() ?? null;
}
