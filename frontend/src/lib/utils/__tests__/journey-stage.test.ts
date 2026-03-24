import { describe, it, expect } from 'vitest';
import {
  JOURNEY_STAGE_LABELS,
  JOURNEY_STAGE_ORDER,
  JOURNEY_STAGES,
  type JourneyStage,
} from '../journey-stage';

describe('JOURNEY_STAGES', () => {
  it('contains exactly 5 stages', () => {
    expect(JOURNEY_STAGES).toHaveLength(5);
  });

  it('contains the expected stages in order', () => {
    const expected: JourneyStage[] = [
      'SCREENING',
      'DIAGNOSIS',
      'TREATMENT',
      'FOLLOW_UP',
      'PALLIATIVE',
    ];
    expect([...JOURNEY_STAGES]).toEqual(expected);
  });
});

describe('JOURNEY_STAGE_LABELS', () => {
  it('has a non-empty Portuguese label for every stage', () => {
    JOURNEY_STAGES.forEach((stage) => {
      const label = JOURNEY_STAGE_LABELS[stage];
      expect(label, `missing label for stage ${stage}`).toBeTruthy();
      expect(typeof label).toBe('string');
    });
  });

  it('maps each stage to the correct Portuguese label', () => {
    expect(JOURNEY_STAGE_LABELS['SCREENING']).toBe('Rastreamento');
    expect(JOURNEY_STAGE_LABELS['DIAGNOSIS']).toBe('Diagnóstico');
    expect(JOURNEY_STAGE_LABELS['TREATMENT']).toBe('Tratamento');
    expect(JOURNEY_STAGE_LABELS['FOLLOW_UP']).toBe('Seguimento');
    expect(JOURNEY_STAGE_LABELS['PALLIATIVE']).toBe('Cuidados Paliativos');
  });
});

describe('JOURNEY_STAGE_ORDER', () => {
  it('has a numeric order value for every stage', () => {
    JOURNEY_STAGES.forEach((stage) => {
      expect(typeof JOURNEY_STAGE_ORDER[stage], `missing order for stage ${stage}`).toBe('number');
    });
  });

  it('defines a strictly ascending order: SCREENING < DIAGNOSIS < TREATMENT < FOLLOW_UP < PALLIATIVE', () => {
    expect(JOURNEY_STAGE_ORDER['SCREENING']).toBeLessThan(JOURNEY_STAGE_ORDER['DIAGNOSIS']);
    expect(JOURNEY_STAGE_ORDER['DIAGNOSIS']).toBeLessThan(JOURNEY_STAGE_ORDER['TREATMENT']);
    expect(JOURNEY_STAGE_ORDER['TREATMENT']).toBeLessThan(JOURNEY_STAGE_ORDER['FOLLOW_UP']);
    expect(JOURNEY_STAGE_ORDER['FOLLOW_UP']).toBeLessThan(JOURNEY_STAGE_ORDER['PALLIATIVE']);
  });

  it('all order values are unique', () => {
    const values = JOURNEY_STAGES.map((s) => JOURNEY_STAGE_ORDER[s]);
    const unique = new Set(values);
    expect(unique.size).toBe(JOURNEY_STAGES.length);
  });

  it('can be used to sort stages programmatically', () => {
    const shuffled: JourneyStage[] = ['PALLIATIVE', 'SCREENING', 'TREATMENT', 'DIAGNOSIS', 'FOLLOW_UP'];
    const sorted = [...shuffled].sort((a, b) => JOURNEY_STAGE_ORDER[a] - JOURNEY_STAGE_ORDER[b]);
    expect(sorted).toEqual(['SCREENING', 'DIAGNOSIS', 'TREATMENT', 'FOLLOW_UP', 'PALLIATIVE']);
  });
});
