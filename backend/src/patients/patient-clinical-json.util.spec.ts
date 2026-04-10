import { BadRequestException } from '@nestjs/common';
import {
  normalizeAllergyEntriesForStorage,
  formatStoredAllergyLine,
} from './patient-clinical-json.util';

describe('patient-clinical-json.util', () => {
  it('normalizeAllergyEntriesForStorage aceita lista vazia como undefined', () => {
    expect(normalizeAllergyEntriesForStorage([])).toBeUndefined();
  });

  it('rejeita substanceKey inválida', () => {
    expect(() =>
      normalizeAllergyEntriesForStorage([
        { substanceKey: 'NOT_IN_CATALOG', reactionNotes: 'x' },
      ]),
    ).toThrow(BadRequestException);
  });

  it('exige customLabel em OTHER', () => {
    expect(() =>
      normalizeAllergyEntriesForStorage([
        { substanceKey: 'OTHER', reactionNotes: 'x' },
      ]),
    ).toThrow(BadRequestException);
  });

  it('formata linha de alergia com catálogo', () => {
    const line = formatStoredAllergyLine({
      substanceKey: 'PENICILLIN',
      reactionNotes: 'urticária',
    });
    expect(line).toContain('Penicilinas');
    expect(line).toContain('urticária');
  });
});
