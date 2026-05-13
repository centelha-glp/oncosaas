'use client';

import { useMemo } from 'react';
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  parse,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConsultationAgendaDayOverviewStatus } from '@/lib/api/oncology-navigation';
import {
  CONSULTATION_APPOINTMENT_STEP_META,
  combineLocalDateAndTime,
  type ConsultationAgendaCalendarView,
  type ConsultationAppointmentStepKey,
  isoUtcToSaoPauloHHmm,
  isoUtcToSaoPauloYmd,
  toYmd,
} from '@/lib/utils/consultationAgenda';
import { cn } from '@/lib/utils';
import { useConsultationAvailableSlots } from '@/hooks/useOncologyNavigation';

const STATUS_LABELS: Record<ConsultationAgendaDayOverviewStatus, string> = {
  HAS_SLOTS: 'Com vagas livres',
  FULL: 'Todas as vagas ocupadas',
  UNAVAILABLE: 'Indisponível',
};

function ymdToDate(ymd: string): Date {
  return parseISO(ymd);
}

function dayStatusClass(status: ConsultationAgendaDayOverviewStatus | undefined): string {
  if (status === 'HAS_SLOTS') {
    return '!bg-emerald-500/20 text-foreground ring-1 ring-emerald-600/35 font-medium';
  }
  if (status === 'FULL') {
    return '!bg-amber-500/20 text-foreground ring-1 ring-amber-600/35';
  }
  return '!bg-muted/70 text-muted-foreground ring-1 ring-border';
}

export interface ConsultationAgendaAvailabilityCalendarProps {
  view: ConsultationAgendaCalendarView;
  onViewChange: (v: ConsultationAgendaCalendarView) => void;
  /** Mês visível (vista mês), ou qualquer dia da semana (vista semana), ou o dia (vista dia). */
  anchorDate: Date;
  onAnchorDateChange: (d: Date) => void;
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  dayStatusMap: Record<string, ConsultationAgendaDayOverviewStatus>;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  disabledReason?: string | null;
  className?: string;
  professionalId: string | null;
  slotsStepKey: ConsultationAppointmentStepKey | null;
  onSlotsStepKeyChange?: (k: ConsultationAppointmentStepKey) => void;
  /** Quando o profissional é elegível a ambos os tipos de consulta (overview sem stepKey fixo). */
  showStepKeySelector: boolean;
  onSlotClick: (opts: { timeHHmm: string; calendarDate: Date }) => void;
  /** Ao mudar o mês na vista «Mês», sincronizar período da lista principal (filtros). */
  onSyncListToMonth?: (monthStart: Date) => void;
}

