'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUsers } from '@/hooks/useUsers';
import {
  useConsultationAgendaBlocks,
  useConsultationAgendaConfig,
  useCreateConsultationAgendaBlock,
  useDeleteConsultationAgendaBlock,
  useUpsertConsultationAgendaConfig,
} from '@/hooks/useOncologyNavigation';
import { userEligibleForAnyConsultationAgendaSlot } from '@/lib/utils/consultationAgenda';

const DEFAULT_WEEKLY = {
  activeWeekdays: [1, 2, 3, 4, 5] as number[],
  shifts: [
    { startLocal: '08:00', endLocal: '12:00' },
    { startLocal: '13:00', endLocal: '17:00' },
  ],
};

const ISO_DOW_LABEL: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  7: 'Domingo',
};

function normalizeWeeklyPattern(raw: unknown): typeof DEFAULT_WEEKLY {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_WEEKLY };
  const o = raw as Record<string, unknown>;
  const aw = o.activeWeekdays;
  const sh = o.shifts;
  if (!Array.isArray(aw) || !Array.isArray(sh)) return { ...DEFAULT_WEEKLY };
  return {
    activeWeekdays: aw.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 7),
    shifts: sh
      .map((s) => {
        if (!s || typeof s !== 'object') return null;
        const r = s as Record<string, unknown>;
        const startLocal =
          typeof r.startLocal === 'string'
            ? r.startLocal
            : typeof r.start === 'string'
              ? r.start
              : '';
        const endLocal =
          typeof r.endLocal === 'string'
            ? r.endLocal
            : typeof r.end === 'string'
              ? r.end
              : '';
        if (!startLocal || !endLocal) return null;
        return { startLocal, endLocal };
      })
      .filter((x): x is { startLocal: string; endLocal: string } => x !== null),
  };
}

