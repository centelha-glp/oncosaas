import { ageYearsInTimeZone } from './clinical-note-section-suggestion.service';

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
