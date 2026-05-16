/** Evento interno: re-sincronizar agendamentos derivados do protocolo (fora do turno de mensagem). */
export const PROTOCOL_SCHEDULE_REEVALUATION_EVENT =
  'protocol.schedule.reevaluation' as const;

export interface ProtocolScheduleReevaluationPayload {
  patientId: string;
  tenantId: string;
  reason?: string;
}
