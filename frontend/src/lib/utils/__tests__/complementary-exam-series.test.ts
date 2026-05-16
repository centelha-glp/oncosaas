import { describe, expect, it } from 'vitest';
import {
  buildComponentNumericChartPoints,
  buildParentNumericChartPoints,
  collectUniqueComponentNames,
  examHasPanelComponents,
  filterActiveComplementaryResults,
  findComponentInResult,
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
    expect(findComponentInResult(result, 'alt')?.valueNumeric).toBe(42);
    expect(findComponentInResult(result, 'AST')).toBeUndefined();
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
