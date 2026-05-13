/** Tipos de `outputAction.type` emitidos pela secretária de agendamento (ai-service → backend). */
export const CREATE_CONSULTATION_APPOINTMENT =
  'CREATE_CONSULTATION_APPOINTMENT' as const;
export const RESCHEDULE_CONSULTATION_APPOINTMENT =
  'RESCHEDULE_CONSULTATION_APPOINTMENT' as const;
export const CANCEL_CONSULTATION_APPOINTMENT =
  'CANCEL_CONSULTATION_APPOINTMENT' as const;
export const CONFIRM_CONSULTATION_APPOINTMENT =
  'CONFIRM_CONSULTATION_APPOINTMENT' as const;

export const SCHEDULING_SECRETARY_OUTPUT_ACTION_TYPES = [
  CREATE_CONSULTATION_APPOINTMENT,
  RESCHEDULE_CONSULTATION_APPOINTMENT,
  CANCEL_CONSULTATION_APPOINTMENT,
  CONFIRM_CONSULTATION_APPOINTMENT,
] as const;

export type SchedulingSecretaryOutputActionType =
  (typeof SCHEDULING_SECRETARY_OUTPUT_ACTION_TYPES)[number];

export function isSchedulingSecretaryOutputActionType(
  type: string
): type is SchedulingSecretaryOutputActionType {
  return (SCHEDULING_SECRETARY_OUTPUT_ACTION_TYPES as readonly string[]).includes(
    type
  );
}
