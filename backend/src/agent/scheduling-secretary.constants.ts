/** Tipos de `outputAction.type` emitidos pela secretária de agendamento (ai-service → backend). */
export const CREATE_CONSULTATION_APPOINTMENT =
  'CREATE_CONSULTATION_APPOINTMENT' as const;
export const RESCHEDULE_CONSULTATION_APPOINTMENT =
  'RESCHEDULE_CONSULTATION_APPOINTMENT' as const;
export const CANCEL_CONSULTATION_APPOINTMENT =
  'CANCEL_CONSULTATION_APPOINTMENT' as const;
export const CONFIRM_CONSULTATION_APPOINTMENT =
  'CONFIRM_CONSULTATION_APPOINTMENT' as const;
/** Consulta read-only de vagas reais (backend como fonte de verdade). */
export const CHECK_CONSULTATION_AVAILABILITY =
  'CHECK_CONSULTATION_AVAILABILITY' as const;

/** Janela máxima permitida no payload da secretária (mais restrita que a API geral de slots). */
export const SCHEDULING_SECRETARY_AVAILABILITY_MAX_RANGE_DAYS = 30;

/** Quantas vagas incluir na mensagem ao paciente e em `agentState`. */
export const SCHEDULING_SECRETARY_AVAILABILITY_OFFERED_SLOTS_MAX = 5;

/** TTL do cache `scheduling.availableSlots` no `agentState` (evita oferta obsoleta). */
export const SCHEDULING_SECRETARY_AVAILABILITY_STATE_TTL_MS = 5 * 60 * 1000;

export const SCHEDULING_SECRETARY_OUTPUT_ACTION_TYPES = [
  CREATE_CONSULTATION_APPOINTMENT,
  RESCHEDULE_CONSULTATION_APPOINTMENT,
  CANCEL_CONSULTATION_APPOINTMENT,
  CONFIRM_CONSULTATION_APPOINTMENT,
  CHECK_CONSULTATION_AVAILABILITY,
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
