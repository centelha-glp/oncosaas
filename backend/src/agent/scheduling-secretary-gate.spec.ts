import { AgentDecisionType } from '@generated/prisma/client';
import { schedulingSecretaryPayloadValidForAutoApprove } from './scheduling-secretary-gate';
import { AgentDecision } from './interfaces/agent-decision.interface';
import {
  CANCEL_CONSULTATION_APPOINTMENT,
  CONFIRM_CONSULTATION_APPOINTMENT,
  CREATE_CONSULTATION_APPOINTMENT,
  RESCHEDULE_CONSULTATION_APPOINTMENT,
} from './scheduling-secretary.constants';

const baseCreatePayload = {
  scheduledProfessionalId: '550e8400-e29b-41d4-a716-446655440000',
  expectedDate: '2026-06-15T14:00:00.000Z',
  stepKey: 'navigation_consultation',
  stepName: 'Consulta de navegação',
  journeyStage: 'TREATMENT',
};

function decision(
  actionType: string,
  payload: Record<string, unknown>
): AgentDecision {
  return {
    decisionType: AgentDecisionType.RESPONSE_GENERATED,
    reasoning: 'test',
    inputData: {},
    outputAction: { type: actionType, payload },
    requiresApproval: false,
  } as AgentDecision;
}

describe('schedulingSecretaryPayloadValidForAutoApprove', () => {
  it('rejeita CREATE quando stepKey não é etapa de consulta válida', () => {
    const ok = schedulingSecretaryPayloadValidForAutoApprove(
      CREATE_CONSULTATION_APPOINTMENT,
      decision(CREATE_CONSULTATION_APPOINTMENT, {
        ...baseCreatePayload,
        stepKey: 'random_step_key',
      })
    );
    expect(ok).toBe(false);
  });

  it('rejeita CREATE quando newPatient está incompleto', () => {
    const ok = schedulingSecretaryPayloadValidForAutoApprove(
      CREATE_CONSULTATION_APPOINTMENT,
      decision(CREATE_CONSULTATION_APPOINTMENT, {
        ...baseCreatePayload,
        newPatient: { name: 'João', birthDate: '1990-01-01' },
      })
    );
    expect(ok).toBe(false);
  });

  it('rejeita CREATE quando patientIntake (ai-service) está incompleto', () => {
    const ok = schedulingSecretaryPayloadValidForAutoApprove(
      CREATE_CONSULTATION_APPOINTMENT,
      decision(CREATE_CONSULTATION_APPOINTMENT, {
        ...baseCreatePayload,
        patientIntake: { name: 'João', birthDate: '1990-01-01' },
      })
    );
    expect(ok).toBe(false);
  });

  it('aceita CREATE com patientIntake completo (alias do ai-service)', () => {
    const ok = schedulingSecretaryPayloadValidForAutoApprove(
      CREATE_CONSULTATION_APPOINTMENT,
      decision(CREATE_CONSULTATION_APPOINTMENT, {
        ...baseCreatePayload,
        patientIntake: {
          name: 'João Silva',
          birthDate: '1990-05-01',
          phone: '+5511987654321',
        },
      })
    );
    expect(ok).toBe(true);
  });

  it('aceita CREATE com newPatient completo', () => {
    const ok = schedulingSecretaryPayloadValidForAutoApprove(
      CREATE_CONSULTATION_APPOINTMENT,
      decision(CREATE_CONSULTATION_APPOINTMENT, {
        ...baseCreatePayload,
        newPatient: {
          name: 'João Silva',
          birthDate: '1990-05-01',
          phone: '+5511987654321',
        },
      })
    );
    expect(ok).toBe(true);
  });

  it('aceita RESCHEDULE com navigation_step_id (snake_case)', () => {
    const ok = schedulingSecretaryPayloadValidForAutoApprove(
      RESCHEDULE_CONSULTATION_APPOINTMENT,
      decision(RESCHEDULE_CONSULTATION_APPOINTMENT, {
        navigation_step_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        newExpectedDate: '2026-07-01T10:00:00.000Z',
      })
    );
    expect(ok).toBe(true);
  });

  it('rejeita RESCHEDULE sem UUID de etapa', () => {
    const ok = schedulingSecretaryPayloadValidForAutoApprove(
      RESCHEDULE_CONSULTATION_APPOINTMENT,
      decision(RESCHEDULE_CONSULTATION_APPOINTMENT, {
        navigationStepId: 'not-a-uuid',
        newExpectedDate: '2026-07-01T10:00:00.000Z',
      })
    );
    expect(ok).toBe(false);
  });

  it('aceita CANCEL com step_id alternativo', () => {
    const ok = schedulingSecretaryPayloadValidForAutoApprove(
      CANCEL_CONSULTATION_APPOINTMENT,
      decision(CANCEL_CONSULTATION_APPOINTMENT, {
        step_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      })
    );
    expect(ok).toBe(true);
  });

  it('aceita CONFIRM com navigationStepId', () => {
    const ok = schedulingSecretaryPayloadValidForAutoApprove(
      CONFIRM_CONSULTATION_APPOINTMENT,
      decision(CONFIRM_CONSULTATION_APPOINTMENT, {
        navigationStepId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      })
    );
    expect(ok).toBe(true);
  });
});
