import { describe, expect, it } from 'vitest';
import { buildPrescriptionPosology } from '../prescription-posology';

describe('prescription-posology', () => {
  it('builds oral posology', () => {
    expect(
      buildPrescriptionPosology({
        route: 'VO',
        quantity: '2',
        dosage: 'comprimidos',
        frequency: '12/12 horas',
        duration: '7 dias',
      })
    ).toBe('tomar 2 comprimidos de 12/12 horas por 7 dias');
  });

  it('builds continuous inhalation posology', () => {
    expect(
      buildPrescriptionPosology({
        route: 'INH',
        quantity: '2',
        dosage: 'jatos',
        frequency: '4/4 horas',
        duration: 'contínua',
      })
    ).toBe('inalar 2 jatos de 4/4 horas, uso contínuo');
  });
});
