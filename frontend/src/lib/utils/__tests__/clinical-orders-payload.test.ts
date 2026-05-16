import { describe, expect, it } from 'vitest';
import {
  buildExamRequestPayload,
  prescriptionDraftFromHistoryRow,
} from '../clinical-orders-payload';

describe('clinical-orders-payload', () => {
  it('buildExamRequestPayload uses catalog when selected', () => {
    expect(
      buildExamRequestPayload({
        displayName: 'Hemograma',
        catalogSelection: {
          displayName: 'Hemograma completo',
          code: '40304361',
          examCatalogCode: '40304361',
        },
      })
    ).toEqual({
      displayName: 'Hemograma completo',
      code: '40304361',
      examCatalogCode: '40304361',
    });
  });

  it('buildExamRequestPayload free text only displayName', () => {
    expect(
      buildExamRequestPayload({
        displayName: '  Raio X tórax  ',
        catalogSelection: null,
      })
    ).toEqual({ displayName: 'Raio X tórax' });
  });

  it('prescriptionDraftFromHistoryRow maps fields', () => {
    expect(
      prescriptionDraftFromHistoryRow({
        medicationName: 'Omeprazol 20 mg',
        catalogKey: 'OMEPRAZOLE',
        presentationCatalogCode: 'OMEPRAZOLE_20MG_CP',
        dosage: '1 cp',
        frequency: '1x/dia',
        route: 'VO',
        duration: null,
        indication: null,
      })
    ).toMatchObject({
      medicationName: 'Omeprazol 20 mg',
      catalogKey: 'OMEPRAZOLE',
      presentationCatalogCode: 'OMEPRAZOLE_20MG_CP',
      route: 'VO',
    });
  });
});
