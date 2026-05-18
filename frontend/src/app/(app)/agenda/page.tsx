'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { endOfMonth, format, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Plus, RefreshCw, UserRound } from 'lucide-react';
import { ConsultationAgendaAvailabilityCalendar } from '@/components/oncology-navigation/consultation-agenda-availability-calendar';
import { ConsultationAgendaDaySection } from '@/components/oncology-navigation/consultation-agenda-day-section';
import { ConsultationAgendaMetricsStrip } from '@/components/oncology-navigation/consultation-agenda-metrics-strip';
import { ConsultationAgendaFilters } from '@/components/oncology-navigation/consultation-agenda-filters';
import { ConsultationAgendaOperationalBar } from '@/components/oncology-navigation/consultation-agenda-operational-bar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConsultationAgendaPagination } from '@/components/oncology-navigation/consultation-agenda-pagination';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  consultationAgendaListHasPaginationGap,
  consultationAgendaNext7DaysRange,
  consultationAgendaOverviewIsoRange,
  consultationAgendaOverviewStepKeyForUser,
  consultationAgendaTodayRange,
  filterConsultationAgendaItemsByOperational,
  type ConsultationAgendaCalendarView,
  type ConsultationAgendaOperationalFilter,
  type ConsultationAppointmentStepKey,
  formatAgendaDayLabel,
  groupConsultationAgendaByDay,
  toYmd,
} from '@/lib/utils/consultationAgenda';
import {
  useConsultationAgenda,
  useConsultationAgendaDayOverview,
  useConsultationAgendaMetrics,
  useConsultationAgendaSchedulableProfessionals,
} from '@/hooks/useOncologyNavigation';
import type { ConsultationAgendaScope } from '@/lib/api/oncology-navigation';
import {
  ConsultationAgendaNewAppointmentDialog,
  type ConsultationAgendaAppointmentPrefill,
} from '@/components/oncology-navigation/consultation-agenda-new-appointment-dialog';
import { useAuthStore } from '@/stores/auth-store';
import type { User } from '@/lib/api/users';

