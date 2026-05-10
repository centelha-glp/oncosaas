/** Etapas de consulta (alinha clinical-notes.constants e nav-step-form-variants). */
export const CONSULTATION_STEP_KEYS = [
  'specialist_consultation',
  'navigation_consultation',
] as const;

export function isConsultationStepKey(stepKey: string): boolean {
  return (CONSULTATION_STEP_KEYS as readonly string[]).includes(stepKey);
}
