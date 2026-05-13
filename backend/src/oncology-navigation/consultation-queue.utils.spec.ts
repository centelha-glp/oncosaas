import {
  ConsultationAttendance,
  NavigationStepStatus,
} from '@generated/prisma/client';
import {
  CONSULTATION_QUEUE_LABEL,
  resolveConsultationQueueState,
  consultationLateMinutesAfterExpected,
  consultationWaitingMinutesBetween,
} from './consultation-queue.utils';

describe('consultation-queue.utils', () => {
  const base = {
    status: NavigationStepStatus.PENDING,
    isCompleted: false,
    consultationAttendance: ConsultationAttendance.EXPECTED,
    consultationCheckedInAt: null as Date | null,
    consultationStartedAt: null as Date | null,
    expectedDate: new Date('2026-05-10T14:00:00.000Z'),
  };

  it('resolveConsultationQueueState: NO_SHOW quando attendance é NO_SHOW', () => {
    const r = resolveConsultationQueueState(
      {
        ...base,
        consultationAttendance: ConsultationAttendance.NO_SHOW,
      },
      new Date('2026-05-10T15:00:00.000Z')
    );
    expect(r.queueLabel).toBe(CONSULTATION_QUEUE_LABEL.NO_SHOW);
  });

  it('resolveConsultationQueueState: WAITING com minutos ao vivo após check-in', () => {
    const checkedIn = new Date('2026-05-10T14:00:00.000Z');
    const now = new Date('2026-05-10T14:30:00.000Z');
    const r = resolveConsultationQueueState(
      { ...base, consultationCheckedInAt: checkedIn },
      now
    );
    expect(r.queueLabel).toBe(CONSULTATION_QUEUE_LABEL.WAITING);
    expect(r.waitingMinutesLive).toBe(30);
  });

  it('resolveConsultationQueueState: LATE quando passou expectedDate sem check-in', () => {
    const now = new Date('2026-05-10T15:00:00.000Z');
    const r = resolveConsultationQueueState(base, now);
    expect(r.queueLabel).toBe(CONSULTATION_QUEUE_LABEL.LATE);
    expect(r.lateMinutesLive).toBe(60);
  });

  it('consultationLateMinutesAfterExpected retorna 0 quando pontual', () => {
    const e = new Date('2026-05-10T14:00:00.000Z');
    const at = new Date('2026-05-10T13:00:00.000Z');
    expect(consultationLateMinutesAfterExpected(e, at)).toBe(0);
  });

  it('consultationWaitingMinutesBetween arredonda para minutos inteiros', () => {
    const a = new Date('2026-05-10T14:00:00.000Z');
    const b = new Date('2026-05-10T14:01:30.000Z');
    expect(consultationWaitingMinutesBetween(a, b)).toBe(1);
  });
});
