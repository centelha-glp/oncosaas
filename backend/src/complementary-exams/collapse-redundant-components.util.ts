import type { ExamResultComponentInput } from './reference-range.util';

export function normalizeExamLabelKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function extractParentheticalAliases(examName: string): string[] {
  const aliases: string[] = [];
  const re = /\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(examName)) !== null) {
    const inner = m[1].trim();
    if (inner) {aliases.push(inner);}
  }
  return aliases;
}

function parseComponents(raw: unknown): ExamResultComponentInput[] {
  if (raw === null || raw === undefined) {
    return [];
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) {return [];}
    try {
      return parseComponents(JSON.parse(t) as unknown);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) {return [];}
  const out: ExamResultComponentInput[] = [];
  for (const el of raw) {
    if (!el || typeof el !== 'object' || Array.isArray(el)) {continue;}
    const o = el as Record<string, unknown>;
    const nameRaw = o.name;
    if (typeof nameRaw !== 'string' || !nameRaw.trim()) {continue;}
    const vn = o.valueNumeric ?? o.value_numeric;
    let valueNumeric: number | undefined;
    if (vn !== null && vn !== undefined && vn !== '') {
      if (typeof vn === 'number' && Number.isFinite(vn)) {
        valueNumeric = vn;
      } else {
        const n = Number(vn);
        if (Number.isFinite(n)) {valueNumeric = n;}
      }
    }
    const vt = o.valueText ?? o.value_text;
    const u = o.unit;
    const rr = o.referenceRange ?? o.reference_range;
    const ia = o.isAbnormal ?? o.is_abnormal;
    out.push({
      name: nameRaw.trim(),
      valueNumeric,
      valueText:
        vt === null || vt === undefined
          ? undefined
          : String(vt).trim().slice(0, 8000) || undefined,
      unit:
        u === null || u === undefined
          ? undefined
          : String(u).trim().slice(0, 64) || undefined,
      referenceRange:
        rr === null || rr === undefined
          ? undefined
          : String(rr).trim().slice(0, 200) || undefined,
      isAbnormal: typeof ia === 'boolean' ? ia : undefined,
    });
  }
  return out;
}

function resultHasMainValue(fields: {
  valueNumeric?: number | null;
  valueText?: string | null;
  report?: string | null;
}): boolean {
  if (
    fields.valueNumeric !== null &&
    fields.valueNumeric !== undefined &&
    !Number.isNaN(fields.valueNumeric)
  ) {
    return true;
  }
  if ((fields.valueText ?? '').trim()) {return true;}
  if ((fields.report ?? '').trim()) {return true;}
  return false;
}

function componentNameMatchesExam(
  examName: string,
  componentName: string,
): boolean {
  const examKey = normalizeExamLabelKey(examName);
  const compKey = normalizeExamLabelKey(componentName);
  if (!examKey || !compKey) {return false;}
  if (examKey === compKey) {return true;}
  for (const alias of extractParentheticalAliases(examName)) {
    if (normalizeExamLabelKey(alias) === compKey) {return true;}
  }
  if (examKey.includes(compKey) || compKey.includes(examKey)) {return true;}
  return false;
}

export interface CollapsibleExamResultFields {
  valueNumeric?: number | null;
  valueText?: string | null;
  unit?: string | null;
  referenceRange?: string | null;
  isAbnormal?: boolean | null;
  report?: string | null;
  components?: unknown;
}

/**
 * Promove único subitem sinônimo do exame para campos do resultado pai antes de persistir.
 */
export function collapseRedundantComponentsForSave(
  examName: string,
  fields: CollapsibleExamResultFields,
): CollapsibleExamResultFields {
  const comps = parseComponents(fields.components);
  if (comps.length !== 1 || resultHasMainValue(fields)) {
    return fields;
  }
  const sole = comps[0];
  if (!sole.name?.trim() || !componentNameMatchesExam(examName, sole.name)) {
    return fields;
  }
  return {
    ...fields,
    valueNumeric: sole.valueNumeric ?? fields.valueNumeric ?? null,
    valueText: sole.valueText ?? fields.valueText ?? null,
    unit: sole.unit ?? fields.unit ?? null,
    referenceRange: sole.referenceRange ?? fields.referenceRange ?? null,
    isAbnormal:
      typeof sole.isAbnormal === 'boolean'
        ? sole.isAbnormal
        : (fields.isAbnormal ?? null),
    components: undefined,
  };
}
