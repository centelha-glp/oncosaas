import { describe, expect, it } from 'vitest';
import {
  buildExamRequestPayload,
  prescriptionDraftFromHistoryRow,
  prescriptionDraftFromLineRow,
} from '../clinical-orders-payload';
import type { ClinicalPrescriptionLineRow } from '@/lib/api/clinical-note-orders';

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
        quantity: '1',
        dosage: 'comprimido',
        frequency: '1x/dia',
        route: 'VO',
        duration: '7 dias',
        observation: 'em jejum',
      })
    ).toMatchObject({
      medicationName: 'Omeprazol 20 mg',
      quantity: '1',
      observation: 'em jejum',
      route: 'VO',
    });
  });

  it('prescriptionDraftFromLineRow maps observation', () => {
    const row = {
      id: '1',
      clinicalNoteVersionNumber: 1,
      medicationName: 'AAS',
      catalogKey: null,
      presentationCatalogCode: null,
      quantity: '2',
      dosage: 'comprimidos',
      frequency: '12/12 h',
      route: 'VO',
      duration: '7 dias',
      observation: 'após refeição',
      prescribedBy: { id: 'u', name: 'Dr.' },
      createdAt: '',
      updatedAt: '',
    } satisfies ClinicalPrescriptionLineRow;
    expect(prescriptionDraftFromLineRow(row).observation).toBe('após refeição');
  });
});
