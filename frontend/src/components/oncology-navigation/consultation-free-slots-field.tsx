'use client';

import { useMemo } from 'react';
import { format, parse } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConsultationAvailableSlots } from '@/hooks/useOncologyNavigation';
import type { ConsultationAppointmentStepKey } from '@/lib/utils/consultationAgenda';
import {
  combineLocalDateAndTime,
  isoUtcToSaoPauloHHmm,
  isoUtcToSaoPauloYmd,
} from '@/lib/utils/consultationAgenda';
import { cn } from '@/lib/utils';

export interface ConsultationFreeSlotsFieldProps {
  professionalId: string;
  stepKey: ConsultationAppointmentStepKey;
  selectedDate: Date | undefined;
  /** Para realçar o botão que corresponde à data/hora já escolhidas no formulário. */
  formTimeHHmm?: string;
  disabled?: boolean;
  onApplySlot: (opts: {
    slotIso: string;
    calendarDate: Date;
    timeHHmm: string;
  }) => void;
}

export function ConsultationFreeSlotsField({
  professionalId,
  stepKey,
  selectedDate,
  formTimeHHmm,
  disabled,
  onApplySlot,
}: ConsultationFreeSlotsFieldProps) {
  const range = useMemo(() => {
    if (!selectedDate || !professionalId) return null;
    const start = combineLocalDateAndTime(selectedDate, '00:00');
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return {
      professionalId,
      stepKey,
      from: start.toISOString(),
      to: end.toISOString(),
    };
  }, [selectedDate, professionalId, stepKey]);

  const { data, isFetching, refetch, isError, error } = useConsultationAvailableSlots(
    range,
    {
      enabled: !disabled && !!range,
    }
  );

  const slots = data?.slots ?? [];

  const formYmd =
    selectedDate && !Number.isNaN(selectedDate.getTime())
      ? format(selectedDate, 'yyyy-MM-dd')
      : undefined;

  return (
    <div
      className="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4"
      role="region"
      aria-label="Horários livres da agenda"
    >
      <div className="flex flex-wrap items-center gap-2">
        <CalendarClock className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Horários livres neste dia</p>
          <p className="text-xs text-muted-foreground">
            Toque num horário para preencher automaticamente o campo «Horário» abaixo. A lista
            carrega quando o profissional e a data estão definidos.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={!range || !!disabled}
        >
          Atualizar
        </Button>
        {isFetching && (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            A carregar…
          </span>
        )}
      </div>
      {isError && (
        <p className="text-sm text-destructive" role="alert">
          {(error as Error)?.message ?? 'Erro ao buscar horários.'}
        </p>
      )}
      {range && !isFetching && slots.length === 0 && (
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Sem vagas</strong> para este dia e
          profissional. Isto é normal se ainda não existir configuração em{' '}
          <span className="whitespace-nowrap">Agenda → Configuração da agenda</span>. Pode
          indicar o horário manualmente no campo seguinte.
        </p>
      )}
      {slots.length > 0 && (
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
          role="group"
          aria-label="Lista de inícios de consulta disponíveis"
        >
          {slots.map((iso) => {
            const hhmm = isoUtcToSaoPauloHHmm(iso);
            const ymd = isoUtcToSaoPauloYmd(iso);
            const matchesForm =
              formTimeHHmm === hhmm && formYmd != null && formYmd === ymd;
            return (
              <Button
                key={iso}
                type="button"
                variant={matchesForm ? 'default' : 'outline'}
                size="sm"
                className={cn('font-mono tabular-nums', matchesForm && 'ring-2 ring-primary')}
                disabled={!!disabled}
                onClick={() => {
                  const calendarDate = parse(ymd, 'yyyy-MM-dd', new Date());
                  onApplySlot({ slotIso: iso, calendarDate, timeHHmm: hhmm });
                }}
              >
                {hhmm}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
