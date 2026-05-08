import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ConsultationAgendaItem } from '@/lib/api/oncology-navigation';

export function toYmd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export const CONSULTATION_AGENDA_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  OVERDUE: 'Atrasada',
  CANCELLED: 'Cancelada',
  NOT_APPLICABLE: 'Não aplicável',
};

export function consultationAgendaStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'OVERDUE':
      return 'destructive';
    case 'IN_PROGRESS':
      return 'default';
    case 'PENDING':
      return 'secondary';
    default:
      return 'outline';
  }
}

/** Borda esquerda por status da etapa (tokens priority.* + primary/muted). */
export function consultationAgendaItemBorderClass(status: string): string {
  switch (status) {
    case 'OVERDUE':
      return 'border-l-priority-critical';
    case 'COMPLETED':
      return 'border-l-priority-medium';
    case 'IN_PROGRESS':
      return 'border-l-primary';
    case 'PENDING':
      return 'border-l-priority-low';
    default:
      return 'border-l-muted-foreground';
  }
}

export function formatAgendaDayLabel(iso: string): string {
  try {
    return format(parseISO(iso), "EEEE, d 'de' MMMM", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function formatShortAgendaDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

export function groupConsultationAgendaByDay(
  items: ConsultationAgendaItem[]
): Map<string, ConsultationAgendaItem[]> {
  const map = new Map<string, ConsultationAgendaItem[]>();
  for (const item of items) {
    let key: string;
    try {
      key = format(parseISO(item.agendaDate), 'yyyy-MM-dd');
    } catch {
      key = item.agendaDate.slice(0, 10);
    }
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}
