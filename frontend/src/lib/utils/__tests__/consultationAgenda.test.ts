import type { ConsultationAgendaItem } from '@/lib/api/oncology-navigation';
import type { User } from '@/lib/api/users';
import {
  consultationAgendaItemBorderClass,
  consultationAgendaOverviewIsoRange,
  consultationAgendaOverviewStepKeyForUser,
  consultationAgendaStatusBadgeVariant,
  formatAgendaDateTime,
  formatShortAgendaDate,
  groupConsultationAgendaByDay,
  isConsultationAgendaSlotPrefillComplete,
  resolveInitialScheduledProfessionalId,
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
    consultationCheckedInAt: null,
    consultationStartedAt: null,
    consultationAttendance: 'EXPECTED',
    queueLabel: 'SCHEDULED',
    waitingMinutesLive: null,
    lateMinutesLive: null,
    patient: { id: 'p1', name: 'Paciente' },
    scheduledProfessional: null,
    ...overrides,
  };
}

describe('consultationAgenda utils', () => {
  it('consultationAgendaOverviewIsoRange: mês, semana e dia têm from <= to', () => {
    const anchor = new Date(2026, 4, 15);
    for (const view of ['month', 'week', 'day'] as const) {
      const r = consultationAgendaOverviewIsoRange(view, anchor);
      expect(new Date(r.fromIso).getTime()).toBeLessThanOrEqual(
        new Date(r.toIso).getTime()
      );
    }
  });

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

  it('consultationAgendaOverviewStepKeyForUser escolhe tipo único de consulta', () => {
    expect(consultationAgendaOverviewStepKeyForUser(undefined)).toBeUndefined();
    const doctor = u({ id: 'd', name: 'Dr', role: 'ONCOLOGIST' });
    expect(consultationAgendaOverviewStepKeyForUser(doctor)).toBe(
      'specialist_consultation'
    );
    const nurse = u({ id: 'n', name: 'Enf', role: 'NURSE' });
    expect(consultationAgendaOverviewStepKeyForUser(nurse)).toBe(
      'navigation_consultation'
    );
  });

  describe('isConsultationAgendaSlotPrefillComplete', () => {
    it('retorna true quando profissional, tipo, data e hora HH:mm estão definidos', () => {
      expect(
        isConsultationAgendaSlotPrefillComplete({
          scheduledProfessionalId: '550e8400-e29b-41d4-a716-446655440000',
          stepKey: 'specialist_consultation',
          expectedDate: new Date(2026, 4, 12),
          appointmentTime: '14:30',
        })
      ).toBe(true);
    });

    it('retorna false para null, data inválida ou horário fora do padrão', () => {
      expect(isConsultationAgendaSlotPrefillComplete(null)).toBe(false);
      expect(isConsultationAgendaSlotPrefillComplete(undefined)).toBe(false);
      expect(
        isConsultationAgendaSlotPrefillComplete({
          scheduledProfessionalId: 'x',
          stepKey: 'specialist_consultation',
          expectedDate: new Date('invalid'),
          appointmentTime: '14:30',
        })
      ).toBe(false);
      expect(
        isConsultationAgendaSlotPrefillComplete({
          scheduledProfessionalId: '550e8400-e29b-41d4-a716-446655440000',
          stepKey: 'specialist_consultation',
          expectedDate: new Date(2026, 4, 12),
          appointmentTime: '25:00',
        })
      ).toBe(false);
      expect(
        isConsultationAgendaSlotPrefillComplete({
          scheduledProfessionalId: '',
          stepKey: 'specialist_consultation',
          expectedDate: new Date(2026, 4, 12),
          appointmentTime: '09:00',
        })
      ).toBe(false);
    });
  });

  describe('resolveInitialScheduledProfessionalId', () => {
    const doctor = { id: 'doc-1', role: 'DOCTOR' as const, clinicalSubrole: null };
    const nurse = { id: 'nur-1', role: 'NURSE' as const, clinicalSubrole: null };
    const adminBare = { id: 'adm-1', role: 'ADMIN' as const, clinicalSubrole: null };

    it('prefill tem precedência sobre defaultProfessionalId e currentUser', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: 'prefill-1',
        defaultProfessionalId: 'default-1',
        currentUser: doctor,
        isSecretary: false,
        stepKey: 'specialist_consultation',
      });
      expect(result).toBe('prefill-1');
    });

    it('SECRETARY: usa defaultProfessionalId quando não há prefill', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: null,
        defaultProfessionalId: 'filtro-doc-2',
        currentUser: { id: 'sec-1', role: 'SECRETARY', clinicalSubrole: null },
        isSecretary: true,
        stepKey: 'specialist_consultation',
      });
      expect(result).toBe('filtro-doc-2');
    });

    it('SECRETARY sem defaultProfessionalId nem prefill devolve string vazia', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: null,
        defaultProfessionalId: null,
        currentUser: { id: 'sec-1', role: 'SECRETARY', clinicalSubrole: null },
        isSecretary: true,
        stepKey: 'navigation_consultation',
      });
      expect(result).toBe('');
    });

    it('não-SECRETARY elegível: usa o próprio id quando não há prefill nem default', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: null,
        defaultProfessionalId: null,
        currentUser: doctor,
        isSecretary: false,
        stepKey: 'specialist_consultation',
      });
      expect(result).toBe('doc-1');
    });

    it('não-SECRETARY com defaultProfessionalId é ignorado (servidor força owner)', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: null,
        defaultProfessionalId: 'algum-outro-uuid',
        currentUser: doctor,
        isSecretary: false,
        stepKey: 'specialist_consultation',
      });
      expect(result).toBe('doc-1');
    });

    it('não-SECRETARY não elegível para o stepKey devolve string vazia', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: null,
        defaultProfessionalId: null,
        currentUser: doctor,
        isSecretary: false,
        stepKey: 'navigation_consultation',
      });
      expect(result).toBe('');
    });

    it('admin sem subpapel clínico não vira owner automático', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: null,
        defaultProfessionalId: null,
        currentUser: adminBare,
        isSecretary: false,
        stepKey: 'specialist_consultation',
      });
      expect(result).toBe('');
    });

    it('valida candidato contra schedulableProfessionals quando fornecido — falha quando não está na lista', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: 'fantasma-uuid',
        defaultProfessionalId: null,
        currentUser: nurse,
        isSecretary: true,
        stepKey: 'navigation_consultation',
        schedulableProfessionals: [nurse],
      });
      expect(result).toBe('');
    });

    it('valida candidato contra schedulableProfessionals — passa quando elegível', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: nurse.id,
        defaultProfessionalId: null,
        currentUser: nurse,
        isSecretary: true,
        stepKey: 'navigation_consultation',
        schedulableProfessionals: [nurse],
      });
      expect(result).toBe(nurse.id);
    });

    it('valida candidato contra schedulableProfessionals — falha quando não elegível para o step', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: nurse.id,
        defaultProfessionalId: null,
        currentUser: nurse,
        isSecretary: true,
        stepKey: 'specialist_consultation',
        schedulableProfessionals: [nurse, doctor],
      });
      expect(result).toBe('');
    });

    it('SECRETARY com prefill ainda respeita prefill, ignorando default', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: 'slot-clicked-uuid',
        defaultProfessionalId: 'filtro-uuid',
        currentUser: { id: 'sec-1', role: 'SECRETARY', clinicalSubrole: null },
        isSecretary: true,
        stepKey: 'specialist_consultation',
      });
      expect(result).toBe('slot-clicked-uuid');
    });

    it('currentUser null e não-SECRETARY devolve string vazia', () => {
      const result = resolveInitialScheduledProfessionalId({
        prefillProfessionalId: null,
        defaultProfessionalId: null,
        currentUser: null,
        isSecretary: false,
        stepKey: 'specialist_consultation',
      });
      expect(result).toBe('');
    });
  });
});
