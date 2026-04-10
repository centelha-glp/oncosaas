/**
 * Constantes centralizadas para estágios da jornada oncológica.
 * Importar deste arquivo em vez de definir localmente em cada componente.
 */

export const JOURNEY_STAGES = [
  'SCREENING',
  'DIAGNOSIS',
  'TREATMENT',
  'FOLLOW_UP',
  'PALLIATIVE',
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export const JOURNEY_STAGE_LABELS: Record<JourneyStage, string> = {
  SCREENING: 'Rastreamento',
  DIAGNOSIS: 'Diagnóstico',
  TREATMENT: 'Tratamento',
  FOLLOW_UP: 'Seguimento',
  PALLIATIVE: 'Cuidados Paliativos',
};

export const JOURNEY_STAGE_ORDER: Record<JourneyStage, number> = {
  SCREENING: 0,
  DIAGNOSIS: 1,
  TREATMENT: 2,
  FOLLOW_UP: 3,
  PALLIATIVE: 4,
};

/**
 * Núcleo oncológico (tipo, estadiamento/TNM, data do diagnóstico, ECOG) obrigatório
 * em qualquer fase após Rastreamento — alinhado ao schema Zod em `validations/patient.ts`.
 */
export function requiresOncologyCoreFields(
  stage: JourneyStage | string | undefined | null
): boolean {
  if (stage === undefined || stage === null || stage === '') return false;
  const s = String(stage).trim().toUpperCase() as JourneyStage;
  return s !== 'SCREENING';
}

/** Tratamento atual obrigatório apenas após o diagnóstico estar estabelecido na jornada. */
export function requiresCurrentTreatmentField(
  stage: JourneyStage | string | undefined | null
): boolean {
  if (stage === undefined || stage === null || stage === '') return false;
  const s = String(stage).trim().toUpperCase() as JourneyStage;
  return s === 'TREATMENT' || s === 'FOLLOW_UP' || s === 'PALLIATIVE';
}
