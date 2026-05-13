'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConsultationAgendaScope } from '@/lib/api/oncology-navigation';
import { useConsultationAgendaSchedulableProfessionals } from '@/hooks/useOncologyNavigation';

const dateInputClass =
  'flex h-10 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export interface ConsultationAgendaFiltersProps {
  from: string;
  to: string;
  scope: ConsultationAgendaScope;
  /** ID do profissional agendado ou string vazia para todos. */
  professionalId: string;
  /** Secretaria e gestão: mostrar filtro; demais papéis a agenda já é só a própria no servidor. */
  showProfessionalFilter?: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onScopeChange: (value: ConsultationAgendaScope) => void;
  onProfessionalIdChange: (value: string) => void;
  onShiftMonth: (delta: -1 | 1) => void;
}

const ALL_PROFESSIONALS = '__all__';

export function ConsultationAgendaFilters({
  from,
  to,
  scope,
  professionalId,
  showProfessionalFilter = true,
  onFromChange,
  onToChange,
  onScopeChange,
  onProfessionalIdChange,
  onShiftMonth,
}: ConsultationAgendaFiltersProps) {
  const { data: schedulableProfessionals = [], isLoading: usersLoading } =
    useConsultationAgendaSchedulableProfessionals({
      enabled: showProfessionalFilter,
    });

  return (
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
              onChange={(e) => onFromChange(e.target.value)}
              className={dateInputClass}
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
              onChange={(e) => onToChange(e.target.value)}
              className={dateInputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span id="agenda-scope-label" className="text-sm font-medium">
              Escopo
            </span>
            <Select
              value={scope}
              onValueChange={(v) => onScopeChange(v as ConsultationAgendaScope)}
            >
              <SelectTrigger
                className="w-[220px]"
                aria-labelledby="agenda-scope-label"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultations">Somente consultas</SelectItem>
                <SelectItem value="all">Todas as etapas com data</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showProfessionalFilter && (
            <div className="flex flex-col gap-1.5">
              <span
                id="agenda-professional-label"
                className="text-sm font-medium"
              >
                Profissional
              </span>
              <Select
                value={professionalId || ALL_PROFESSIONALS}
                onValueChange={(v) =>
                  onProfessionalIdChange(v === ALL_PROFESSIONALS ? '' : v)
                }
                disabled={usersLoading}
              >
                <SelectTrigger
                  className="w-[260px]"
                  aria-labelledby="agenda-professional-label"
                >
                  <SelectValue
                    placeholder={
                      usersLoading ? 'Carregando…' : 'Filtrar por profissional'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROFESSIONALS}>
                    Todos os profissionais
                  </SelectItem>
                  {schedulableProfessionals.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onShiftMonth(-1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Mês anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onShiftMonth(1)}
          >
            Próximo mês
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
