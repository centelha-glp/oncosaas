/**
 * Janela de «freshness» partilhada entre:
 * - detalhe clínico do paciente (`usePatientDetail`, inclui `navigationSteps` na aba Navegação);
 * - lista de etapas na página Navegação Oncológica (`usePatientNavigationSteps` / `useStepsByStage`).
 */
export const STALE_TIME_PATIENT_NAVIGATION_MS = 15_000;