export default function ConsultationAgendaSettingsPage() {
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const eligibleUsers = useMemo(
    () => users.filter((u) => userEligibleForAnyConsultationAgendaSlot(u)),
    [users]
  );
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const {
    data: config,
    isFetched: configFetched,
    isFetching: configFetching,
    isError: configError,
  } = useConsultationAgendaConfig(selectedUserId || null);
  const { data: blocks = [], isLoading: blocksLoading } =
    useConsultationAgendaBlocks(selectedUserId);
  const upsertMut = useUpsertConsultationAgendaConfig();
  const createBlockMut = useCreateConsultationAgendaBlock();
  const deleteBlockMut = useDeleteConsultationAgendaBlock();

  const [duration, setDuration] = useState(30);
  const [whatsappConfirmationLeadHours, setWhatsappConfirmationLeadHours] = useState(24);
  const [maxPerDay, setMaxPerDay] = useState<string>('');
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>(DEFAULT_WEEKLY.activeWeekdays);
  const [shifts, setShifts] = useState(DEFAULT_WEEKLY.shifts);

  const [blockGlobal, setBlockGlobal] = useState(false);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    if (!selectedUserId || !configFetched || configError) return;
    if (config) {
      setDuration(config.defaultConsultationDurationMinutes);
      setWhatsappConfirmationLeadHours(config.whatsappConfirmationLeadHours ?? 24);
      setMaxPerDay(
        config.maxConsultationsPerDay != null ? String(config.maxConsultationsPerDay) : ''
      );
      const w = normalizeWeeklyPattern(config.weeklyPattern);
      setActiveWeekdays(w.activeWeekdays.length ? w.activeWeekdays : DEFAULT_WEEKLY.activeWeekdays);
      setShifts(w.shifts.length ? w.shifts : DEFAULT_WEEKLY.shifts);
    } else {
      setDuration(30);
      setWhatsappConfirmationLeadHours(24);
      setMaxPerDay('');
      setActiveWeekdays([...DEFAULT_WEEKLY.activeWeekdays]);
      setShifts(DEFAULT_WEEKLY.shifts.map((s) => ({ ...s })));
    }
  }, [config, configFetched, configError, selectedUserId]);

  const toggleDay = (d: number) => {
    setActiveWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const saveConfig = () => {
    if (!selectedUserId) return;
    const maxRaw = maxPerDay.trim();
    let maxConsultationsPerDay: number | null = null;
    if (maxRaw !== '') {
      const n = parseInt(maxRaw, 10);
      if (Number.isFinite(n)) {
        maxConsultationsPerDay = Math.min(200, Math.max(1, n));
      }
    }
    const lead = Math.min(
      336,
      Math.max(0, Math.round(Number(whatsappConfirmationLeadHours)) || 0)
    );
    upsertMut.mutate({
      userId: selectedUserId,
      body: {
        defaultConsultationDurationMinutes: duration,
        maxConsultationsPerDay,
        weeklyPattern: {
          activeWeekdays,
          shifts,
        },
        whatsappConfirmationLeadHours: lead,
      },
    });
  };

  const addShift = () => {
    setShifts((s) => [...s, { startLocal: '09:00', endLocal: '17:00' }]);
  };

  const removeShift = (idx: number) => {
    setShifts((s) => s.filter((_, i) => i !== idx));
  };

  const updateShift = (idx: number, field: 'startLocal' | 'endLocal', value: string) => {
    setShifts((s) => s.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const submitBlock = () => {
    if (!selectedUserId || !blockStart || !blockEnd) return;
    const startsAt = new Date(blockStart).toISOString();
    const endsAt = new Date(blockEnd).toISOString();
    createBlockMut.mutate({
      userId: blockGlobal ? null : selectedUserId,
      startsAt,
      endsAt,
      reason: blockReason.trim() || undefined,
    });
    setBlockStart('');
    setBlockEnd('');
    setBlockReason('');
    setBlockGlobal(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-muted/30 overflow-y-auto">
      <main
        className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6"
        id="main-content"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/agenda"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar à agenda
          </Link>
        </div>
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Configuração da agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Por profissional: turnos, duração padrão da consulta, limite diário e bloqueios
            (incluindo feriados globais do hospital).
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Profissional</CardTitle>
            <CardDescription>
              Apenas utilizadores que podem aparecer como responsáveis na agenda de consultas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedUserId || undefined}
              onValueChange={setSelectedUserId}
              disabled={usersLoading}
            >
              <SelectTrigger aria-label="Selecionar profissional">
                <SelectValue placeholder={usersLoading ? 'Carregando…' : 'Escolher profissional'} />
              </SelectTrigger>
              <SelectContent>
                {eligibleUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedUserId && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Grelha de atendimento</CardTitle>
                <CardDescription>
                  Horários em America/Sao_Paulo. A duração padrão define o passo dos slots livres.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {configError && (
                  <p className="text-sm text-destructive" role="alert">
                    Não foi possível carregar a configuração deste profissional.
                  </p>
                )}
                {configFetching && (
                  <p className="text-sm text-muted-foreground">Carregando configuração…</p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dur">Duração padrão (minutos)</Label>
                    <Input
                      id="dur"
                      type="number"
                      min={5}
                      max={120}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cap">Máx. consultas por dia (opcional)</Label>
                    <Input
                      id="cap"
                      type="number"
                      min={1}
                      max={200}
                      placeholder="Sem limite"
                      value={maxPerDay}
                      onChange={(e) => setMaxPerDay(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-lead">
                    Confirmação WhatsApp — antecedência (horas)
                  </Label>
                  <Input
                    id="confirm-lead"
                    type="number"
                    min={0}
                    max={336}
                    value={whatsappConfirmationLeadHours}
                    onChange={(e) =>
                      setWhatsappConfirmationLeadHours(Number(e.target.value))
                    }
                    aria-describedby="confirm-lead-hint"
                  />
                  <p id="confirm-lead-hint" className="text-xs text-muted-foreground">
                    Horas antes do horário da consulta para enviar a mensagem de confirmação ao
                    paciente. Use 0 para enviar logo após registar a consulta na agenda. Máximo
                    336 h (14 dias). Depende de telefone, opt-in e canal WhatsApp do hospital.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Dias da semana com atendimento</Label>
                  <div className="flex flex-wrap gap-3">
                    {([1, 2, 3, 4, 5, 6, 7] as const).map((d) => (
                      <label key={d} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={activeWeekdays.includes(d)}
                          onCheckedChange={() => toggleDay(d)}
                        />
                        {ISO_DOW_LABEL[d]}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Turnos (HH:mm)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addShift}>
                      <Plus className="mr-1 h-4 w-4" aria-hidden />
                      Turno
                    </Button>
                  </div>
                  {shifts.map((row, idx) => (
                    <div key={idx} className="flex flex-wrap items-end gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Início</Label>
                        <Input
                          type="time"
                          value={row.startLocal}
                          onChange={(e) => updateShift(idx, 'startLocal', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Fim</Label>
                        <Input
                          type="time"
                          value={row.endLocal}
                          onChange={(e) => updateShift(idx, 'endLocal', e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover turno"
                        onClick={() => removeShift(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={() => saveConfig()}
                  disabled={upsertMut.isPending || activeWeekdays.length === 0 || shifts.length === 0}
                >
                  {upsertMut.isPending ? 'Salvando…' : 'Salvar configuração'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bloqueios</CardTitle>
                <CardDescription>
                  Intervalo indisponível. Marque «todo o hospital» para feriados ou manutenção
                  geral.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={blockGlobal} onCheckedChange={(v) => setBlockGlobal(!!v)} />
                  Bloqueio para todo o hospital (não só este profissional)
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="bs">Início</Label>
                    <Input
                      id="bs"
                      type="datetime-local"
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="be">Fim</Label>
                    <Input
                      id="be"
                      type="datetime-local"
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="br">Motivo (opcional)</Label>
                  <Input
                    id="br"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    maxLength={500}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => submitBlock()}
                  disabled={createBlockMut.isPending || !blockStart || !blockEnd}
                >
                  Adicionar bloqueio
                </Button>

                {blocksLoading && (
                  <p className="text-sm text-muted-foreground">Carregando bloqueios…</p>
                )}
                {!blocksLoading && blocks.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum bloqueio neste âmbito.</p>
                )}
                {blocks.length > 0 && (
                  <ul className="divide-y rounded-md border text-sm">
                    {blocks.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <span className="font-medium">
                            {format(parseISO(b.startsAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} →{' '}
                            {format(parseISO(b.endsAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            {b.userId == null ? '(hospital)' : '(profissional)'}
                          </span>
                          {b.reason && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {b.reason}
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={deleteBlockMut.isPending}
                          onClick={() => deleteBlockMut.mutate(b.id)}
                        >
                          Remover
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
