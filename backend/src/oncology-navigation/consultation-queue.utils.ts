import {
  ConsultationAttendance,
  NavigationStepStatus,
} from '@generated/prisma/client';

export const CONSULTATION_QUEUE_LABEL = {
  NO_SHOW: 'NO_SHOW',
  WAITING: 'WAITING',
  IN_CONSULTATION: 'IN_CONSULTATION',
  LATE: 'LATE',
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
} as const;

export type ConsultationQueueLabel =
  (typeof CONSULTATION_QUEUE_LABEL)[keyof typeof CONSULTATION_QUEUE_LABEL];

export interface ConsultationQueueResolveInput {
  status: NavigationStepStatus;
  isCompleted: boolean;
  consultationAttendance: ConsultationAttendance;
  consultationCheckedInAt: Date | null;
  consultationStartedAt: Date | null;
  expectedDate: Date | null;
}

/**
 * Ordem: no-show → em consulta → aguardando → atrasado → agendado (plano métricas agenda).
 * `expectedDate` é o instante de início do slot na agenda.
 */
export function resolveConsultationQueueState(
  step: ConsultationQueueResolveInput,
  now: Date
): {
  queueLabel: ConsultationQueueLabel;
  waitingMinutesLive: number | null;
  lateMinutesLive: number | null;
} {
  if (step.isCompleted || step.status === NavigationStepStatus.COMPLETED) {
    return {
      queueLabel: CONSULTATION_QUEUE_LABEL.COMPLETED,
      waitingMinutesLive: null,
      lateMinutesLive: null,
    };
  }
  if (step.consultationAttendance === ConsultationAttendance.NO_SHOW) {
    return {
      queueLabel: CONSULTATION_QUEUE_LABEL.NO_SHOW,
      waitingMinutesLive: null,
      lateMinutesLive: null,
    };
  }
  if (step.consultationStartedAt) {
    return {
      queueLabel: CONSULTATION_QUEUE_LABEL.IN_CONSULTATION,
      waitingMinutesLive: null,
      lateMinutesLive: null,
    };
  }
  if (step.consultationCheckedInAt) {
    const waitingMs = now.getTime() - step.consultationCheckedInAt.getTime();
    return {
      queueLabel: CONSULTATION_QUEUE_LABEL.WAITING,
      waitingMinutesLive: Math.max(0, Math.floor(waitingMs / 60_000)),
      lateMinutesLive: null,
    };
  }
  const expected = step.expectedDate;
  if (expected && now.getTime() > expected.getTime()) {
    const lateMs = now.getTime() - expected.getTime();
    return {
      queueLabel: CONSULTATION_QUEUE_LABEL.LATE,
      waitingMinutesLive: null,
      lateMinutesLive: Math.max(0, Math.floor(lateMs / 60_000)),
    };
  }
  return {
    queueLabel: CONSULTATION_QUEUE_LABEL.SCHEDULED,
    waitingMinutesLive: null,
    lateMinutesLive: null,
  };
}

export function consultationWaitingMinutesBetween(
  checkedInAt: Date,
  startedAt: Date
): number {
  return Math.max(0, Math.floor((startedAt.getTime() - checkedInAt.getTime()) / 60_000));
}

export function consultationLateMinutesAfterExpected(
  expectedDate: Date,
  eventAt: Date
): number {
  if (eventAt.getTime() <= expectedDate.getTime()) {
    return 0;
  }
  return Math.max(
    0,
    Math.floor((eventAt.getTime() - expectedDate.getTime()) / 60_000)
  );
}
