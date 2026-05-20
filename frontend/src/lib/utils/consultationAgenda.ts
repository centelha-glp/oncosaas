import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
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

/**
 * `stepKey` para overview de disponibilidade: omitir quando o utilizador é elegível para ambos
 * (o backend aceita sem `stepKey`). Caso contrário fixar o tipo único elegível.
 */
export function consultationAgendaOverviewStepKeyForUser(
  user: ConsultationStepUserRef | undefined
): ConsultationAppointmentStepKey | undefined {
  if (!user) {
    return undefined;
  }
  const spec = userEligibleForConsultationStep(user, 'specialist_consultation');
  const nav = userEligibleForConsultationStep(user, 'navigation_consultation');
  if (spec && nav) {
    return undefined;
  }
  if (spec) {
    return 'specialist_consultation';
  }
  if (nav) {
    return 'navigation_consultation';
  }
  return undefined;
}

export function consultationAppointmentStepKeyFromString(
  stepKey: string
): ConsultationAppointmentStepKey | null {
  if (stepKey === 'specialist_consultation' || stepKey === 'navigation_consultation') {
    return stepKey;
  }
  return null;
}

/**
 * Resolve o `scheduledProfessionalId` inicial do dialog «Nova consulta na agenda».
 *
 * Ordem de precedência:
 * 1. `prefillProfessionalId` — clique num slot do calendário pré-define o profissional.
 * 2. `defaultProfessionalId` — ex.: filtro de profissional na agenda da secretaria.
 * 3. `currentUser.id` — quando o utilizador NÃO é secretaria e é elegível para o `stepKey`.
 *
 * Quando `schedulableProfessionals` está presente e não vazia, valida o candidato contra a
 * lista; se não estiver lá ou não for elegível para o `stepKey`, devolve string vazia para
 * evitar enviar UUID inválido ao servidor.
 */
/**
 * Indica preenchimento completo a partir de um clique num slot vazio (profissional, tipo,
 * data e hora já definidos). Usado para UX somente leitura e para não limpar o ID antes da
 * lista de profissionais carregar.
 */
export function isConsultationAgendaSlotPrefillComplete(prefill: {
  scheduledProfessionalId?: string;
  stepKey?: ConsultationAppointmentStepKey;
  expectedDate?: Date;
  appointmentTime?: string;
} | null | undefined): boolean {
  if (!prefill) return false;
  return (
    !!prefill.scheduledProfessionalId &&
    !!prefill.stepKey &&
    !!prefill.expectedDate &&
    prefill.expectedDate instanceof Date &&
    !Number.isNaN(prefill.expectedDate.getTime()) &&
    typeof prefill.appointmentTime === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(prefill.appointmentTime)
  );
}

