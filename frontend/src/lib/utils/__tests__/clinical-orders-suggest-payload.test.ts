import { describe, expect, it } from 'vitest';
import {
  examRequestPayloadFromSuggestion,
  prescriptionLineBodyFromSuggestion,
} from '../clinical-orders-payload';

describe('clinical-orders-suggest-payload', () => {
  it('examRequestPayloadFromSuggestion maps codes', () => {
    expect(
      examRequestPayloadFromSuggestion({
        display_name: 'Hemograma',
        code: '40304361',
        request_source: 'explicit',
      })
    ).toEqual({
      displayName: 'Hemograma',
      code: '40304361',
      examCatalogCode: '40304361',
    });
  });

  it('prescriptionLineBodyFromSuggestion fills required fields', () => {
    expect(
      prescriptionLineBodyFromSuggestion({
        medication_name: 'Omeprazol',
        route: 'VO',
        prescription_intent: 'NEW',
      })
    ).toMatchObject({
      medicationName: 'Omeprazol',
      route: 'VO',
      quantity: '1',
    });
  });
});
