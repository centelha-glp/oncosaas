import {
  CANONICAL_GROUP_RENAL_CREAT_ETFG,
  CANONICAL_GROUP_VIT_D_25OH,
  preferredDisplayNameForGroup,
  resolveCanonicalExamGroupId,
} from './complementary-exam-canonical.util';

describe('complementary-exam-canonical.util', () => {
  it('agrupa creatinina e dosagem com eTFG em RENAL_CREAT_ETFG', () => {
    const renal = `CANON|${CANONICAL_GROUP_RENAL_CREAT_ETFG}`;
    expect(
      resolveCanonicalExamGroupId('LABORATORY', 'Creatinina', 'CREAT')
    ).toBe(renal);
    expect(
      resolveCanonicalExamGroupId(
        'LABORATORY',
        'Dosagem de Creatinina com eTFG'
      )
    ).toBe(renal);
  });

  it('mantém eTFG/eGFR isolados fora do grupo de creatinina', () => {
    const renal = `CANON|${CANONICAL_GROUP_RENAL_CREAT_ETFG}`;
    expect(resolveCanonicalExamGroupId('LABORATORY', 'eTFG')).not.toBe(renal);
    expect(resolveCanonicalExamGroupId('LABORATORY', 'eGFR')).not.toBe(renal);
    expect(
      resolveCanonicalExamGroupId('LABORATORY', 'Taxa de filtração glomerular')
    ).not.toBe(renal);
  });

  it('exclui creatinina urinária do grupo renal', () => {
    expect(
      resolveCanonicalExamGroupId(
        'LABORATORY',
        'Creatinina urinária',
        'CREAT-U'
      )
    ).not.toBe(`CANON|${CANONICAL_GROUP_RENAL_CREAT_ETFG}`);
    expect(
      resolveCanonicalExamGroupId(
        'LABORATORY',
        'Creatinina urina 24h',
        'CREAT-24H'
      )
    ).not.toBe(`CANON|${CANONICAL_GROUP_RENAL_CREAT_ETFG}`);
  });

  it('agrupa sinónimos de vitamina D 25-OH', () => {
    const vit = `CANON|${CANONICAL_GROUP_VIT_D_25OH}`;
    expect(
      resolveCanonicalExamGroupId('LABORATORY', 'Vitamina D 25(OH)D')
    ).toBe(vit);
    expect(
      resolveCanonicalExamGroupId('LABORATORY', '25-Hidroxi-Vitamina D')
    ).toBe(vit);
  });

  it('usa LOINC quando presente e regra canónica não aplicou', () => {
    expect(
      resolveCanonicalExamGroupId('LABORATORY', 'Hemoglobina', 'Hb', '718-7')
    ).toBe('LOINC|7187');
  });

  it('fallback NAME normaliza acentos e caixa', () => {
    const a = resolveCanonicalExamGroupId('LABORATORY', 'TSH');
    const b = resolveCanonicalExamGroupId('LABORATORY', 'tsh');
    expect(a).toBe(b);
    expect(a).toBe('NAME|tsh');
  });

  it('preferredDisplayNameForGroup devolve rótulos canónicos', () => {
    expect(
      preferredDisplayNameForGroup(
        `CANON|${CANONICAL_GROUP_RENAL_CREAT_ETFG}`,
        'Dosagem de Creatinina com eTFG'
      )
    ).toBe('Creatinina');
    expect(
      preferredDisplayNameForGroup(
        `CANON|${CANONICAL_GROUP_VIT_D_25OH}`,
        '25-Hidroxi-Vitamina D'
      )
    ).toBe('Vitamina D 25-OH');
    expect(preferredDisplayNameForGroup('NAME|tsh', 'TSH')).toBe('TSH');
  });
});
