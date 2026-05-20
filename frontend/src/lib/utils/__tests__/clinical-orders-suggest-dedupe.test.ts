import { describe, expect, it } from 'vitest';
import {
  isDuplicateExamSuggestion,
  isDuplicatePrescriptionSuggestion,
  normalizeClinicalOrderNameKey,
} from '../clinical-orders-suggest-dedupe';

describe('clinical-orders-suggest-dedupe', () => {
  it('normalizeClinicalOrderNameKey collapses whitespace and case', () => {
    expect(normalizeClinicalOrderNameKey('  Hemograma   Completo ')).toBe(
      'hemograma completo'
    );
  });

  it('isDuplicateExamSuggestion matches existing display names', () => {
    expect(
      isDuplicateExamSuggestion('Hemograma', [{ displayName: 'HEMOGRAMA' }])
    ).toBe(true);
    expect(
      isDuplicateExamSuggestion('Tomografia', [{ displayName: 'Hemograma' }])
    ).toBe(false);
  });

  it('isDuplicatePrescriptionSuggestion matches medication names', () => {
    expect(
      isDuplicatePrescriptionSuggestion('Omeprazol 20 mg', [
        { medicationName: 'omeprazol 20 mg' },
      ])
    ).toBe(true);
    expect(
      isDuplicatePrescriptionSuggestion('', [{ medicationName: 'AAS' }])
    ).toBe(true);
  });
});