export function ConsultationAgendaAvailabilityCalendar({
  view,
  onViewChange,
  anchorDate,
  onAnchorDateChange,
  selectedDate,
  onSelectDate,
  dayStatusMap,
  isLoading,
  isError,
  errorMessage,
  disabledReason,
  className,
  professionalId,
  slotsStepKey,
  onSlotsStepKeyChange,
  showStepKeySelector,
  onSlotClick,
  onSyncListToMonth,
}: ConsultationAgendaAvailabilityCalendarProps) {
  const { hasSlots, full, unavailable } = useMemo(() => {
    const agendaHasSlots: Date[] = [];
    const agendaFull: Date[] = [];
    const agendaUnavailable: Date[] = [];
    for (const [ymd, st] of Object.entries(dayStatusMap)) {
      const d = ymdToDate(ymd);
      if (st === 'HAS_SLOTS') {
        agendaHasSlots.push(d);
      } else if (st === 'FULL') {
        agendaFull.push(d);
      } else {
        agendaUnavailable.push(d);
      }
    }
    return {
      hasSlots: agendaHasSlots,
      full: agendaFull,
      unavailable: agendaUnavailable,
    };
  }, [dayStatusMap]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchorDate, { locale: ptBR });
    const end = endOfWeek(anchorDate, { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [anchorDate]);

  const monthForPicker = useMemo(
    () => new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1),
    [anchorDate]
  );

  const slotsRange = useMemo(() => {
    if (!professionalId || !slotsStepKey || !selectedDate) return null;
    const start = combineLocalDateAndTime(selectedDate, '00:00');
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return {
      professionalId,
      stepKey: slotsStepKey,
      from: start.toISOString(),
      to: end.toISOString(),
    };
  }, [professionalId, slotsStepKey, selectedDate]);

  const {
    data: slotsData,
    isFetching: slotsFetching,
    refetch: refetchSlots,
    isError: slotsError,
    error: slotsErr,
  } = useConsultationAvailableSlots(slotsRange, {
    enabled: !!slotsRange && !disabledReason,
  });

  const slots = slotsData?.slots ?? [];

  const shiftWeek = (delta: -1 | 1) => {
    onAnchorDateChange(addDays(anchorDate, delta * 7));
  };

  const shiftDay = (delta: -1 | 1) => {
    onAnchorDateChange(addDays(anchorDate, delta));
    const next = addDays(selectedDate ?? anchorDate, delta);
    onSelectDate(startOfDay(next));
  };

  if (disabledReason) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Disponibilidade</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{disabledReason}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Disponibilidade</CardTitle>
        <p className="text-xs text-muted-foreground">
          Cores por dia: turnos da configuração, bloqueios e consultas já agendadas para o
          profissional selecionado. Escolha um dia e um horário livre para abrir «Nova consulta»
          com data e hora preenchidas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul
          className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
          aria-label="Legenda do calendário de disponibilidade"
        >
          <li className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm bg-emerald-500/25 ring-1 ring-emerald-600/40"
              aria-hidden
            />
            {STATUS_LABELS.HAS_SLOTS}
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm bg-amber-500/25 ring-1 ring-amber-600/40"
              aria-hidden
            />
            {STATUS_LABELS.FULL}
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm bg-muted ring-1 ring-border"
              aria-hidden
            />
            {STATUS_LABELS.UNAVAILABLE}
          </li>
        </ul>

        {showStepKeySelector && onSlotsStepKeyChange && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">Tipo de consulta (horários)</p>
            <Select
              value={slotsStepKey ?? undefined}
              onValueChange={(v) =>
                onSlotsStepKeyChange(v as ConsultationAppointmentStepKey)
              }
            >
              <SelectTrigger aria-label="Tipo de consulta para listar horários livres">
                <SelectValue placeholder="Escolha o tipo para ver horários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="specialist_consultation">
                  {CONSULTATION_APPOINTMENT_STEP_META.specialist_consultation.stepName}
                </SelectItem>
                <SelectItem value="navigation_consultation">
                  {CONSULTATION_APPOINTMENT_STEP_META.navigation_consultation.stepName}
                </SelectItem>
              </SelectContent>
            </Select>
            {!slotsStepKey && (
              <p className="text-xs text-muted-foreground">
                Este profissional pode exercer os dois papéis. Escolha o tipo acima para carregar
                as vagas.
              </p>
            )}
          </div>
        )}

        <Tabs value={view} onValueChange={(v) => onViewChange(v as ConsultationAgendaCalendarView)}>
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="month" className="text-xs sm:text-sm">
              Mês
            </TabsTrigger>
            <TabsTrigger value="week" className="text-xs sm:text-sm">
              Semana
            </TabsTrigger>
            <TabsTrigger value="day" className="text-xs sm:text-sm">
              Dia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="month" className="mt-4 space-y-3">
            {isLoading && (
              <Skeleton
                className="h-[320px] w-full rounded-md"
                aria-busy
                aria-label="Carregando disponibilidade"
              />
            )}
            {isError && (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage ?? 'Não foi possível carregar a disponibilidade.'}
              </p>
            )}
            {!isLoading && !isError && (
              <div className="w-full" role="region" aria-label="Calendário de disponibilidade por mês">
                <Calendar
                  mode="single"
                  month={monthForPicker}
                  onMonthChange={(m) => {
                    const first = startOfMonth(m);
                    onAnchorDateChange(startOfDay(first));
                    onSyncListToMonth?.(first);
                  }}
                  selected={selectedDate ?? undefined}
                  onSelect={(d) => {
                    if (d) onSelectDate(startOfDay(d));
                  }}
                  locale={ptBR}
                  showOutsideDays
                  className="w-full rounded-md border"
                  modifiers={{
                    agenda_has_slots: hasSlots,
                    agenda_full: full,
                    agenda_unavailable: unavailable,
                  }}
                  modifiersClassNames={{
                    agenda_has_slots:
                      '!bg-emerald-500/20 text-foreground ring-1 ring-emerald-600/35 font-medium',
                    agenda_full:
                      '!bg-amber-500/20 text-foreground ring-1 ring-amber-600/35',
                    agenda_unavailable:
                      '!bg-muted/70 text-muted-foreground ring-1 ring-border',
                  }}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="week" className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => shiftWeek(-1)}
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="min-w-0 flex-1 text-center text-sm font-medium text-foreground">
                {format(weekDays[0]!, 'd MMM', { locale: ptBR })} —{' '}
                {format(weekDays[6]!, 'd MMM yyyy', { locale: ptBR })}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => shiftWeek(1)}
                aria-label="Próxima semana"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {isLoading && (
              <Skeleton className="h-24 w-full rounded-md" aria-busy />
            )}
            {isError && (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage ?? 'Não foi possível carregar a disponibilidade.'}
              </p>
            )}
            {!isLoading && !isError && (
              <div
                className="grid grid-cols-7 gap-1 sm:gap-2"
                role="group"
                aria-label="Dias da semana"
              >
                {weekDays.map((d) => {
                  const ymd = toYmd(d);
                  const st = dayStatusMap[ymd];
                  const isSel = selectedDate ? isSameDay(d, selectedDate) : false;
                  return (
                    <div key={ymd} className="flex min-w-0 flex-col items-center gap-1">
                      <span className="text-[0.65rem] font-medium uppercase text-muted-foreground sm:text-xs">
                        {format(d, 'EEE', { locale: ptBR })}
                      </span>
                      <Button
                        type="button"
                        variant={isSel ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-auto min-h-10 w-full flex-col px-0 py-2 text-xs sm:text-sm',
                          !isSel && dayStatusClass(st)
                        )}
                        onClick={() => {
                          onSelectDate(startOfDay(d));
                          onAnchorDateChange(startOfDay(d));
                        }}
                        aria-pressed={isSel}
                        aria-label={`${format(d, 'EEEE d', { locale: ptBR })}`}
                      >
                        {format(d, 'd')}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="day" className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => shiftDay(-1)}
                aria-label="Dia anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="min-w-0 flex-1 text-center text-sm font-medium text-foreground">
                {format(anchorDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => shiftDay(1)}
                aria-label="Próximo dia"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {isLoading && (
              <Skeleton className="h-16 w-full rounded-md" aria-busy />
            )}
            {isError && (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage ?? 'Não foi possível carregar a disponibilidade.'}
              </p>
            )}
            {!isLoading && !isError && (
              <Button
                type="button"
                variant={selectedDate && isSameDay(anchorDate, selectedDate) ? 'default' : 'outline'}
                className={cn(
                  'w-full justify-center',
                  !(selectedDate && isSameDay(anchorDate, selectedDate)) &&
                    dayStatusClass(dayStatusMap[toYmd(anchorDate)])
                )}
                onClick={() => onSelectDate(startOfDay(anchorDate))}
              >
                {STATUS_LABELS[dayStatusMap[toYmd(anchorDate)] ?? 'UNAVAILABLE']}
              </Button>
            )}
          </TabsContent>
        </Tabs>

        <div
          className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
          role="region"
          aria-label="Horários livres no dia selecionado"
        >
          <div className="flex flex-wrap items-center gap-2">
            <CalendarClock className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Horários livres</p>
              <p className="text-xs text-muted-foreground">
                {selectedDate
                  ? format(selectedDate, "d 'de' MMMM yyyy", { locale: ptBR })
                  : 'Selecione um dia no calendário.'}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => refetchSlots()}
              disabled={!slotsRange}
            >
              Atualizar
            </Button>
            {slotsFetching && (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                A carregar…
              </span>
            )}
          </div>
          {!selectedDate && (
            <p className="text-sm text-muted-foreground">Escolha um dia para ver as vagas.</p>
          )}
          {selectedDate && !slotsStepKey && showStepKeySelector && (
            <p className="text-sm text-muted-foreground">
              Escolha o tipo de consulta acima para carregar os horários.
            </p>
          )}
          {slotsError && (
            <p className="text-sm text-destructive" role="alert">
              {(slotsErr as Error)?.message ?? 'Erro ao buscar horários.'}
            </p>
          )}
          {slotsRange && !slotsFetching && slots.length === 0 && !slotsError && (
            <p className="text-sm text-muted-foreground">
              Sem vagas para este dia. Verifique a configuração em Agenda →
              Configuração da agenda.
            </p>
          )}
          {slots.length > 0 && (
            <div
              className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
              role="group"
              aria-label="Inícios de consulta disponíveis"
            >
              {slots.map((iso) => {
                const hhmm = isoUtcToSaoPauloHHmm(iso);
                const ymd = isoUtcToSaoPauloYmd(iso);
                return (
                  <Button
                    key={iso}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono tabular-nums"
                    onClick={() => {
                      const calendarDate = parse(ymd, 'yyyy-MM-dd', new Date());
                      onSlotClick({ timeHHmm: hhmm, calendarDate });
                    }}
                    aria-label={`Abrir nova consulta às ${hhmm}`}
                  >
                    {hhmm}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
