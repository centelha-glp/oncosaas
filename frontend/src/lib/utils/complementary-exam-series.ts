import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  ComplementaryExam,
  ComplementaryExamResult,
  ComplementaryExamResultComponent,
  ComplementaryExamType,
} from '@/lib/api/patients';
import {
  preferredDisplayNameForGroup,
  resolveCanonicalExamGroupId,
} from '@/lib/utils/complementary-exam-canonical';

export function buildComplementaryExamMatchKey(
  type: ComplementaryExamType | string,
  name: string,
  code?: string | null,
  loincCode?: string | null
): string {
  const canonicalId = resolveCanonicalExamGroupId(
    type,
    name,
    code,
    loincCode
  );
  return `${type}|${canonicalId}`;
}

/** Agrupa registros legados com o mesmo nome/tipo/código num único cabeçalho. */
export function groupComplementaryExamsByName(
  exams: ComplementaryExam[]
): ComplementaryExam[] {
  const groups = new Map<string, ComplementaryExam>();
  for (const exam of exams) {
    const canonicalId = resolveCanonicalExamGroupId(
      exam.type,
      exam.name,
      exam.code,
      exam.loincCode
    );
    const key = `${exam.type}|${canonicalId}`;
    const displayName = preferredDisplayNameForGroup(canonicalId, exam.name);
    const active = dedupeResultsByPerformedInstant(
      filterActiveComplementaryResults(exam.results)
    );
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...exam, name: displayName, results: active });
      continue;
    }
    const merged = dedupeResultsByPerformedInstant([
      ...existing.results,
      ...active,
    ]).sort(
      (a, b) =>
        new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
    );
    groups.set(key, { ...existing, name: displayName, results: merged });
  }
  return [...groups.values()];
}

/** Remove apenas resultados com o mesmo instante (ms) — não colapsa horários do mesmo dia. */
export function dedupeResultsByPerformedInstant(
  results: ComplementaryExamResult[]
): ComplementaryExamResult[] {
  const byInstant = new Map<number, ComplementaryExamResult>();
  for (const r of results) {
    const t = new Date(r.performedAt).getTime();
    if (!byInstant.has(t)) {
      byInstant.set(t, r);
    }
  }
  return [...byInstant.values()];
}

function utcCalendarDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function formatUtcDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

function formatUtcDateTime(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day}/${month}/${d.getUTCFullYear()} ${hours}:${minutes}`;
}

/** dd/MM/yyyy (UTC); se >1 resultado no mesmo dia calendário UTC, inclui HH:mm. */
export function formatComplementaryResultPerformedAt(
  allResultsInExam: ComplementaryExamResult[],
  performedAt: string | Date
): string {
  const d = new Date(performedAt);
  const dayKey = utcCalendarDayKey(d);
  const sameDayCount = allResultsInExam.filter(
    (r) => utcCalendarDayKey(new Date(r.performedAt)) === dayKey
  ).length;
  if (sameDayCount > 1) {
    return formatUtcDateTime(d);
  }
  return formatUtcDate(d);
}

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

/** Chave de comparação de rótulos (sem acentos, minúsculas, só alfanumérico). */
export function normalizeExamLabelKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** Siglas/nomes entre parênteses no título do exame, ex.: "(TTPa)". */
export function extractParentheticalAliases(examName: string): string[] {
  const aliases: string[] = [];
  const re = /\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(examName)) !== null) {
    const inner = m[1].trim();
    if (inner) aliases.push(inner);
  }
  return aliases;
}

function resultHasMainValue(result: ComplementaryExamResult): boolean {
  if (result.valueNumeric != null) return true;
  const vt = (result.valueText ?? '').trim();
  if (vt) return true;
  const report = (result.report ?? '').trim();
  if (report) return true;
  return false;
}

function componentNameMatchesExam(examName: string, componentName: string): boolean {
  const examKey = normalizeExamLabelKey(examName);
  const compKey = normalizeExamLabelKey(componentName);
  if (!examKey || !compKey) return false;
  if (examKey === compKey) return true;
  for (const alias of extractParentheticalAliases(examName)) {
    if (normalizeExamLabelKey(alias) === compKey) return true;
  }
  if (examKey.includes(compKey) || compKey.includes(examKey)) return true;
  return false;
}

/**
 * Quando há um único subitem sinônimo do exame e o pai está vazio, promove o valor
 * para a linha principal (ex.: TTPa dentro de "Tempo de Tromboplastina... (TTPa)").
 */
export function collapseRedundantSingleComponent(
  examName: string,
  result: ComplementaryExamResult
): {
  result: ComplementaryExamResult;
  displayComponents: ComplementaryExamResultComponent[];
} {
  const comps = normalizeComplementaryResultComponents(result.components);
  if (comps.length !== 1 || resultHasMainValue(result)) {
    return { result, displayComponents: comps };
  }
  const sole = comps[0];
  if (!sole.name?.trim() || !componentNameMatchesExam(examName, sole.name)) {
    return { result, displayComponents: comps };
  }
  return {
    result: {
      ...result,
      valueNumeric: sole.valueNumeric ?? result.valueNumeric,
      valueText: sole.valueText ?? result.valueText,
      unit: sole.unit ?? result.unit,
      referenceRange: sole.referenceRange ?? result.referenceRange,
      isAbnormal: sole.isAbnormal ?? result.isAbnormal,
    },
    displayComponents: [],
  };
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
  return exam.results.some((r) => {
    const { displayComponents } = collapseRedundantSingleComponent(exam.name, r);
    return displayComponents.length > 0;
  });
}

/** Nomes únicos estáveis (chave case-insensitive, rótulo preserva primeira grafia vista). */
export function collectUniqueComponentNames(exam: ComplementaryExam): string[] {
  const byKey = new Map<string, string>();
  for (const r of exam.results) {
    const { displayComponents } = collapseRedundantSingleComponent(exam.name, r);
    for (const c of displayComponents) {
      const raw = c.name?.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, raw);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function findComponentInResult(
  examName: string,
  result: ComplementaryExamResult,
  componentDisplayName: string
): ComplementaryExamResultComponent | undefined {
  const want = componentDisplayName.trim().toLowerCase();
  const { displayComponents } = collapseRedundantSingleComponent(examName, result);
  return displayComponents.find(
    (c) => c.name && c.name.trim().toLowerCase() === want
  );
}

export function buildParentNumericChartPoints(
  results: ComplementaryExamResult[],
  examName?: string
): ComplementaryExamChartPoint[] {
  return results
    .map((r) =>
      examName ? collapseRedundantSingleComponent(examName, r).result : r
    )
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
  componentDisplayName: string,
  examName?: string
): ComplementaryExamChartPoint[] {
  const want = componentDisplayName.trim().toLowerCase();
  return results
    .map((r) => {
      const { displayComponents } = examName
        ? collapseRedundantSingleComponent(examName, r)
        : {
            displayComponents: normalizeComplementaryResultComponents(r.components),
          };
      const c = displayComponents.find(
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
    const { displayComponents } = collapseRedundantSingleComponent(exam.name, r);
    const c = displayComponents.find(
      (x) => x.name && x.name.trim().toLowerCase() === want
    );
    if (c?.unit?.trim()) return c.unit.trim();
  }
  return exam.unit?.trim() ?? null;
}
