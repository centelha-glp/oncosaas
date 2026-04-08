import {
  parseNumericReferenceRange,
  computeIsAbnormalFromRange,
  enrichComponentsWithAbnormal,
} from './reference-range.util';

describe('parseNumericReferenceRange', () => {
  it('parses min-max with dot', () => {
    expect(parseNumericReferenceRange('4.5-5.5')).toEqual({
      min: 4.5,
      max: 5.5,
    });
  });

  it('parses min-max with comma and spaces', () => {
    expect(parseNumericReferenceRange('4,5 - 5,5')).toEqual({
      min: 4.5,
      max: 5.5,
    });
  });

  it('uses first segment before semicolon', () => {
    expect(parseNumericReferenceRange('13-17 (M); 12-16 (F)')).toEqual({
      min: 13,
      max: 17,
    });
  });

  it('parses less-than upper bound', () => {
    const b = parseNumericReferenceRange('<2,0');
    expect(b).toEqual({ min: Number.NEGATIVE_INFINITY, max: 2 });
  });

  it('parses greater-than lower bound', () => {
    const b = parseNumericReferenceRange('>10');
    expect(b).toEqual({ min: 10, max: Number.POSITIVE_INFINITY });
  });

  it('returns null for empty or unparseable', () => {
    expect(parseNumericReferenceRange('')).toBeNull();
    expect(parseNumericReferenceRange('positivo')).toBeNull();
  });
});

describe('computeIsAbnormalFromRange', () => {
  it('flags outside inclusive range', () => {
    expect(computeIsAbnormalFromRange(4, '4.5-5.5')).toBe(true);
    expect(computeIsAbnormalFromRange(6, '4.5-5.5')).toBe(true);
    expect(computeIsAbnormalFromRange(5, '4.5-5.5')).toBe(false);
  });

  it('returns null without numeric value', () => {
    expect(computeIsAbnormalFromRange(undefined, '1-2')).toBeNull();
  });

  it('returns null without parseable range', () => {
    expect(computeIsAbnormalFromRange(5, 'ver texto')).toBeNull();
  });
});

describe('enrichComponentsWithAbnormal', () => {
  it('sets isAbnormal per row', () => {
    const out = enrichComponentsWithAbnormal([
      { name: 'Hb', referenceRange: '12-16', valueNumeric: 10 },
      { name: 'Ht', referenceRange: '36-46', valueNumeric: 40 },
    ]);
    expect(out).toHaveLength(2);
    expect(out![0].isAbnormal).toBe(true);
    expect(out![1].isAbnormal).toBe(false);
  });
});
