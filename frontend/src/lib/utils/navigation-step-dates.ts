import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Contrato produto ↔ API JSON (`NavigationStep` no backend Nest/Prisma):
 *
 * | Rótulo na UI (usuário) | Campo JSON (camelCase) | Observação |
 * | ---------------------- | ---------------------- | ----------- |
 * | Agendada | `expectedDate` | Planejamento / data-alvo planejada. |
 * | Limite | `dueDate` | Alimenta alertas de atraso. |
 * | Realizada | `actualDate` | Momento em que o evento ocorreu. |
 *
 * `completedAt` marca quando a etapa foi registrada como concluída no sistema;
 * o backend pode preencher `actualDate` a partir dela quando a realizada não é informada.
 */
export const NAVIGATION_STEP_UI_DATE_LABEL = {
  agendada: 'Agendada',
  limite: 'Limite',
  realizada: 'Realizada',
} as const;

/** Formato curto pt-BR para listagens; valores ausentes mostram placeholder acessível. */
export function formatNavigationStepDateBr(
  value?: string | null,
  emptyPlaceholder = '—'
): string {
  if (value == null || value === '') return emptyPlaceholder;
  try {
    const raw = value.includes('T') ? value : `${value.slice(0, 10)}T12:00:00`;
    return format(parseISO(raw), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return emptyPlaceholder;
  }
}
