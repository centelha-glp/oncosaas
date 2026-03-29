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