export default function ConsultationAgendaPage() {
  const { user } = useAuthStore();
  const showProfessionalFilter = user?.role === 'SECRETARY';
  const {
    data: schedulableProfessionals = [],
    isLoading: schedulableProfessionalsLoading,
  } = useConsultationAgendaSchedulableProfessionals();
  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => toYmd(startOfMonth(now)));
  const [to, setTo] = useState(() => toYmd(endOfMonth(now)));
  const [scope, setScope] = useState<ConsultationAgendaScope>('consultations');
  const [professionalId, setProfessionalId] = useState('');
  const [page, setPage] = useState(1);
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [appointmentPrefill, setAppointmentPrefill] =
    useState<ConsultationAgendaAppointmentPrefill | null>(null);
  const [agendaCalendarView, setAgendaCalendarView] =
    useState<ConsultationAgendaCalendarView>('month');
  const [agendaCalendarAnchor, setAgendaCalendarAnchor] = useState(() =>
    startOfMonth(now)
  );
  const [agendaSelectedDay, setAgendaSelectedDay] = useState<Date | null>(() =>
    startOfDay(now)
  );
  /** false = lista filtrada ao dia selecionado no calendário; true = intervalo De/Até (mês). */
  const [listShowsFullMonth, setListShowsFullMonth] = useState(false);
  const [operationalFilters, setOperationalFilters] = useState<
    ConsultationAgendaOperationalFilter[]
  >([]);
  const [manualSlotsStepKey, setManualSlotsStepKey] =
    useState<ConsultationAppointmentStepKey | null>(null);
  const limit = 50;

  const effectiveProfessionalId = showProfessionalFilter
    ? professionalId || null
    : user?.id ?? null;

  const overviewSubject = useMemo((): Pick<User, 'role' | 'clinicalSubrole'> | undefined => {
    if (!effectiveProfessionalId) {
      return undefined;
    }
    if (showProfessionalFilter) {
      const u = schedulableProfessionals.find(
        (x) => x.id === effectiveProfessionalId
      );
      return u
        ? { role: u.role, clinicalSubrole: u.clinicalSubrole ?? null }
        : undefined;
    }
    if (!user) {
      return undefined;
    }
    return { role: user.role, clinicalSubrole: user.clinicalSubrole ?? null };
  }, [
    effectiveProfessionalId,
    showProfessionalFilter,
    schedulableProfessionals,
    user,
  ]);

  const overviewStepKey = consultationAgendaOverviewStepKeyForUser(overviewSubject);

  const effectiveSlotsStepKey = overviewStepKey ?? manualSlotsStepKey;

  useEffect(() => {
    setManualSlotsStepKey(null);
  }, [effectiveProfessionalId, overviewStepKey]);

  useEffect(() => {
    const monthStart = startOfMonth(parseISO(from));
    setAgendaCalendarAnchor(monthStart);
    setAgendaSelectedDay((prev) => {
      if (!prev) return startOfDay(monthStart);
      const lastDay = endOfMonth(monthStart).getDate();
      const day = Math.min(prev.getDate(), lastDay);
      return startOfDay(
        new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
      );
    });
  }, [from]);

  const overviewRange = useMemo(
    () => consultationAgendaOverviewIsoRange(agendaCalendarView, agendaCalendarAnchor),
    [agendaCalendarView, agendaCalendarAnchor]
  );

  const secretaryNeedsProfessional =
    showProfessionalFilter && !professionalId;

  const calendarDisabledReason = secretaryNeedsProfessional
    ? 'Selecione um profissional no filtro para ver a disponibilidade por dia de consultas.'
    : null;

  const agendaListEnabled = !secretaryNeedsProfessional;

  const showStepKeySelector =
    !!effectiveProfessionalId &&
    overviewStepKey === undefined &&
    !calendarDisabledReason;

  const overviewQuery = useMemo(() => {
    if (!effectiveProfessionalId) {
      return null;
    }
    return {
      professionalId: effectiveProfessionalId,
      from: overviewRange.fromIso,
      to: overviewRange.toIso,
      ...(overviewStepKey ? { stepKey: overviewStepKey } : {}),
    };
  }, [effectiveProfessionalId, overviewRange.fromIso, overviewRange.toIso, overviewStepKey]);

  const {
    data: overviewData,
    isLoading: overviewLoading,
    isError: overviewError,
    error: overviewErr,
  } = useConsultationAgendaDayOverview(overviewQuery, {
    enabled: !!overviewQuery,
  });

  const selectedDayYmd = agendaSelectedDay ? toYmd(agendaSelectedDay) : null;

  const listRange = useMemo(() => {
    if (!listShowsFullMonth && selectedDayYmd) {
      return { from: selectedDayYmd, to: selectedDayYmd };
    }
    return { from, to };
  }, [listShowsFullMonth, selectedDayYmd, from, to]);

  const queryParams = useMemo(
    () => ({
      ...listRange,
      scope,
      page,
      limit,
      ...(professionalId ? { professionalId } : {}),
    }),
    [listRange, scope, page, limit, professionalId]
  );

  const metricsParams = useMemo(
    () => ({
      from: listRange.from,
      to: listRange.to,
      ...(showProfessionalFilter && professionalId
        ? { professionalId }
        : {}),
    }),
    [listRange.from, listRange.to, showProfessionalFilter, professionalId]
  );

  const {
    data: metricsData,
    isLoading: metricsLoading,
    isError: metricsError,
    error: metricsErr,
  } = useConsultationAgendaMetrics(metricsParams, {
    enabled: agendaListEnabled,
  });

  const { data, isLoading, isFetching, isError, error, refetch } =
    useConsultationAgenda(queryParams, { enabled: agendaListEnabled });

  const filteredItems = useMemo(() => {
    if (!data?.items) {
      return [];
    }
    return filterConsultationAgendaItemsByOperational(
      data.items,
      operationalFilters
    );
  }, [data?.items, operationalFilters]);

  const grouped = useMemo(
    () => groupConsultationAgendaByDay(filteredItems),
    [filteredItems]
  );
  const sortedDayKeys = useMemo(
    () => Array.from(grouped.keys()).sort(),
    [grouped]
  );

  const shiftMonth = useCallback(
    (delta: -1 | 1) => {
      const anchor = startOfMonth(parseISO(from));
      const next = new Date(anchor);
      next.setMonth(next.getMonth() + delta);
      setFrom(toYmd(startOfMonth(next)));
      setTo(toYmd(endOfMonth(next)));
      setPage(1);
    },
    [from]
  );

  const onSyncListToMonth = useCallback((monthStart: Date) => {
    setFrom(toYmd(startOfMonth(monthStart)));
    setTo(toYmd(endOfMonth(monthStart)));
    setPage(1);
  }, []);

  const applyTodayRange = useCallback(() => {
    const today = startOfDay(new Date());
    const { from: fromYmd, to: toYmdVal } = consultationAgendaTodayRange(today);
    setFrom(fromYmd);
    setTo(toYmdVal);
    setAgendaSelectedDay(today);
    setAgendaCalendarAnchor(startOfMonth(today));
    setListShowsFullMonth(false);
    setPage(1);
  }, []);

  const applyNext7DaysRange = useCallback(() => {
    const today = startOfDay(new Date());
    const { from: fromYmd, to: toYmdVal } =
      consultationAgendaNext7DaysRange(today);
    setFrom(fromYmd);
    setTo(toYmdVal);
    setAgendaSelectedDay(today);
    setAgendaCalendarAnchor(today);
    setListShowsFullMonth(true);
    setPage(1);
  }, []);

  const toggleOperationalFilter = useCallback(
    (filter: ConsultationAgendaOperationalFilter) => {
      setOperationalFilters((prev) =>
        prev.includes(filter)
          ? prev.filter((f) => f !== filter)
          : [...prev, filter]
      );
    },
    []
  );

  const handleSelectAgendaDay = useCallback((d: Date) => {
    const day = startOfDay(d);
    setAgendaSelectedDay(day);
    setAgendaCalendarAnchor(day);
    setListShowsFullMonth(false);
    setPage(1);
  }, []);

  const totalPages = data?.totalPages ?? 0;

  const listHeading = useMemo(() => {
    if (!listShowsFullMonth && selectedDayYmd) {
      return `Consultas em ${formatAgendaDayLabel(`${selectedDayYmd}T12:00:00.000Z`)}`;
    }
    try {
      const monthLabel = format(parseISO(from), "MMMM 'de' yyyy", { locale: ptBR });
      return `Consultas no mês — ${monthLabel}`;
    } catch {
      return 'Consultas no período selecionado';
    }
  }, [listShowsFullMonth, selectedDayYmd, from]);

  const metricsPeriodLabel = useMemo(() => {
    if (!listShowsFullMonth && selectedDayYmd) {
      return `Métricas do dia selecionado`;
    }
    try {
      return `Métricas de ${format(parseISO(from), 'MMMM yyyy', { locale: ptBR })}`;
    } catch {
      return 'Métricas do período';
    }
  }, [listShowsFullMonth, selectedDayYmd, from]);

  const listHasPaginationGap =
    !!data &&
    consultationAgendaListHasPaginationGap({
      total: data.total,
      itemCount: data.items.length,
      totalPages,
    });

  const showPartialDayListWarning =
    !listShowsFullMonth && listHasPaginationGap;

  const showPartialMonthListWarning = listShowsFullMonth && listHasPaginationGap;

  const calendarPanel = (
    <ConsultationAgendaAvailabilityCalendar
      className="lg:sticky lg:top-4 min-w-0 xl:sticky xl:top-4"
      view={agendaCalendarView}
      onViewChange={setAgendaCalendarView}
      anchorDate={agendaCalendarAnchor}
      onAnchorDateChange={setAgendaCalendarAnchor}
      selectedDate={agendaSelectedDay}
      onSelectDate={handleSelectAgendaDay}
      professionalId={effectiveProfessionalId}
      slotsStepKey={effectiveSlotsStepKey}
      onSlotsStepKeyChange={setManualSlotsStepKey}
      showStepKeySelector={showStepKeySelector}
      onSyncListToMonth={onSyncListToMonth}
      onSlotClick={({ timeHHmm, calendarDate }) => {
        if (!effectiveProfessionalId || !effectiveSlotsStepKey) return;
        setAppointmentPrefill({
          scheduledProfessionalId: effectiveProfessionalId,
          stepKey: effectiveSlotsStepKey,
          expectedDate: calendarDate,
          appointmentTime: timeHHmm,
        });
        setNewAppointmentOpen(true);
      }}
      dayStatusMap={overviewData?.days ?? {}}
      isLoading={!!overviewQuery && overviewLoading}
      isError={!!overviewQuery && overviewError}
      errorMessage={
        overviewErr instanceof Error ? overviewErr.message : undefined
      }
      disabledReason={calendarDisabledReason}
    />
  );

  const listPanel = (
    <div className="min-w-0 space-y-6">
      <ConsultationAgendaFilters
        from={from}
        to={to}
        scope={scope}
        professionalId={professionalId}
        showProfessionalFilter={showProfessionalFilter}
        schedulableProfessionals={schedulableProfessionals}
        schedulableProfessionalsLoading={schedulableProfessionalsLoading}
        onFromChange={(v) => {
          const d = parseISO(v);
          setFrom(v);
          setTo(toYmd(endOfMonth(d)));
          setPage(1);
        }}
        onToChange={(v) => {
          const d = parseISO(v);
          setTo(v);
          setFrom(toYmd(startOfMonth(d)));
          setPage(1);
        }}
        onScopeChange={(v) => {
          setScope(v);
          setPage(1);
        }}
        onProfessionalIdChange={(v) => {
          setProfessionalId(v);
          setPage(1);
        }}
        onShiftMonth={shiftMonth}
        onToday={applyTodayRange}
        onNext7Days={applyNext7DaysRange}
      />

      {secretaryNeedsProfessional && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<UserRound className="h-12 w-12" aria-hidden />}
              title="Selecione um profissional"
              description="Escolha um profissional no filtro acima para ver a lista de consultas e a disponibilidade no calendário. A agenda não exibe registros de todos os profissionais ao mesmo tempo."
            />
          </CardContent>
        </Card>
      )}

      {!secretaryNeedsProfessional && isError && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar a agenda</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Erro desconhecido.'}
          </AlertDescription>
        </Alert>
      )}

      {!secretaryNeedsProfessional && isLoading && (
        <div
          className="space-y-4"
          aria-busy="true"
          aria-label="Carregando agenda"
        >
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!secretaryNeedsProfessional && !isLoading && data && data.total === 0 && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<CalendarDays className="h-12 w-12" aria-hidden />}
              title="Nenhum item no período"
              description="Ajuste as datas, o escopo ou verifique se as etapas têm data agendada preenchida."
            />
          </CardContent>
        </Card>
      )}

      {!secretaryNeedsProfessional &&
        !isLoading &&
        data &&
        data.total > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-medium text-foreground">
                {listHeading}
              </h2>
              {agendaSelectedDay && !listShowsFullMonth && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setListShowsFullMonth(true);
                    setPage(1);
                  }}
                >
                  Ver mês inteiro
                </Button>
              )}
              {agendaSelectedDay && listShowsFullMonth && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setListShowsFullMonth(false);
                    setPage(1);
                  }}
                >
                  Ver só o dia selecionado
                </Button>
              )}
            </div>

            <p className="text-sm text-muted-foreground" role="status">
              Exibindo {filteredItems.length} de {data.items.length} registro
              {data.items.length === 1 ? '' : 's'} nesta página
              {operationalFilters.length > 0 ? ' (com filtros ativos)' : ''}
              {' · '}
              {data.total} no período
              {totalPages > 1
                ? ` · Página ${data.page} de ${totalPages}`
                : ''}
            </p>

            {showPartialDayListWarning && (
              <p
                className="text-sm text-amber-800 dark:text-amber-200"
                role="status"
              >
                A lista está paginada: nem todas as consultas deste dia podem
                estar visíveis nesta página. Avance as páginas ou reduza o
                período.
              </p>
            )}

            {showPartialMonthListWarning && (
              <p
                className="text-sm text-amber-800 dark:text-amber-200"
                role="status"
              >
                A lista está paginada: alguns dias do período podem aparecer
                incompletos ou ausentes nesta página. Avance as páginas, use
                «Próximos 7 dias» ou selecione um dia no calendário.
              </p>
            )}

            {operationalFilters.length > 0 && filteredItems.length === 0 && (
              <p className="text-sm text-muted-foreground" role="status">
                Nenhum registro nesta página corresponde aos filtros ativos.
                Tente outra página ou limpe os filtros.
              </p>
            )}

            <div className="space-y-8">
              {sortedDayKeys.map((dayKey) => (
                <ConsultationAgendaDaySection
                  key={dayKey}
                  dayKey={dayKey}
                  items={grouped.get(dayKey) ?? []}
                  schedulableProfessionals={schedulableProfessionals}
                  schedulableProfessionalsLoading={
                    schedulableProfessionalsLoading
                  }
                />
              ))}
            </div>

            <ConsultationAgendaPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-muted/30 overflow-y-auto">
      <main
        className="mx-auto w-full max-w-full flex-1 space-y-6 p-4 md:p-6 xl:px-8"
        id="main-content"
      >
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Agenda
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Etapas de consulta com data agendada no mês selecionado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setAppointmentPrefill(null);
                setNewAppointmentOpen(true);
              }}
              aria-label="Registrar nova consulta na agenda"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Nova consulta
            </Button>
            <Link
              href="/agenda/settings"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Configuração da agenda
            </Link>
            {user?.role !== 'SECRETARY' && (
              <Link
                href="/oncology-navigation"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' })
                )}
              >
                Board de navegação
              </Link>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={!agendaListEnabled || isFetching}
              aria-label="Atualizar agenda"
            >
              <RefreshCw
                className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')}
                aria-hidden
              />
              Atualizar
            </Button>
          </div>
        </header>

        <ConsultationAgendaMetricsStrip
          periodLabel={metricsPeriodLabel}
          isLoading={agendaListEnabled && metricsLoading}
          isError={agendaListEnabled && metricsError}
          errorMessage={
            metricsErr instanceof Error ? metricsErr.message : undefined
          }
          metrics={agendaListEnabled ? metricsData : undefined}
        />

        <ConsultationAgendaOperationalBar
          active={operationalFilters}
          onToggle={toggleOperationalFilter}
          disabled={secretaryNeedsProfessional}
        />

        <div className="hidden gap-6 xl:grid xl:grid-cols-2 xl:items-start">
          {listPanel}
          {calendarPanel}
        </div>

        <Tabs defaultValue="lista" className="w-full xl:hidden">
          <TabsList className="grid h-auto w-full max-w-md grid-cols-2 p-1">
            <TabsTrigger value="lista" className="text-sm">
              Lista
            </TabsTrigger>
            <TabsTrigger value="disponibilidade" className="text-sm">
              Disponibilidade
            </TabsTrigger>
          </TabsList>
          <TabsContent value="lista" className="mt-4">
            {listPanel}
          </TabsContent>
          <TabsContent value="disponibilidade" className="mt-4">
            {calendarPanel}
          </TabsContent>
        </Tabs>

      </main>

      <ConsultationAgendaNewAppointmentDialog
        open={newAppointmentOpen}
        onOpenChange={(o) => {
          setNewAppointmentOpen(o);
          if (!o) setAppointmentPrefill(null);
        }}
        prefill={appointmentPrefill}
        defaultProfessionalId={
          showProfessionalFilter ? professionalId || null : null
        }
      />
    </div>
  );
}
