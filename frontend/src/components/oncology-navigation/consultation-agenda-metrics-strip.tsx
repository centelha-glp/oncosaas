'use client';

import type { ComponentType } from 'react';
import { AlertCircle, CheckCircle2, Clock, Timer } from 'lucide-react';
import type { ConsultationAgendaMetrics } from '@/lib/api/oncology-navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function formatMinutes(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value)} min`;
}

interface MetricTileProps {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  className?: string;
}

function MetricTile({ label, value, icon: Icon, className }: MetricTileProps) {
  return (
    <div
      className={cn(
        'flex min-w-[8.5rem] flex-1 items-center gap-3 rounded-lg border bg-card px-3 py-2.5',
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <p className="text-lg font-semibold leading-tight tabular-nums text-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export interface ConsultationAgendaMetricsStripProps {
  periodLabel: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  metrics?: ConsultationAgendaMetrics;
}

export function ConsultationAgendaMetricsStrip({
  periodLabel,
  isLoading,
  isError,
  errorMessage,
  metrics,
}: ConsultationAgendaMetricsStripProps) {
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" aria-hidden />
        <AlertDescription>
          {errorMessage ?? 'Não foi possível carregar as métricas da agenda.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex flex-wrap gap-2"
        aria-busy="true"
        aria-label="Carregando métricas da agenda"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.25rem] min-w-[8.5rem] flex-1" />
        ))}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <section aria-label={`Métricas da agenda — ${periodLabel}`}>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{periodLabel}</p>
      <div className="flex flex-wrap gap-2">
        <MetricTile
          label="Consultas concluídas"
          value={String(metrics.completedAppointments)}
          icon={CheckCircle2}
        />
        <MetricTile
          label="Faltas (no-show)"
          value={String(metrics.noShows)}
          icon={AlertCircle}
        />
        <MetricTile
          label="Espera média"
          value={formatMinutes(metrics.avgWaitingMinutes)}
          icon={Clock}
        />
        <MetricTile
          label="Atraso médio"
          value={formatMinutes(metrics.avgLateMinutes)}
          icon={Timer}
        />
      </div>
    </section>
  );
}
