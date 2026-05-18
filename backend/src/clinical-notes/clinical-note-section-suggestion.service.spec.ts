import {
  ageYearsInTimeZone,
  formatComplementaryExamDisplayName,
} from './clinical-note-section-suggestion.service';

describe('formatComplementaryExamDisplayName', () => {
  it('inclui código TUSS/sigla quando code está preenchido', () => {
    expect(
      formatComplementaryExamDisplayName({
        name: 'Hemograma completo',
        code: '40304361',
        loincCode: '58410-2',
      })
    ).toBe('Hemograma completo (40304361)');
  });

  it('usa LOINC quando não há code', () => {
    expect(
      formatComplementaryExamDisplayName({
        name: 'Glicemia',
        code: null,
        loincCode: '2345-7',
      })
    ).toBe('Glicemia (LOINC 2345-7)');
  });

  it('retorna só o nome quando não há código nem LOINC', () => {
    expect(
      formatComplementaryExamDisplayName({
        name: 'Raio-X de tórax',
        code: undefined,
        loincCode: '',
      })
    ).toBe('Raio-X de tórax');
  });

  it('normaliza espaços e nome vazio vira "Exame"', () => {
    expect(
      formatComplementaryExamDisplayName({
        name: '   ',
        code: '  ABC  ',
      })
    ).toBe('Exame (ABC)');
  });
});

describe('ageYearsInTimeZone', () => {
  it('calcula idade no fuso America/Sao_Paulo', () => {
    const birth = new Date('1990-06-15T12:00:00.000Z');
    const ref = new Date('2026-06-14T12:00:00.000Z');
    expect(ageYearsInTimeZone(birth, ref, 'America/Sao_Paulo')).toBe(35);
  });

  it('ainda não fez aniversário no ano de referência', () => {
    const birth = new Date('1990-08-20T12:00:00.000Z');
    const ref = new Date('2026-06-10T12:00:00.000Z');
    expect(ageYearsInTimeZone(birth, ref, 'America/Sao_Paulo')).toBe(35);
  });
});
