'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ConsultationAgendaOperationalFilter } from '@/lib/utils/consultationAgenda';

export interface ConsultationAgendaOperationalBarProps {
  active: ConsultationAgendaOperationalFilter[];
  onToggle: (filter: ConsultationAgendaOperationalFilter) => void;
  disabled?: boolean;
  className?: string;
}

const FILTER_META: Record<
  ConsultationAgendaOperationalFilter,
  { label: string; description: string }
> = {
  overdue: {
    label: 'Atrasadas',
    description: 'Etapas com status atrasado',
  },
  awaiting_confirmation: {
    label: 'Aguardando confirmação',
    description: 'Confirmação de consulta pendente',
  },
};

export function ConsultationAgendaOperationalBar({
  active,
  onToggle,
  disabled = false,
  className,
}: ConsultationAgendaOperationalBarProps) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label="Filtros rápidos da lista"
    >
      <span className="text-xs font-medium text-muted-foreground">Lista:</span>
      {(Object.keys(FILTER_META) as ConsultationAgendaOperationalFilter[]).map(
        (key) => {
          const isOn = active.includes(key);
          const meta = FILTER_META[key];
          return (
            <Button
              key={key}
              type="button"
              variant={isOn ? 'default' : 'outline'}
              size="sm"
              disabled={disabled}
              aria-pressed={isOn}
              title={meta.description}
              onClick={() => onToggle(key)}
            >
              {meta.label}
            </Button>
          );
        }
      )}
    </div>
  );
}
