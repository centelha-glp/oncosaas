/**
 * Espelha a lógica de `backend/src/complementary-exams/reference-range.util.ts`
 * para pré-visualização no formulário antes do salvamento.
 */

export type InterpretationPreview = 'within' | 'outside' | 'unknown';

export function computeInterpretationPreview(
  valueNumeric: number | null | undefined,
  referenceRange: string | null | undefined,
): InterpretationPreview {
  const bounds = parseNumericReferenceRange(referenceRange);
  if (bounds == null || valueNumeric == null || Number.isNaN(valueNumeric)) {
    return 'unknown';
  }
  if (valueNumeric < bounds.min || valueNumeric > bounds.max) {
    return 'outside';
  }
  return 'within';
}

function parseLocaleNumberToken(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function parseNumericReferenceRange(
  ref: string | null | undefined,
): { min: number; max: number } | null {
  if (ref == null) return null;
  const raw = String(ref).trim();
  if (!raw) return null;

  const firstSegment = raw.split(';')[0].trim();
  const cleaned = firstSegment.replace(/\([^)]*\)/g, '').trim();
  if (!cleaned) return null;

  const rangeDash = cleaned.match(/^([\d.,\s]+)\s*[-–]\s*([\d.,\s]+)$/);
  if (rangeDash) {
    const min = parseLocaleNumberToken(rangeDash[1]);
    const max = parseLocaleNumberToken(rangeDash[2]);
    if (min != null && max != null && min <= max) {
      return { min, max };
    }
  }

  const lt = cleaned.match(/^[<≤]\s*([\d.,\s]+)$/);
  if (lt) {
    const max = parseLocaleNumberToken(lt[1]);
    if (max != null) {
      return { min: Number.NEGATIVE_INFINITY, max };
    }
  }

  const gt = cleaned.match(/^[>≥]\s*([\d.,\s]+)$/);
  if (gt) {
    const min = parseLocaleNumberToken(gt[1]);
    if (min != null) {
      return { min, max: Number.POSITIVE_INFINITY };
    }
  }

  return null;
}
