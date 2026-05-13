import type { NavigationStep } from '@/lib/api/oncology-navigation';
import { baseNavigationStepKey } from '@/lib/utils/navigation-step-ux-hints';
import { JOURNEY_STAGE_ORDER, type JourneyStage } from '@/lib/utils/journey-stage';

/**
 * Etapas compatíveis com um tipo de evolução (chave canónica alinhada ao backend).
 * Usa `baseNavigationStepKey` para incluir instâncias `specialist_consultation-2`, etc.
 */
export function filterNavigationStepsByEvolutionBaseKey(
  steps: NavigationStep[],
  evolutionBaseStepKey: string
): NavigationStep[] {
  return steps.filter(
    (s) => baseNavigationStepKey(s.stepKey) === evolutionBaseStepKey
  );
}

/**
 * Ordena candidatos para UI e default: prioriza a fase atual do paciente, depois a ordem
 * canónica da jornada, depois data de criação (instâncias repetidas na mesma fase).
 */
export function sortNavigationStepsForEvolutionPick(
  steps: NavigationStep[],
  patientCurrentStage: string | null | undefined
): NavigationStep[] {
  const stage = (patientCurrentStage || 'SCREENING') as JourneyStage;
  return [...steps].sort((a, b) => {
    const aMatch = a.journeyStage === stage ? 0 : 1;
    const bMatch = b.journeyStage === stage ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    const ao = JOURNEY_STAGE_ORDER[a.journeyStage as JourneyStage] ?? 99;
    const bo = JOURNEY_STAGE_ORDER[b.journeyStage as JourneyStage] ?? 99;
    if (ao !== bo) return ao - bo;
    return a.createdAt.localeCompare(b.createdAt);
  });
}
