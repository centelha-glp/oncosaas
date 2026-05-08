import { describe, expect, it } from 'vitest';
import {
  formatNavigationStepDateBr,
  NAVIGATION_STEP_UI_DATE_LABEL,
} from '@/lib/utils/navigation-step-dates';

describe('navigation-step-dates', () => {
  it('expõe rótulos de UI estáveis para as três dimensões de data', () => {
    expect(NAVIGATION_STEP_UI_DATE_LABEL.agendada).toBe('Agendada');
    expect(NAVIGATION_STEP_UI_DATE_LABEL.limite).toBe('Limite');
    expect(NAVIGATION_STEP_UI_DATE_LABEL.realizada).toBe('Realizada');
  });

  it('formatNavigationStepDateBr retorna placeholder para ausente', () => {
    expect(formatNavigationStepDateBr(undefined)).toBe('—');
    expect(formatNavigationStepDateBr(null)).toBe('—');
    expect(formatNavigationStepDateBr('')).toBe('—');
  });

  it('formatNavigationStepDateBr formata ISO completo ou só data', () => {
    expect(formatNavigationStepDateBr('2026-07-08T12:00:00.000Z')).toMatch(
      /^\d{2}\/\d{2}\/2026$/
    );
    expect(formatNavigationStepDateBr('2026-07-08')).toMatch(/\/07\/2026$/);
  });
});
