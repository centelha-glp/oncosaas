/**
 * Interpretação best-effort de faixas de referência em texto (laboratório BR).
 * Formatos suportados: "4.5-5.5", "4,5 - 5,5", "<2", ">10", "≤5", "≥3".
 * Trechos após ";" (ex.: faixas por sexo) usam apenas o primeiro segmento.
 */

export interface ParsedReferenceBounds {
  min: number;
  max: number;
}

/**
 * Normaliza token numérico em estilo BR antes de parseFloat:
 * - vírgula decimal (ex.: 4,5 ou 1.234,56)
 * - ponto como milhar sem vírgula (ex.: 4.500, 11.000, 1.234.567)
 * Evita que "4.500" vire 4.5 (comportamento de parseFloat em JS).
 */
export function normalizeLocaleNumberToken(raw: string): string {
  const t = raw.replace(/\s/g, '');
  if (!t) {
    return t;
  }

  const lastComma = t.lastIndexOf(',');
  if (lastComma !== -1) {
    const after = t.slice(lastComma + 1);
    if (/^\d{1,2}$/.test(after)) {
      const intPart = t.slice(0, lastComma).replace(/\./g, '');
      return `${intPart}.${after}`;
    }
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(t) && !/^0\.\d{3}$/.test(t)) {
    return t.replace(/\./g, '');
  }

  return t.replace(',', '.');
}

function parseLocaleNumberToken(s: string): number | null {
  const normalized = normalizeLocaleNumberToken(s);
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parseNumericReferenceRange(
  ref: string | null | undefined,
): ParsedReferenceBounds | null {
  if (ref === null || ref === undefined) {
    return null;
  }
  const raw = String(ref).trim();
  if (!raw) {
    return null;
  }

  const firstSegment = raw.split(';')[0].trim();
  const cleaned = firstSegment.replace(/\([^)]*\)/g, '').trim();
  if (!cleaned) {
    return null;
  }

  const rangeDash = cleaned.match(/^([\d.,\s]+)\s*[-–]\s*([\d.,\s]+)$/);
  if (rangeDash) {
    const min = parseLocaleNumberToken(rangeDash[1]);
    const max = parseLocaleNumberToken(rangeDash[2]);
    if (min !== null && max !== null && min <= max) {
      return { min, max };
    }
  }

  const lt = cleaned.match(/^[<≤]\s*([\d.,\s]+)$/);
  if (lt) {
    const max = parseLocaleNumberToken(lt[1]);
    if (max !== null) {
      return { min: Number.NEGATIVE_INFINITY, max };
    }
  }

  const gt = cleaned.match(/^[>≥]\s*([\d.,\s]+)$/);
  if (gt) {
    const min = parseLocaleNumberToken(gt[1]);
    if (min !== null) {
      return { min, max: Number.POSITIVE_INFINITY };
    }
  }

  return null;
}

/**
 * @returns true = fora da faixa, false = dentro, null = não aplicável (sem valor ou faixa não interpretável)
 */
export function computeIsAbnormalFromRange(
  valueNumeric: number | null | undefined,
  referenceRange: string | null | undefined,
): boolean | null {
  if (
    valueNumeric === null ||
    valueNumeric === undefined ||
    Number.isNaN(valueNumeric)
  ) {
    return null;
  }
  const bounds = parseNumericReferenceRange(referenceRange);
  if (!bounds) {
    return null;
  }
  if (valueNumeric < bounds.min || valueNumeric > bounds.max) {
    return true;
  }
  return false;
}

export interface ExamResultComponentInput {
  name: string;
  valueNumeric?: number;
  valueText?: string;
  unit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
}

export function enrichComponentsWithAbnormal<T extends ExamResultComponentInput>(
  components: T[] | undefined,
): Array<T & { isAbnormal: boolean }> | undefined {
  if (!components?.length) {
    return undefined;
  }

  return components.map((c) => {
    const computed = computeIsAbnormalFromRange(
      c.valueNumeric,
      c.referenceRange,
    );
    const isAbnormal =
      computed !== null ? computed : (c.isAbnormal ?? false);
    return { ...c, isAbnormal };
  });
}
