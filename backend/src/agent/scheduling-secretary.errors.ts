export type SchedulingSecretaryErrorCode =
  | 'INCOMPLETE_PAYLOAD'
  | 'AMBIGUOUS_CONSULTATION'
  | 'PATIENT_NOT_FOUND'
  | 'NAVIGATION_STEP_NOT_FOUND'
  | 'INVALID_STATE'
  | 'PATIENT_PHONE_CONFLICT';

/**
 * Erro de negócio do executor da secretária — sem PII no message; logar com `warn`.
 */
export class AgentSchedulingSecretaryError extends Error {
  constructor(
    message: string,
    public readonly code: SchedulingSecretaryErrorCode
  ) {
    super(message);
    this.name = 'AgentSchedulingSecretaryError';
  }
}
