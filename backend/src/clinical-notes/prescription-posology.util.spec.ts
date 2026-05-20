import {
  buildPrescriptionPosology,
  getPrescriptionPosologyVerb,
  isContinuousPrescriptionDuration,
} from './prescription-posology.util';

describe('prescription-posology.util', () => {
  it('getPrescriptionPosologyVerb maps routes', () => {
    expect(getPrescriptionPosologyVerb('VO')).toBe('tomar');
    expect(getPrescriptionPosologyVerb('sl')).toBe('tomar');
    expect(getPrescriptionPosologyVerb('INH')).toBe('inalar');
    expect(getPrescriptionPosologyVerb('IV')).toBe('aplicar');
  });

  it('buildPrescriptionPosology for finite duration', () => {
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

  it('buildPrescriptionPosology for continuous use', () => {
    expect(
      buildPrescriptionPosology({
        route: 'INH',
        quantity: '2',
        dosage: 'jatos',
        frequency: '4/4 horas',
        duration: 'contínua',
      })
    ).toBe('inalar 2 jatos de 4/4 horas, uso contínuo');
    expect(isContinuousPrescriptionDuration('Contínua')).toBe(true);
  });
});
