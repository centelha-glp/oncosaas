'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { endOfWeek, parseISO, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { NavigationBar } from '@/components/shared/navigation-bar';
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
  groupConsultationAgendaByDay,
  toYmd,
} from '@/lib/utils/consultationAgenda';
import { useConsultationAgenda } from '@/hooks/useOncologyNavigation';
import type { ConsultationAgendaScope } from '@/lib/api/oncology-navigation';

export default function ConsultationAgendaPage() {
  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() =>
    toYmd(startOfWeek(now, { locale: ptBR }))
  );
  const [to, setTo] = useState(() =>
    toYmd(endOfWeek(now, { locale: ptBR }))
  );
  const [scope, setScope] = useState<ConsultationAgendaScope>('consultations');
  const [page, setPage] = useState(1);
  const limit = 50;

  const queryParams = useMemo(
    () => ({
      from,
      to,
      scope,
      page,
      limit,
    }),
    [from, to, scope, page, limit]
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

  const shiftWeek = useCallback(
    (delta: -1 | 1) => {
      const anchor = parseISO(from);
      const next = new Date(anchor);
      next.setDate(next.getDate() + delta * 7);
      setFrom(toYmd(startOfWeek(next, { locale: ptBR })));
      setTo(toYmd(endOfWeek(next, { locale: ptBR })));
      setPage(1);
    },
    [from]
  );

  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <NavigationBar />
      <main
        className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-6"
        id="main-content"
      >
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Agenda
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Etapas de consulta com data prevista ou limite no período
              selecionado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/oncology-navigation"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Board de navegação
            </Link>
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

        <ConsultationAgendaFilters
          from={from}
          to={to}
          scope={scope}
          onFromChange={(v) => {
            setFrom(v);
            setPage(1);
          }}
          onToChange={(v) => {
            setTo(v);
            setPage(1);
          }}
          onScopeChange={(v) => {
            setScope(v);
            setPage(1);
          }}
          onShiftWeek={shiftWeek}
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
                description="Ajuste as datas, o escopo ou verifique se as etapas têm data prevista ou limite preenchidos."
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
      </main>
    </div>
  );
}