export function resolveInitialScheduledProfessionalId(params: {
  prefillProfessionalId?: string | null;
  defaultProfessionalId?: string | null;
  currentUser?: (ConsultationStepUserRef & { id: string }) | null;
  isSecretary: boolean;
  stepKey: ConsultationAppointmentStepKey;
  schedulableProfessionals?: Array<ConsultationStepUserRef & { id: string }>;
}): string {
  const {
    prefillProfessionalId,
    defaultProfessionalId,
    currentUser,
    isSecretary,
    stepKey,
    schedulableProfessionals,
  } = params;

  const candidate = (() => {
    if (prefillProfessionalId) return prefillProfessionalId;
    if (isSecretary) return defaultProfessionalId ?? '';
    if (currentUser && userEligibleForConsultationStep(currentUser, stepKey)) {
      return currentUser.id;
    }
    return '';
  })();

  if (!candidate) return '';

  if (schedulableProfessionals && schedulableProfessionals.length > 0) {
    const eligible = schedulableProfessionals.find(
      (u) => u.id === candidate && userEligibleForConsultationStep(u, stepKey)
    );
    return eligible ? candidate : '';
  }

  return candidate;
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

/** Vista do painel de disponibilidade na página Agenda (intervalo do overview na API). */
export type ConsultationAgendaCalendarView = 'month' | 'week' | 'day';

export function consultationAgendaOverviewIsoRange(
  view: ConsultationAgendaCalendarView,
  anchor: Date
): { fromIso: string; toIso: string } {
  if (view === 'month') {
    const start = startOfMonth(anchor);
    start.setHours(0, 0, 0, 0);
    const end = endOfMonth(anchor);
    end.setHours(23, 59, 59, 999);
    return { fromIso: start.toISOString(), toIso: end.toISOString() };
  }
  if (view === 'week') {
    const start = startOfWeek(anchor, { locale: ptBR });
    start.setHours(0, 0, 0, 0);
    const end = endOfWeek(anchor, { locale: ptBR });
    end.setHours(23, 59, 59, 999);
    return { fromIso: start.toISOString(), toIso: end.toISOString() };
  }
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const end = new Date(anchor);
  end.setHours(23, 59, 59, 999);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
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

/** Ordena por horário agendado (`expectedDate`); itens sem data ficam no fim. */
export function sortConsultationAgendaItemsByExpectedDate(
  items: ConsultationAgendaItem[]
): ConsultationAgendaItem[] {
  return [...items].sort((a, b) => {
    if (!a.expectedDate && !b.expectedDate) return 0;
    if (!a.expectedDate) return 1;
    if (!b.expectedDate) return -1;
    return parseISO(a.expectedDate).getTime() - parseISO(b.expectedDate).getTime();
  });
}

export function consultationAgendaItemDayKey(item: ConsultationAgendaItem): string {
  try {
    return format(parseISO(item.agendaDate), 'yyyy-MM-dd');
  } catch {
    return item.agendaDate.slice(0, 10);
  }
}

export function groupConsultationAgendaByDay(
  items: ConsultationAgendaItem[]
): Map<string, ConsultationAgendaItem[]> {
  const map = new Map<string, ConsultationAgendaItem[]>();
  for (const item of items) {
    const key = consultationAgendaItemDayKey(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  for (const [key, list] of map) {
    map.set(key, sortConsultationAgendaItemsByExpectedDate(list));
  }
  return map;
}

/** Filtros locais aplicados à página atual da lista (não alteram a query da API). */
export type ConsultationAgendaOperationalFilter = 'overdue' | 'awaiting_confirmation';

export function itemMatchesConsultationAgendaOperationalFilters(
  item: ConsultationAgendaItem,
  active: ConsultationAgendaOperationalFilter[]
): boolean {
  if (active.length === 0) {
    return true;
  }
  return active.every((filter) => {
    if (filter === 'overdue') {
      return item.status === 'OVERDUE';
    }
    if (filter === 'awaiting_confirmation') {
      return item.appointmentConfirmationStatus === 'AWAITING_RESPONSE';
    }
    return true;
  });
}

export function filterConsultationAgendaItemsByOperational(
  items: ConsultationAgendaItem[],
  active: ConsultationAgendaOperationalFilter[]
): ConsultationAgendaItem[] {
  if (active.length === 0) {
    return items;
  }
  return items.filter((item) =>
    itemMatchesConsultationAgendaOperationalFilters(item, active)
  );
}

export function consultationAgendaTodayRange(now = new Date()): {
  from: string;
  to: string;
} {
  const ymd = toYmd(startOfDay(now));
  return { from: ymd, to: ymd };
}

export function consultationAgendaNext7DaysRange(now = new Date()): {
  from: string;
  to: string;
} {
  const start = startOfDay(now);
  return { from: toYmd(start), to: toYmd(addDays(start, 6)) };
}

/** Lista paginada: total na API maior que itens na página atual. */
export function consultationAgendaListHasPaginationGap(params: {
  total: number;
  itemCount: number;
  totalPages: number;
}): boolean {
  return params.total > params.itemCount || params.totalPages > 1;
}

/** Deep link para o prontuário com etapa de navegação pré-selecionada. */
export function patientChartEvolutionHref(
  patientId: string,
  navigationStepId: string
): string {
  const params = new URLSearchParams({
    tab: 'prontuario',
    navigationStepId,
  });
  return `/patients/${patientId}?${params.toString()}`;
}
