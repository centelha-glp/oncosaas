import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { User, UserRole } from '@/lib/api/users';

/** Contexto mínimo para elegibilidade (aceita utilizador da sessão ou da API /users). */
export type ConsultationStepUserRef = Pick<User, 'role' | 'clinicalSubrole'>;
import type {
  ConsultationAgendaItem,
  AppointmentConfirmationStatus,
} from '@/lib/api/oncology-navigation';

/** Papéis que podem ser selecionados como responsável pelo slot (alinhado ao backend). */
export const SCHEDULABLE_CONSULTATION_ROLES: UserRole[] = [
  'ADMIN',
  'ONCOLOGIST',
  'DOCTOR',
  'NURSE',
  'NURSE_CHIEF',
  'COORDINATOR',
];

export function isSchedulableConsultationRole(role: UserRole): boolean {
  return SCHEDULABLE_CONSULTATION_ROLES.includes(role);
}

export type ConsultationAppointmentStepKey =
  | 'specialist_consultation'
  | 'navigation_consultation';

/** Alinhado às regras do backend (`isUserEligibleForConsultationStepKey`). */
export function userEligibleForConsultationStep(
  user: ConsultationStepUserRef,
  stepKey: ConsultationAppointmentStepKey
): boolean {
  if (!isSchedulableConsultationRole(user.role)) {
    return false;
  }
  if (stepKey === 'specialist_consultation') {
    if (user.role === 'ONCOLOGIST' || user.role === 'DOCTOR') {
      return true;
    }
    if (
      (user.role === 'COORDINATOR' || user.role === 'ADMIN') &&
      user.clinicalSubrole === 'MEDICAL'
    ) {
      return true;
    }
    return false;
  }
  if (stepKey === 'navigation_consultation') {
    if (user.role === 'NURSE' || user.role === 'NURSE_CHIEF') {
      return true;
    }
    if (
      (user.role === 'COORDINATOR' || user.role === 'ADMIN') &&
      user.clinicalSubrole === 'NURSING'
    ) {
      return true;
    }
    return false;
  }
  return false;
}

/** Para o filtro «Profissional» na agenda: quem pode aparecer como responsável por algum tipo de consulta. */
export function userEligibleForAnyConsultationAgendaSlot(user: User): boolean {
  return (
    userEligibleForConsultationStep(user, 'specialist_consultation') ||
    userEligibleForConsultationStep(user, 'navigation_consultation')
  );
}

export function consultationAppointmentStepKeyFromString(
  stepKey: string
): ConsultationAppointmentStepKey | null {
  if (stepKey === 'specialist_consultation' || stepKey === 'navigation_consultation') {
    return stepKey;
  }
  return null;
}

/** Metadados alinhados ao `mergeUniversalStepConfigs` do backend. */
export const CONSULTATION_APPOINTMENT_STEP_META: Record<
  'specialist_consultation' | 'navigation_consultation',
  { stepName: string; stepDescription: string }
> = {
  specialist_consultation: {
    stepName: 'Consulta especializada',
    stepDescription:
      'Consulta com especialista da linha de cuidado (não substitui a navegação oncológica).',
  },
  navigation_consultation: {
    stepName: 'Consulta de navegação oncológica',
    stepDescription:
      'Atendimento com o navegador oncológico para coordenação de acesso, barreiras e continuidade do cuidado.',
  },
};

export function toYmd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Alinhado ao backend (`consultation-agenda-slot.utils`). */
export const CONSULTATION_AVAILABLE_SLOTS_MAX_RANGE_DAYS = 60;

export const CONSULTATION_AGENDA_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  OVERDUE: 'Atrasada',
  CANCELLED: 'Cancelada',
  NOT_APPLICABLE: 'Não aplicável',
};

export const APPOINTMENT_CONFIRMATION_LABEL: Record<
  AppointmentConfirmationStatus,
  string
> = {
  NOT_APPLICABLE: 'Sem confirmação',
  AWAITING_RESPONSE: 'Aguardando resposta',
  CONFIRMED: 'Confirmada',
  DECLINED: 'Recusada',
};

export function appointmentConfirmationBadgeVariant(
  status: AppointmentConfirmationStatus
): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' {
  switch (status) {
    case 'CONFIRMED':
      return 'success';
    case 'DECLINED':
      return 'destructive';
    case 'AWAITING_RESPONSE':
      return 'default';
    case 'NOT_APPLICABLE':
    default:
      return 'outline';
  }
}

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

/** Data e hora da consulta no fuso de São Paulo (texto curto para cards e listas). */
export function formatAgendaDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(parseISO(iso));
  } catch {
    return '—';
  }
}

/** Data civil (yyyy-MM-dd) no fuso America/Sao_Paulo para um instante ISO UTC. */
export function isoUtcToSaoPauloYmd(iso: string): string {
  const d = parseISO(iso);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Horário HH:mm no fuso America/Sao_Paulo para um instante ISO UTC. */
export function isoUtcToSaoPauloHHmm(iso: string): string {
  const d = parseISO(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
}

/** Combina data (calendário) e horário local `HH:mm` em `Date` com segundos zerados. */
export function combineLocalDateAndTime(date: Date, timeHHmm: string): Date {
  const [hStr, mStr] = timeHHmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const out = new Date(date);
  out.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return out;
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
