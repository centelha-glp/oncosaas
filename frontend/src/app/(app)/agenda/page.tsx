'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { endOfMonth, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { CalendarDays, Plus, RefreshCw } from 'lucide-react';
import { ConsultationAgendaAvailabilityCalendar } from '@/components/oncology-navigation/consultation-agenda-availability-calendar';
import { ConsultationAgendaDaySection } from '@/components/oncology-navigation/consultation-agenda-day-section';
import { ConsultationAgendaFilters } from '@/components/oncology-navigation/consultation-agenda-filters';
import { ConsultationAgendaPagination } from '@/components/oncology-navigation/consultation-agenda-pagination';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  consultationAgendaOverviewIsoRange,
  consultationAgendaOverviewStepKeyForUser,
  type ConsultationAgendaCalendarView,
  type ConsultationAppointmentStepKey,
  groupConsultationAgendaByDay,
  toYmd,
} from '@/lib/utils/consultationAgenda';
import {
  useConsultationAgenda,
  useConsultationAgendaDayOverview,
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
  const { data: schedulableProfessionals = [] } =
    useConsultationAgendaSchedulableProfessionals({
      enabled: showProfessionalFilter,
    });
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
    setAgendaSelectedDay(monthStart);
  }, [from]);

  const overviewRange = useMemo(
    () => consultationAgendaOverviewIsoRange(agendaCalendarView, agendaCalendarAnchor),
    [agendaCalendarView, agendaCalendarAnchor]
  );

  const calendarDisabledReason =
    showProfessionalFilter && !professionalId
      ? 'Selecione um profissional no filtro para ver a disponibilidade por dia de consultas.'
      : null;

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

  const queryParams = useMemo(
    () => ({
      from,
      to,
      scope,
      page,
      limit,
      ...(professionalId ? { professionalId } : {}),
    }),
    [from, to, scope, page, limit, professionalId]
  );

  const { data, isLoading, isFetching, isError, error, refetch } =
    useConsultationAgenda(queryParams);

  const grouped = useMemo(
    () =>
      data?.items ? groupConsultationAgendaByDay(data.items) : new Map(),
    [data?.items]
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

  const handleSelectAgendaDay = useCallback((d: Date) => {
    const day = startOfDay(d);
    setAgendaSelectedDay(day);
    setAgendaCalendarAnchor(day);
  }, []);

  const totalPages = data?.totalPages ?? 0;

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
              disabled={isFetching}
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

        <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2 xl:items-start">
          <div className="min-w-0 space-y-6">
            <ConsultationAgendaFilters
              from={from}
              to={to}
              scope={scope}
              professionalId={professionalId}
              showProfessionalFilter={showProfessionalFilter}
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
            />

            {isError && (
              <Alert variant="destructive">
                <AlertTitle>Não foi possível carregar a agenda</AlertTitle>
                <AlertDescription>
                  {error instanceof Error ? error.message : 'Erro desconhecido.'}
                </AlertDescription>
              </Alert>
            )}

            {isLoading && (
              <div className="space-y-4" aria-busy="true" aria-label="Carregando agenda">
                <Skeleton className="h-10 w-full max-w-md" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {!isLoading && data && data.total === 0 && (
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

            {!isLoading && data && data.total > 0 && (
              <>
                <p className="text-sm text-muted-foreground" role="status">
                  Exibindo {data.items.length} de {data.total} registro
                  {data.total === 1 ? '' : 's'}
                  {totalPages > 1
                    ? ` · Página ${data.page} de ${totalPages}`
                    : ''}
                </p>

                <div className="space-y-8">
                  {sortedDayKeys.map((dayKey) => (
                    <ConsultationAgendaDaySection
                      key={dayKey}
                      dayKey={dayKey}
                      items={grouped.get(dayKey) ?? []}
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

          <ConsultationAgendaAvailabilityCalendar
            className="lg:sticky lg:top-4 min-w-0"
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
        </div>
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
