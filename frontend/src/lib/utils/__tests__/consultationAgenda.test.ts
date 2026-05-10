import { describe, expect, it } from 'vitest';
import type { ConsultationAgendaItem } from '@/lib/api/oncology-navigation';
import type { User } from '@/lib/api/users';
import {
  consultationAgendaItemBorderClass,
  consultationAgendaStatusBadgeVariant,
  formatAgendaDateTime,
  formatShortAgendaDate,
  groupConsultationAgendaByDay,
  userEligibleForAnyConsultationAgendaSlot,
  userEligibleForConsultationStep,
} from '../consultationAgenda';

function u(partial: Partial<User> & Pick<User, 'id' | 'name' | 'role'>): User {
  return {
    email: 'x@test.com',
    mfaEnabled: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

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
    appointmentConfirmationStatus: 'NOT_APPLICABLE',
    patient: { id: 'p1', name: 'Paciente' },
    scheduledProfessional: null,
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

  it('formatAgendaDateTime retorna — para null e data/hora em São Paulo', () => {
    expect(formatAgendaDateTime(null)).toBe('—');
    const out = formatAgendaDateTime('2024-05-07T15:30:00.000Z');
    expect(out).not.toBe('—');
    expect(out).toMatch(/07\/05\/2024/);
    expect(out).toMatch(/12:30/);
  });

  it('consultationAgendaStatusBadgeVariant mapeia status conhecidos', () => {
    expect(consultationAgendaStatusBadgeVariant('COMPLETED')).toBe('success');
    expect(consultationAgendaStatusBadgeVariant('OVERDUE')).toBe('destructive');
    expect(consultationAgendaStatusBadgeVariant('UNKNOWN')).toBe('outline');
  });

  it('userEligibleForConsultationStep filtra por tipo de consulta', () => {
    const doctor = u({
      id: '1',
      name: 'Dr',
      role: 'DOCTOR',
    });
    const nurse = u({
      id: '2',
      name: 'Enf',
      role: 'NURSE',
    });
    const coordMed = u({
      id: '3',
      name: 'Coord',
      role: 'COORDINATOR',
      clinicalSubrole: 'MEDICAL',
    });
    const coordEnf = u({
      id: '4',
      name: 'Coord2',
      role: 'COORDINATOR',
      clinicalSubrole: 'NURSING',
    });
    const adminMed = u({
      id: '5',
      name: 'Admin Med',
      role: 'ADMIN',
      clinicalSubrole: 'MEDICAL',
    });
    const adminNurse = u({
      id: '6',
      name: 'Admin Enf',
      role: 'ADMIN',
      clinicalSubrole: 'NURSING',
    });
    const adminBare = u({
      id: '7',
      name: 'Admin',
      role: 'ADMIN',
    });
    expect(userEligibleForConsultationStep(doctor, 'specialist_consultation')).toBe(
      true
    );
    expect(userEligibleForConsultationStep(doctor, 'navigation_consultation')).toBe(
      false
    );
    expect(userEligibleForConsultationStep(nurse, 'navigation_consultation')).toBe(
      true
    );
    expect(userEligibleForConsultationStep(nurse, 'specialist_consultation')).toBe(
      false
    );
    expect(userEligibleForConsultationStep(coordMed, 'specialist_consultation')).toBe(
      true
    );
    expect(userEligibleForConsultationStep(coordMed, 'navigation_consultation')).toBe(
      false
    );
    expect(userEligibleForConsultationStep(coordEnf, 'navigation_consultation')).toBe(
      true
    );
    expect(userEligibleForConsultationStep(coordEnf, 'specialist_consultation')).toBe(
      false
    );
    expect(userEligibleForConsultationStep(adminMed, 'specialist_consultation')).toBe(
      true
    );
    expect(userEligibleForConsultationStep(adminMed, 'navigation_consultation')).toBe(
      false
    );
    expect(userEligibleForConsultationStep(adminNurse, 'navigation_consultation')).toBe(
      true
    );
    expect(userEligibleForConsultationStep(adminNurse, 'specialist_consultation')).toBe(
      false
    );
    expect(userEligibleForConsultationStep(adminBare, 'specialist_consultation')).toBe(
      false
    );
    expect(userEligibleForConsultationStep(adminBare, 'navigation_consultation')).toBe(
      false
    );
    expect(userEligibleForAnyConsultationAgendaSlot(adminMed)).toBe(true);
    expect(userEligibleForAnyConsultationAgendaSlot(adminBare)).toBe(false);
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
