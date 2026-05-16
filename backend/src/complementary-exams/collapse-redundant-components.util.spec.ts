import {
  collapseRedundantComponentsForSave,
  extractParentheticalAliases,
  normalizeExamLabelKey,
} from './collapse-redundant-components.util';

describe('collapse-redundant-components.util', () => {
  it('normalizeExamLabelKey remove acentos e pontuação', () => {
    expect(normalizeExamLabelKey('TTPa (ativo)')).toBe('ttpaativo');
  });

  it('extractParentheticalAliases lê sigla entre parênteses', () => {
    expect(
      extractParentheticalAliases('Tempo de Tromboplastina Parcial Ativado (TTPa)'),
    ).toEqual(['TTPa']);
  });

  it('promove TTPa sinônimo para campos do resultado pai', () => {
    const out = collapseRedundantComponentsForSave(
      'Tempo de Tromboplastina Parcial Ativado (TTPa)',
      {
        valueNumeric: null,
        valueText: null,
        unit: null,
        referenceRange: null,
        components: [
          {
            name: 'TTPa',
            valueNumeric: 28.7,
            unit: 'seg',
            referenceRange: '25,4 a 33,4',
          },
        ],
      },
    );
    expect(out.valueNumeric).toBe(28.7);
    expect(out.unit).toBe('seg');
    expect(out.referenceRange).toBe('25,4 a 33,4');
    expect(out.components).toBeUndefined();
  });

  it('não colapsa painel com vários componentes', () => {
    const out = collapseRedundantComponentsForSave('Hemograma completo', {
      valueNumeric: null,
      components: [
        { name: 'Hb', valueNumeric: 13 },
        { name: 'Leucócitos', valueNumeric: 8000 },
      ],
    });
    expect(out.components).toHaveLength(2);
    expect(out.valueNumeric).toBeNull();
  });

  it('não colapsa quando o pai já tem valueNumeric', () => {
    const components = [{ name: 'ALT', valueNumeric: 45 }];
    const out = collapseRedundantComponentsForSave('Hemograma', {
      valueNumeric: 14,
      components,
    });
    expect(out.valueNumeric).toBe(14);
    expect(out.components).toEqual(components);
  });
});
