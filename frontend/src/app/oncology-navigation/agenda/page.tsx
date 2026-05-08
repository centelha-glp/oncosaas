'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { NavigationBar } from '@/components/shared/navigation-bar';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { JOURNEY_STAGE_LABELS, type JourneyStage } from '@/lib/utils/journey-stage';
import { useConsultationAgenda } from '@/hooks/useOncologyNavigation';
import type { ConsultationAgendaItem, ConsultationAgendaScope } from '@/lib/api/oncology-navigation';

function toYmd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  OVERDUE: 'Atrasada',
  CANCELLED: 'Cancelada',
  NOT_APPLICABLE: 'Não aplicável',
};

function statusBadgeVariant(
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

function formatAgendaDayLabel(iso: string): string {
  try {
    return format(parseISO(iso), "EEEE, d 'de' MMMM", { locale: ptBR });
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

function groupByAgendaDay(items: ConsultationAgendaItem[]): Map<string, ConsultationAgendaItem[]> {
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
    () => (data?.items ? groupByAgendaDay(data.items) : new Map()),
    [data?.items]
  );
  const sortedDayKeys = useMemo(
    () => Array.from(grouped.keys()).sort(),
    [grouped]
  );

  const shiftWeek = useCallback((delta: -1 | 1) => {
    const anchor = parseISO(from);
    const next = new Date(anchor);
    next.setDate(next.getDate() + delta * 7);
    setFrom(toYmd(startOfWeek(next, { locale: ptBR })));
    setTo(toYmd(endOfWeek(next, { locale: ptBR })));
    setPage(1);
  }, [from]);

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
              Agenda de consultas
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Etapas de consulta com data prevista ou limite no período selecionado.
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

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="agenda-from" className="text-sm font-medium">
                  De
                </label>
                <input
                  id="agenda-from"
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                  className="flex h-10 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="agenda-to" className="text-sm font-medium">
                  Até
                </label>
                <input
                  id="agenda-to"
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                  className="flex h-10 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span id="agenda-scope-label" className="text-sm font-medium">
                  Escopo
                </span>
                <Select
                  value={scope}
                  onValueChange={(v) => {
                    setScope(v as ConsultationAgendaScope);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="w-[220px]"
                    aria-labelledby="agenda-scope-label"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultations">
                      Somente consultas
                    </SelectItem>
                    <SelectItem value="all">Todas as etapas com data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => shiftWeek(-1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                Semana anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => shiftWeek(1)}
              >
                Próxima semana
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>

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
              {sortedDayKeys.map((dayKey) => {
                const dayItems = grouped.get(dayKey) ?? [];
                const headerIso = `${dayKey}T12:00:00.000Z`;
                return (
                  <section
                    key={dayKey}
                    aria-labelledby={`agenda-day-${dayKey}`}
                    className="space-y-3"
                  >
                    <h2
                      id={`agenda-day-${dayKey}`}
                      className="text-lg font-semibold capitalize text-foreground"
                    >
                      {formatAgendaDayLabel(headerIso)}
                    </h2>
                    <ul className="space-y-3" role="list">
                      {dayItems.map((item: ConsultationAgendaItem) => (
                        <li key={item.id}>
                          <Card
                            className={cn(
                              'border-l-4',
                              item.status === 'OVERDUE' && 'border-l-destructive',
                              item.status === 'COMPLETED' && 'border-l-emerald-600',
                              item.status === 'IN_PROGRESS' && 'border-l-primary',
                              item.status === 'PENDING' && 'border-l-muted-foreground'
                            )}
                          >
                            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-foreground">
                                    {item.stepName}
                                  </span>
                                  <Badge variant={statusBadgeVariant(item.status)}>
                                    {STATUS_LABEL[item.status] ?? item.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {item.patient.name}
                                  </span>
                                  {' · '}
                                  {JOURNEY_STAGE_LABELS[
                                    item.journeyStage as JourneyStage
                                  ] ?? item.journeyStage}
                                </p>
                                <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                                  <div>
                                    <dt className="inline font-medium text-foreground">
                                      Prevista:{' '}
                                    </dt>
                                    <dd className="inline">
                                      {formatShortDate(item.expectedDate)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="inline font-medium text-foreground">
                                      Limite:{' '}
                                    </dt>
                                    <dd className="inline">
                                      {formatShortDate(item.dueDate)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="inline font-medium text-foreground">
                                      Realizada:{' '}
                                    </dt>
                                    <dd className="inline">
                                      {formatShortDate(item.actualDate)}
                                    </dd>
                                  </div>
                                </dl>
                              </div>
                              <Link
                                href={`/patients/${item.patientId}`}
                                className={cn(
                                  buttonVariants({ variant: 'outline', size: 'sm' }),
                                  'inline-flex shrink-0 items-center gap-1'
                                )}
                              >
                                Ficha do paciente
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              </Link>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav
                className="flex flex-wrap items-center justify-center gap-2 pt-4"
                aria-label="Paginação da agenda"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}
