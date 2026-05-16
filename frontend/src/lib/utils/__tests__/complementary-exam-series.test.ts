import { describe, expect, it } from 'vitest';
import {
  buildComponentNumericChartPoints,
  buildComplementaryExamMatchKey,
  buildParentNumericChartPoints,
  collapseRedundantSingleComponent,
  collectUniqueComponentNames,
  dedupeResultsByPerformedInstant,
  examHasPanelComponents,
  filterActiveComplementaryResults,
  findComponentInResult,
  formatComplementaryResultPerformedAt,
  groupComplementaryExamsByName,
  guessComponentUnit,
  normalizeComplementaryResultComponents,
} from '../complementary-exam-series';
import type { ComplementaryExam, ComplementaryExamResult } from '@/lib/api/patients';

const baseExam = (): ComplementaryExam => ({
  id: 'e1',
  tenantId: 't1',
  patientId: 'p1',
  type: 'LABORATORY',
  name: 'Painel',
  code: null,
  loincCode: null,
  labCategory: 'OTHER',
  isCriticalMetric: false,
  specimen: null,
  unit: 'g/L',
  referenceRange: null,
  results: [],
});

describe('complementary-exam-series', () => {
  it('buildComplementaryExamMatchKey normaliza nome e código', () => {
    expect(
      buildComplementaryExamMatchKey('LABORATORY', 'Hemoglobina', 'Hb')
    ).toBe(buildComplementaryExamMatchKey('LABORATORY', 'hemoglobina', 'hb'));
  });

  it('dedupeResultsByPerformedInstant remove só mesmo ms', () => {
    const t = '2025-03-10T08:00:00.000Z';
    const rows = dedupeResultsByPerformedInstant([
      {
        id: 'a',
        performedAt: t,
        collectionId: null,
        valueNumeric: 1,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
      },
      {
        id: 'b',
        performedAt: t,
        collectionId: null,
        valueNumeric: 2,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
      },
      {
        id: 'c',
        performedAt: '2025-03-10T18:00:00.000Z',
        collectionId: null,
        valueNumeric: 3,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('groupComplementaryExamsByName funde exames legados duplicados', () => {
    const e1 = baseExam();
    e1.id = 'legacy-1';
    e1.name = 'Creatinina';
    e1.results = [
      {
        id: 'r1',
        performedAt: '2025-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: 1,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
      },
    ];
    const e2 = baseExam();
    e2.id = 'legacy-2';
    e2.name = 'creatinina';
    e2.results = [
      {
        id: 'r2',
        performedAt: '2025-02-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: 1.1,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
      },
    ];
    const grouped = groupComplementaryExamsByName([e1, e2]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.results).toHaveLength(2);
  });

  it('formatComplementaryResultPerformedAt inclui hora se >1 no mesmo dia', () => {
    const results = [
      {
        id: 'r1',
        performedAt: '2025-03-10T08:00:00.000Z',
        collectionId: null,
        valueNumeric: 1,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
      },
      {
        id: 'r2',
        performedAt: '2025-03-10T18:00:00.000Z',
        collectionId: null,
        valueNumeric: 2,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
      },
    ];
    expect(formatComplementaryResultPerformedAt(results, results[0]!.performedAt)).toBe(
      '10/03/2025 08:00'
    );
    expect(formatComplementaryResultPerformedAt(results, '2025-04-01T00:00:00.000Z')).toBe(
      '01/04/2025'
    );
  });

  it('normalizeComplementaryResultComponents aceita string JSON (hemograma-like)', () => {
    const json = JSON.stringify([
      { name: 'Hb', value_numeric: 12.5, unit: 'g/dL' },
      { name: 'Leucócitos', valueNumeric: 8000, unit: '/mm³' },
    ]);
    const rows = normalizeComplementaryResultComponents(json);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: 'Hb', valueNumeric: 12.5, unit: 'g/dL' });
    expect(rows[1]).toMatchObject({ name: 'Leucócitos', valueNumeric: 8000 });
  });

  it('normalizeComplementaryResultComponents ignora JSON inválido ou não-array', () => {
    expect(normalizeComplementaryResultComponents('{no')).toEqual([]);
    expect(normalizeComplementaryResultComponents({ foo: 1 })).toEqual([]);
    expect(normalizeComplementaryResultComponents(null)).toEqual([]);
  });

  it('examHasPanelComponents detecta subitens em string JSON', () => {
    const e = baseExam();
    e.results = [
      {
        id: 'r1',
        performedAt: '2024-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: null,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
        components: JSON.stringify([{ name: 'ALT', valueNumeric: 20 }]) as unknown as NonNullable<
          ComplementaryExamResult['components']
        >,
      },
    ];
    expect(examHasPanelComponents(e)).toBe(true);
    expect(collectUniqueComponentNames(e)).toEqual(['ALT']);
  });

  it('filterActiveComplementaryResults remove deletedAt', () => {
    const r = filterActiveComplementaryResults([
      {
        id: 'a',
        performedAt: '2024-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: 1,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
        deletedAt: null,
      },
      {
        id: 'b',
        performedAt: '2024-02-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: 2,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
        deletedAt: '2024-03-01T00:00:00.000Z',
      },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.id).toBe('a');
  });

  it('examHasPanelComponents', () => {
    const e = baseExam();
    expect(examHasPanelComponents(e)).toBe(false);
    e.results = [
      {
        id: 'r1',
        performedAt: '2024-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: null,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
        components: [{ name: 'ALT', valueNumeric: 20 }],
      },
    ];
    expect(examHasPanelComponents(e)).toBe(true);
  });

  it('collectUniqueComponentNames ignora nome vazio ou só espaços', () => {
    const e = baseExam();
    e.results = [
      {
        id: 'r1',
        performedAt: '2024-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: null,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
        components: [{ name: '  ' }, { name: 'Válido' }],
      },
    ];
    expect(collectUniqueComponentNames(e)).toEqual(['Válido']);
  });

  it('collectUniqueComponentNames dedup case-insensitive', () => {
    const e = baseExam();
    e.results = [
      {
        id: 'r1',
        performedAt: '2024-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: null,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
        components: [
          { name: 'ALT' },
          { name: 'alt' },
          { name: 'AST', valueNumeric: 1 },
        ],
      },
    ];
    expect(collectUniqueComponentNames(e)).toEqual(['ALT', 'AST']);
  });

  it('findComponentInResult case-insensitive e trim', () => {
    const result = {
      id: 'r1',
      performedAt: '2024-01-01T00:00:00.000Z',
      collectionId: null,
      valueNumeric: null,
      valueText: null,
      unit: null,
      referenceRange: null,
      isAbnormal: null,
      criticalHigh: null,
      criticalLow: null,
      report: null,
      components: [{ name: '  ALT  ', valueNumeric: 42 }],
    };
    expect(findComponentInResult('Painel', result, 'alt')?.valueNumeric).toBe(42);
    expect(findComponentInResult('Painel', result, 'AST')).toBeUndefined();
  });

  it('collapseRedundantSingleComponent promove TTPa sinônimo para linha principal', () => {
    const examName = 'Tempo de Tromboplastina Parcial Ativado (TTPa)';
    const raw = {
      id: 'r-ttpa',
      performedAt: '2023-10-17T00:00:00.000Z',
      collectionId: null,
      valueNumeric: null,
      valueText: null,
      unit: null,
      referenceRange: null,
      isAbnormal: null,
      criticalHigh: null,
      criticalLow: null,
      report: null,
      components: [
        {
          name: 'TTPa',
          valueNumeric: 28.7,
          unit: 'seg',
          referenceRange: '25,4 a 33,4',
        },
      ],
    };
    const { result, displayComponents } = collapseRedundantSingleComponent(
      examName,
      raw
    );
    expect(displayComponents).toHaveLength(0);
    expect(result.valueNumeric).toBe(28.7);
    expect(result.unit).toBe('seg');
    expect(result.referenceRange).toBe('25,4 a 33,4');
  });

  it('collapseRedundantSingleComponent não colapsa hemograma com vários subitens', () => {
    const raw = {
      id: 'r-hem',
      performedAt: '2024-01-01T00:00:00.000Z',
      collectionId: null,
      valueNumeric: null,
      valueText: null,
      unit: null,
      referenceRange: null,
      isAbnormal: null,
      criticalHigh: null,
      criticalLow: null,
      report: null,
      components: [
        { name: 'Hb', valueNumeric: 13.2 },
        { name: 'Leucócitos', valueNumeric: 8000 },
      ],
    };
    const { displayComponents } = collapseRedundantSingleComponent(
      'Hemograma completo',
      raw
    );
    expect(displayComponents).toHaveLength(2);
  });

  it('collapseRedundantSingleComponent não colapsa quando pai já tem valor', () => {
    const raw = {
      id: 'r1',
      performedAt: '2024-06-15T12:00:00.000Z',
      collectionId: null,
      valueNumeric: 14,
      valueText: null,
      unit: 'g/dL',
      referenceRange: '12–16',
      isAbnormal: null,
      criticalHigh: null,
      criticalLow: null,
      report: null,
      components: [{ name: 'ALT', valueNumeric: 45, unit: 'U/L' }],
    };
    const { result, displayComponents } = collapseRedundantSingleComponent(
      'Hemograma',
      raw
    );
    expect(result.valueNumeric).toBe(14);
    expect(displayComponents).toHaveLength(1);
  });

  it('examHasPanelComponents false para exame simples com subitem sinônimo colapsável', () => {
    const e = baseExam();
    e.name = 'Tempo de Tromboplastina Parcial Ativado (TTPa)';
    e.results = [
      {
        id: 'r-ttpa',
        performedAt: '2023-10-17T00:00:00.000Z',
        collectionId: null,
        valueNumeric: null,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
        components: [{ name: 'TTPa', valueNumeric: 28.7, unit: 'seg' }],
      },
    ];
    expect(examHasPanelComponents(e)).toBe(false);
  });

  it('buildParentNumericChartPoints usa valor colapsado de subitem sinônimo', () => {
    const examName = 'Tempo de Tromboplastina Parcial Ativado (TTPa)';
    const pts = buildParentNumericChartPoints(
      [
        {
          id: 'r-ttpa',
          performedAt: '2023-10-17T00:00:00.000Z',
          collectionId: null,
          valueNumeric: null,
          valueText: null,
          unit: null,
          referenceRange: null,
          isAbnormal: null,
          criticalHigh: null,
          criticalLow: null,
          report: null,
          components: [{ name: 'TTPa', valueNumeric: 28.7 }],
        },
      ],
      examName
    );
    expect(pts).toHaveLength(1);
    expect(pts[0]?.value).toBe(28.7);
  });

  it('guessComponentUnit prefere unit do componente; fallback exam.unit', () => {
    const e = baseExam();
    e.unit = 'g/L';
    e.results = [
      {
        id: 'r1',
        performedAt: '2024-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: null,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
        components: [{ name: 'ALT', valueNumeric: 1, unit: '  U/L  ' }],
      },
    ];
    expect(guessComponentUnit(e, 'ALT')).toBe('U/L');
    const e2 = baseExam();
    e2.unit = '  mmol/L  ';
    e2.results = [
      {
        id: 'r1',
        performedAt: '2024-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: 5,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
        components: [{ name: 'ALT', valueNumeric: 1 }],
      },
    ];
    expect(guessComponentUnit(e2, 'ALT')).toBe('mmol/L');
  });

  it('guessComponentUnit retorna null sem unit no componente nem no exame', () => {
    const e = baseExam();
    e.unit = null;
    e.results = [
      {
        id: 'r1',
        performedAt: '2024-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: null,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
        components: [{ name: 'ALT', valueNumeric: 1 }],
      },
    ];
    expect(guessComponentUnit(e, 'ALT')).toBeNull();
  });

  it('buildParentNumericChartPoints', () => {
    const pts = buildParentNumericChartPoints([
      {
        id: 'r2',
        performedAt: '2024-02-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: 2,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
      },
      {
        id: 'r1',
        performedAt: '2024-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: 1,
        valueText: null,
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
      },
    ]);
    expect(pts.map((p) => p.value)).toEqual([1, 2]);
  });

  it('buildParentNumericChartPoints omite resultados sem valueNumeric', () => {
    const pts = buildParentNumericChartPoints([
      {
        id: 'r1',
        performedAt: '2024-01-01T00:00:00.000Z',
        collectionId: null,
        valueNumeric: null,
        valueText: 'positivo',
        unit: null,
        referenceRange: null,
        isAbnormal: null,
        criticalHigh: null,
        criticalLow: null,
        report: null,
      },
    ]);
    expect(pts).toHaveLength(0);
  });

  it('buildComponentNumericChartPoints omits dates sem número', () => {
    const pts = buildComponentNumericChartPoints(
      [
        {
          id: 'r1',
          performedAt: '2024-01-01T00:00:00.000Z',
          collectionId: null,
          valueNumeric: 99,
          valueText: null,
          unit: null,
          referenceRange: null,
          isAbnormal: null,
          criticalHigh: null,
          criticalLow: null,
          report: null,
          components: [{ name: 'ALT', valueNumeric: 10 }],
        },
        {
          id: 'r2',
          performedAt: '2024-02-01T00:00:00.000Z',
          collectionId: null,
          valueNumeric: null,
          valueText: null,
          unit: null,
          referenceRange: null,
          isAbnormal: null,
          criticalHigh: null,
          criticalLow: null,
          report: null,
          components: [{ name: 'ALT', valueText: 'positivo' }],
        },
      ],
      'ALT'
    );
    expect(pts).toHaveLength(1);
    expect(pts[0]!.value).toBe(10);
  });
});
