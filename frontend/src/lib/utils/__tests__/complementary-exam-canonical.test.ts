import { describe, expect, it } from 'vitest';
import {
  CANONICAL_GROUP_RENAL_CREATININE,
  CANONICAL_GROUP_RENAL_ETFG,
  preferredDisplayNameForGroup,
  resolveCanonicalExamGroupId,
} from '../complementary-exam-canonical';

describe('complementary-exam-canonical', () => {
  it('separa creatinina sérica de eTFG/eGFR', () => {
    const creatinine = `CANON|${CANONICAL_GROUP_RENAL_CREATININE}`;
    const etfg = `CANON|${CANONICAL_GROUP_RENAL_ETFG}`;

    expect(resolveCanonicalExamGroupId('LABORATORY', 'Creatinina', 'CREAT')).toBe(
      creatinine
    );
    expect(resolveCanonicalExamGroupId('LABORATORY', 'eTFG')).toBe(etfg);
    expect(resolveCanonicalExamGroupId('LABORATORY', 'eGFR')).toBe(etfg);
    expect(
      resolveCanonicalExamGroupId('LABORATORY', 'Dosagem de Creatinina com eTFG')
    ).toBe(etfg);
  });

  it('mantém creatinina urinária fora da creatinina sérica', () => {
    const creatinine = `CANON|${CANONICAL_GROUP_RENAL_CREATININE}`;

    expect(
      resolveCanonicalExamGroupId('LABORATORY', 'Creatinina urinária', 'CREAT-U')
    ).not.toBe(creatinine);
    expect(
      resolveCanonicalExamGroupId('LABORATORY', 'Creatinina urina 24h', 'CREAT-24H')
    ).not.toBe(creatinine);
  });

  it('usa nomes preferidos distintos para grupos renais', () => {
    expect(
      preferredDisplayNameForGroup(
        `CANON|${CANONICAL_GROUP_RENAL_CREATININE}`,
        'Creat'
      )
    ).toBe('Creatinina');
    expect(
      preferredDisplayNameForGroup(`CANON|${CANONICAL_GROUP_RENAL_ETFG}`, 'eGFR')
    ).toBe('eTFG');
  });
});
