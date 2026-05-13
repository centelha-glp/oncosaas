import { describe, expect, it } from 'vitest';
import type { NavigationStep } from '@/lib/api/oncology-navigation';
import {
  filterNavigationStepsByEvolutionBaseKey,
  sortNavigationStepsForEvolutionPick,
} from '@/lib/utils/clinical-evolution-navigation';

function step(partial: Partial<NavigationStep> & { id: string }): NavigationStep {
  return {
    patientId: 'p1',
    cancerType: 'breast',
    journeyStage: 'SCREENING',
    stepKey: 'specialist_consultation',
    stepName: 'Consulta especializada',
    status: 'PENDING',
    isRequired: true,
    isCompleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('filterNavigationStepsByEvolutionBaseKey', () => {
  it('inclui etapas com sufixo -2, -3 na mesma família de chave', () => {
    const rows = [
      step({ id: 'a', stepKey: 'specialist_consultation', journeyStage: 'SCREENING' }),
      step({
        id: 'b',
        stepKey: 'specialist_consultation-2',
        journeyStage: 'SCREENING',
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
      step({ id: 'c', stepKey: 'colonoscopy', journeyStage: 'SCREENING' }),
    ];
    const r = filterNavigationStepsByEvolutionBaseKey(rows, 'specialist_consultation');
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });
});

describe('sortNavigationStepsForEvolutionPick', () => {
  it('prioriza etapas na fase atual do paciente', () => {
    const rows = [
      step({
        id: 'tr',
        journeyStage: 'TREATMENT',
        stepKey: 'specialist_consultation',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      step({
        id: 'sc',
        journeyStage: 'SCREENING',
        stepKey: 'specialist_consultation-2',
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
    ];
    const sorted = sortNavigationStepsForEvolutionPick(rows, 'SCREENING');
    expect(sorted.map((s) => s.id)).toEqual(['sc', 'tr']);
  });

  it('na mesma fase, ordena por createdAt', () => {
    const rows = [
      step({
        id: 'second',
        journeyStage: 'SCREENING',
        stepKey: 'specialist_consultation-2',
        createdAt: '2026-01-05T00:00:00.000Z',
      }),
      step({
        id: 'first',
        journeyStage: 'SCREENING',
        stepKey: 'specialist_consultation',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ];
    const sorted = sortNavigationStepsForEvolutionPick(rows, 'SCREENING');
    expect(sorted.map((s) => s.id)).toEqual(['first', 'second']);
  });
});
