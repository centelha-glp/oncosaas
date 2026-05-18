'use client';

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  ConsultationAgendaScope,
  ConsultationAgendaSchedulableProfessional,
} from '@/lib/api/oncology-navigation';
import { useConsultationAgendaSchedulableProfessionals } from '@/hooks/useOncologyNavigation';

export interface ConsultationAgendaFiltersProps {
  from: string;
  to: string;
  scope: ConsultationAgendaScope;
  /** ID do profissional agendado ou string vazia para todos. */
  professionalId: string;
  patientNameFilter: string;
  /** Secretaria e gestão: mostrar filtro; demais papéis a agenda já é só a própria no servidor. */
  showProfessionalFilter?: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onScopeChange: (value: ConsultationAgendaScope) => void;
  onProfessionalIdChange: (value: string) => void;
  onPatientNameFilterChange: (value: string) => void;
  onShiftMonth: (delta: -1 | 1) => void;
  onToday: () => void;
  onNext7Days: () => void;
  /** Evita fetch duplicado quando o pai já carregou a lista. */
  schedulableProfessionals?: ConsultationAgendaSchedulableProfessional[];
  schedulableProfessionalsLoading?: boolean;
}

const ALL_PROFESSIONALS = '__all__';

export function ConsultationAgendaFilters({
  from,
  to,
  scope,
  professionalId,
  patientNameFilter,
  showProfessionalFilter = true,
  onFromChange,
  onToChange,
  onScopeChange,
  onProfessionalIdChange,
  onPatientNameFilterChange,
  onShiftMonth,
  onToday,
  onNext7Days,
  schedulableProfessionals: schedulableProfessionalsProp,
  schedulableProfessionalsLoading: schedulableProfessionalsLoadingProp,
}: ConsultationAgendaFiltersProps) {
  const { data: fetchedProfessionals = [], isLoading: fetchedLoading } =
    useConsultationAgendaSchedulableProfessionals({
      enabled: showProfessionalFilter && schedulableProfessionalsProp === undefined,
    });
  const schedulableProfessionals =
    schedulableProfessionalsProp ?? fetchedProfessionals;
  const usersLoading =
    schedulableProfessionalsLoadingProp ?? fetchedLoading;

  let monthLabel = 'Período';
  try {
    monthLabel = format(parseISO(from), "MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    /* mantém fallback */
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium">Filtros</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ao abrir, a agenda mostra o dia de hoje. Use o mês abaixo para navegar no
          calendário e na lista.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onShiftMonth(-1)}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <p
              className="min-w-0 flex-1 text-center text-sm font-semibold capitalize text-foreground sm:text-left"
              id="agenda-month-label"
            >
              Mês de {monthLabel}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onShiftMonth(1)}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onToday}>
              Hoje
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNext7Days}
            >
              Próximos 7 dias
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agenda-patient-filter">Paciente</Label>
          <Input
            id="agenda-patient-filter"
            type="search"
            value={patientNameFilter}
            onChange={(e) => onPatientNameFilterChange(e.target.value)}
            placeholder="Buscar paciente por nome"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
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

        <details className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Período personalizado (De / Até)
          </summary>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste manual do intervalo da lista e das métricas. O controlo «Mês de…»
            acima continua a ser a forma principal de navegar no calendário.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agenda-from">De</Label>
              <Input
                id="agenda-from"
                type="date"
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
                className="min-w-[10rem]"
                aria-describedby="agenda-month-label"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agenda-to">Até</Label>
              <Input
                id="agenda-to"
                type="date"
                value={to}
                onChange={(e) => onToChange(e.target.value)}
                className="min-w-[10rem]"
              />
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
