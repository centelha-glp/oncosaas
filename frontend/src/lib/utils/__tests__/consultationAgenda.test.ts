import { describe, expect, it } from 'vitest';
import type { ConsultationAgendaItem } from '@/lib/api/oncology-navigation';
import {
  consultationAgendaItemBorderClass,
  consultationAgendaStatusBadgeVariant,
  formatShortAgendaDate,
  groupConsultationAgendaByDay,
} from '../consultationAgenda';

function makeItem(
  overrides: Partial<ConsultationAgendaItem> = {}
): ConsultationAgendaItem {
  return {
    id: 's1',
    patientId: 'p1',
    stepKey: 'specialist_consultation',
    stepName: 'Consulta',
    status: 'PENDING',
    journeyStage: 'DIAGNOSIS',
    isCompleted: false,
    agendaDate: '2024-05-07',
    expectedDate: null,
    dueDate: null,
    actualDate: null,
    patient: { id: 'p1', name: 'Paciente' },
    ...overrides,
  };
}

describe('consultationAgenda utils', () => {
  it('groupConsultationAgendaByDay agrupa por yyyy-MM-dd', () => {
    const items = [
      makeItem({ id: 'a', agendaDate: '2024-05-07' }),
      makeItem({ id: 'b', agendaDate: '2024-05-07' }),
      makeItem({ id: 'c', agendaDate: '2024-05-08' }),
    ];
    const map = groupConsultationAgendaByDay(items);
    expect(map.get('2024-05-07')?.map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(map.get('2024-05-08')?.map((i) => i.id)).toEqual(['c']);
  });

  it('formatShortAgendaDate retorna — para null e data válida em pt-BR', () => {
    expect(formatShortAgendaDate(null)).toBe('—');
    expect(formatShortAgendaDate('2024-05-07')).toMatch(/07\/05\/2024/);
  });

  it('consultationAgendaStatusBadgeVariant mapeia status conhecidos', () => {
    expect(consultationAgendaStatusBadgeVariant('COMPLETED')).toBe('success');
    expect(consultationAgendaStatusBadgeVariant('OVERDUE')).toBe('destructive');
    expect(consultationAgendaStatusBadgeVariant('UNKNOWN')).toBe('outline');
  });

  it('consultationAgendaItemBorderClass usa tokens priority', () => {
    expect(consultationAgendaItemBorderClass('OVERDUE')).toBe(
      'border-l-priority-critical'
    );
    expect(consultationAgendaItemBorderClass('COMPLETED')).toBe(
      'border-l-priority-medium'
    );
    expect(consultationAgendaItemBorderClass('PENDING')).toBe(
      'border-l-priority-low'
    );
  });
});
