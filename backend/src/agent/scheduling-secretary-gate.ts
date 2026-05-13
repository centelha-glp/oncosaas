import { JourneyStage } from '@generated/prisma/client';
import { AgentDecision } from './interfaces/agent-decision.interface';
import {
  CANCEL_CONSULTATION_APPOINTMENT,
  CONFIRM_CONSULTATION_APPOINTMENT,
  CREATE_CONSULTATION_APPOINTMENT,
  RESCHEDULE_CONSULTATION_APPOINTMENT,
  isSchedulingSecretaryOutputActionType,
} from './scheduling-secretary.constants';
import { isConsultationStepKey } from '../oncology-navigation/consultation-step-keys';

/**
 * Confirmação explícita do paciente (`confirmacao_paciente` no ai-service) é decidida no fluxo
 * conversacional/LLM a partir do texto do chat. O NestJS **não** revalida a última mensagem do
 * paciente contra esse booleano: não há prova criptográfica nem botão interativo obrigatório
 * neste gate. Endurecimento futuro: exigir confirmação via mensagem interativa WhatsApp ou
 * registro auditável da frase de confirmação no payload persistido.
 */

const JOURNEY_STAGES = new Set<string>(Object.values(JourneyStage));

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validIsoDateString(value: unknown): boolean {
  if (!nonEmptyString(value)) {
    return false;
  }
  const t = Date.parse(value);
  return !Number.isNaN(t);
}

function payloadRecord(
  decision: AgentDecision
): Record<string, unknown> | null {
  const raw = decision.outputAction?.payload;
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function newPatientGateOk(np: unknown): boolean {
  if (np === undefined || np === null) {
    return true;
  }
  if (typeof np !== 'object' || Array.isArray(np)) {
    return false;
  }
  const o = np as Record<string, unknown>;
  return (
    nonEmptyString(o.name) &&
    nonEmptyString(o.birthDate) &&
    nonEmptyString(o.phone)
  );
}

/** ai-service usa `patientIntake`; backend legado `newPatient` — mesma validação. */
function schedulingIntakeFromPayload(
  p: Record<string, unknown>
): unknown {
  return p.newPatient ?? p.patientIntake ?? p.patient_intake;
}

function navigationStepIdFromPayload(
  p: Record<string, unknown> | null
): string | null {
  if (!p) {
    return null;
  }
  const raw =
    p.navigationStepId ?? p.navigation_step_id ?? p.stepId ?? p.step_id;
  return typeof raw === 'string' && isUuid(raw) ? raw : null;
}

/**
 * Validação mínima para auto-aprovação no DecisionGate (sem tenant/patient do request).
 * Regras completas e isolamento ficam no AgentService ao executar.
 */
export function schedulingSecretaryPayloadValidForAutoApprove(
  actionType: string,
  decision: AgentDecision
): boolean {
  if (!isSchedulingSecretaryOutputActionType(actionType)) {
    return false;
  }
  const p = payloadRecord(decision);
  if (!p) {
    return false;
  }

  switch (actionType) {
    case CREATE_CONSULTATION_APPOINTMENT: {
      if (
        !isUuid(p.scheduledProfessionalId) ||
        !validIsoDateString(p.expectedDate) ||
        !nonEmptyString(p.stepKey) ||
        !nonEmptyString(p.stepName) ||
        !nonEmptyString(p.journeyStage) ||
        !JOURNEY_STAGES.has(String(p.journeyStage).toUpperCase())
      ) {
        return false;
      }
      if (!isConsultationStepKey(String(p.stepKey))) {
        return false;
      }
      return newPatientGateOk(schedulingIntakeFromPayload(p));
    }
    case RESCHEDULE_CONSULTATION_APPOINTMENT: {
      const stepId = navigationStepIdFromPayload(p);
      const when =
        p.newExpectedDate ?? p.expectedDate ?? p.rescheduledExpectedDate;
      return !!stepId && validIsoDateString(when);
    }
    case CANCEL_CONSULTATION_APPOINTMENT:
    case CONFIRM_CONSULTATION_APPOINTMENT:
      return !!navigationStepIdFromPayload(p);
    default:
      return false;
  }
}
