'use client';

import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, Stethoscope, User, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';
import { usePatients } from '@/hooks/usePatients';
import {
  useConsultationAgendaSchedulableProfessionals,
  useCreateConsultationAppointment,
} from '@/hooks/useOncologyNavigation';
import {
  consultationAppointmentFormSchema,
  type ConsultationAppointmentFormData,
} from '@/lib/validations/consultation-appointment';
import {
  combineLocalDateAndTime,
  CONSULTATION_APPOINTMENT_STEP_META,
  CONSULTATION_AVAILABLE_SLOTS_MAX_RANGE_DAYS,
  isoUtcToSaoPauloHHmm,
  isoUtcToSaoPauloYmd,
  isConsultationAgendaSlotPrefillComplete,
  resolveInitialScheduledProfessionalId,
  type ConsultationAppointmentStepKey,
  userEligibleForConsultationStep,
} from '@/lib/utils/consultationAgenda';
import { oncologyNavigationApi } from '@/lib/api/oncology-navigation';
import { JOURNEY_STAGE_LABELS, type JourneyStage } from '@/lib/utils/journey-stage';
import { PatientCreateDialog } from '@/components/patients/patient-create-dialog';
import { ConsultationFreeSlotsField } from '@/components/oncology-navigation/consultation-free-slots-field';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';

const NEW_APPOINTMENT_DEFAULTS: DefaultValues<ConsultationAppointmentFormData> = {
  patientId: '',
  stepKey: 'specialist_consultation',
  expectedDate: undefined,
  appointmentTime: '09:00',
  scheduledProfessionalId: '',
};

export interface ConsultationAgendaAppointmentPrefill {
  scheduledProfessionalId?: string;
  stepKey?: ConsultationAppointmentStepKey;
  expectedDate?: Date;
  appointmentTime?: string;
}

export interface ConsultationAgendaNewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preenchimento ao abrir a partir de um slot na agenda (data, hora, profissional, tipo). */
  prefill?: ConsultationAgendaAppointmentPrefill | null;
  /**
   * Profissional pré-selecionado a partir do contexto da página pai (ex.: filtro «Profissional»
   * na agenda da secretaria). Aplicado apenas quando não há `prefill` e o utilizador é SECRETARY;
   * para os demais papéis, o próprio utilizador é sempre o responsável (forma do servidor).
   */
  defaultProfessionalId?: string | null;
}

export function ConsultationAgendaNewAppointmentDialog({
  open,
  onOpenChange,
  prefill = null,
  defaultProfessionalId = null,
}: ConsultationAgendaNewAppointmentDialogProps) {
  const { user } = useAuthStore();
  const isSecretary = user?.role === 'SECRETARY';
  const { data: patients = [], isLoading: patientsLoading } = usePatients();
  const {
    data: schedulableProfessionalsList = [],
    isLoading: usersLoading,
    isSuccess: schedulableProfessionalsQuerySuccess,
  } = useConsultationAgendaSchedulableProfessionals();
  const createMutation = useCreateConsultationAppointment();
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  /** Evita sobrescrever a data quando o utilizador escolhe manualmente no calendário. */
  const [userSetExpectedDate, setUserSetExpectedDate] = useState(false);

  const patientOptions = useMemo(
    () =>
      patients.map((p) => ({
        value: p.id,
        label: `${p.name}${p.phone ? ` · ${p.phone}` : ''}`,
      })),
    [patients]
  );

  const form = useForm<ConsultationAppointmentFormData>({
    resolver: zodResolver(consultationAppointmentFormSchema),
    defaultValues: NEW_APPOINTMENT_DEFAULTS,
  });
  const { watch, setValue } = form;
  const selectedPatientId = watch('patientId');
  const appointmentStepKey = watch('stepKey') as ConsultationAppointmentStepKey;
  const scheduledProfessionalIdWatch = watch('scheduledProfessionalId');
  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const slotPrefillComplete = useMemo(
    () => open && isConsultationAgendaSlotPrefillComplete(prefill),
    [open, prefill]
  );

  const slotPrefillProfessionalLabel = useMemo(() => {
    if (!slotPrefillComplete || !prefill?.scheduledProfessionalId) return null;
    const fromList = schedulableProfessionalsList.find(
      (p) => p.id === prefill.scheduledProfessionalId
    )?.name;
    if (fromList) return fromList;
    if (!isSecretary && user?.id === prefill.scheduledProfessionalId) {
      return user.name ?? null;
    }
    return null;
  }, [
    slotPrefillComplete,
    prefill?.scheduledProfessionalId,
    schedulableProfessionalsList,
    isSecretary,
    user?.id,
    user?.name,
  ]);

  /**
   * Lista para o select da secretaria — usa o endpoint dedicado `consultation-agenda-
   * schedulable-professionals` (autorizado para SECRETARY) em vez de `GET /users` (403 para
   * SECRETARY). Para os demais papéis, o select é substituído por uma caixa de leitura com o
   * próprio nome.
   */
  const schedulableProfessionals = useMemo(
    () =>
      schedulableProfessionalsList.filter((u) =>
        userEligibleForConsultationStep(u, appointmentStepKey)
      ),
    [schedulableProfessionalsList, appointmentStepKey]
  );

  /**
   * Quando o stepKey muda e a lista de profissionais já carregou, limpamos o valor selecionado
   * apenas se o profissional atual NÃO for elegível para o novo tipo de consulta.
   *
   * Só após `isSuccess`: com `data` indefinido (erro de rede, 403, etc.) a lista cai em `[]` e
   * `isLoading` fica falso no TanStack Query v5 — limpar nesse estado apagava um ID válido
   * (filtro da agenda / prefill) até a lista voltar a carregar.
   */
  useEffect(() => {
    if (isConsultationAgendaSlotPrefillComplete(prefill)) return;
    if (!isSecretary || usersLoading || !schedulableProfessionalsQuerySuccess) return;
    if (!scheduledProfessionalIdWatch) return;
    const stillEligible = schedulableProfessionalsList.some(
      (u) =>
        u.id === scheduledProfessionalIdWatch &&
        userEligibleForConsultationStep(u, appointmentStepKey)
    );
    if (!stillEligible) {
      setValue('scheduledProfessionalId', '', { shouldValidate: true });
    }
  }, [
    isSecretary,
    usersLoading,
    schedulableProfessionalsQuerySuccess,
    appointmentStepKey,
    schedulableProfessionalsList,
    scheduledProfessionalIdWatch,
    setValue,
    prefill,
  ]);

  /**
   * Inicialização do `scheduledProfessionalId` quando o dialog abre ou quando os parâmetros
   * de origem mudam. Combina prefill (slot clicado), defaultProfessionalId (filtro da página)
   * e o utilizador autenticado (não-secretária) com a precedência definida em
   * `resolveInitialScheduledProfessionalId`.
   */
  useEffect(() => {
    if (!open) return;
    if (isConsultationAgendaSlotPrefillComplete(prefill)) return;
    const listForResolve =
      isSecretary &&
      schedulableProfessionalsQuerySuccess &&
      schedulableProfessionalsList.length > 0
        ? schedulableProfessionalsList
        : undefined;
    const initialId = resolveInitialScheduledProfessionalId({
      prefillProfessionalId: prefill?.scheduledProfessionalId ?? null,
      defaultProfessionalId,
      currentUser: user
        ? {
            id: user.id,
            role: user.role,
            clinicalSubrole: user.clinicalSubrole ?? null,
          }
        : null,
      isSecretary,
      stepKey: appointmentStepKey,
      schedulableProfessionals: listForResolve,
    });
    if (initialId && initialId !== scheduledProfessionalIdWatch) {
      setValue('scheduledProfessionalId', initialId, {
        shouldValidate: true,
      });
    }
    // Não disparar a partir de scheduledProfessionalIdWatch para não sobrescrever escolha manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    prefill,
    defaultProfessionalId,
    isSecretary,
    user?.id,
    appointmentStepKey,
    schedulableProfessionalsQuerySuccess,
    schedulableProfessionalsList,
    setValue,
  ]);

  useEffect(() => {
    if (open && !prefill) {
      setUserSetExpectedDate(false);
    }
  }, [open, prefill]);

  useLayoutEffect(() => {
    if (!open || !prefill) return;
    form.reset({
      ...NEW_APPOINTMENT_DEFAULTS,
      stepKey: prefill.stepKey ?? NEW_APPOINTMENT_DEFAULTS.stepKey,
      expectedDate: prefill.expectedDate,
      appointmentTime: prefill.appointmentTime ?? NEW_APPOINTMENT_DEFAULTS.appointmentTime,
      scheduledProfessionalId: prefill.scheduledProfessionalId ?? '',
    });
    setUserSetExpectedDate(!!prefill.expectedDate);
  }, [open, prefill, form]);

  /** Não limpar após `reset` do prefill — senão o efeito do «primeiro slot» sobrescreve data/hora do clique. */
  useEffect(() => {
    if (prefill) return;
    setUserSetExpectedDate(false);
  }, [scheduledProfessionalIdWatch, appointmentStepKey, prefill]);

  useEffect(() => {
    if (
      !open ||
      prefill ||
      !scheduledProfessionalIdWatch ||
      !appointmentStepKey ||
      userSetExpectedDate
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const rangeEnd = new Date(
          startOfToday.getTime() +
            CONSULTATION_AVAILABLE_SLOTS_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000
        );
        const { slots } = await oncologyNavigationApi.getConsultationAvailableSlots({
          professionalId: scheduledProfessionalIdWatch,
          stepKey: appointmentStepKey,
          from: startOfToday.toISOString(),
          to: rangeEnd.toISOString(),
        });
        if (cancelled || slots.length === 0) return;
        const sorted = [...slots].sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime()
        );
        const first = sorted[0];
        const ymd = isoUtcToSaoPauloYmd(first);
        const hhmm = isoUtcToSaoPauloHHmm(first);
        const calendarDate = parse(ymd, 'yyyy-MM-dd', new Date());
        setValue('expectedDate', calendarDate, { shouldValidate: true });
        setValue('appointmentTime', hhmm, { shouldValidate: true });
      } catch {
        /* agenda sem config ou rede: utilizador escolhe data à mão */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    scheduledProfessionalIdWatch,
    appointmentStepKey,
    userSetExpectedDate,
    setValue,
  ]);

  const resetAndClose = () => {
    form.reset(NEW_APPOINTMENT_DEFAULTS);
    setUserSetExpectedDate(false);
    onOpenChange(false);
  };

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      form.reset(NEW_APPOINTMENT_DEFAULTS);
      setUserSetExpectedDate(false);
    }
    onOpenChange(next);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const patient = patients.find((p) => p.id === values.patientId);
    if (!patient) {
      toast.error('Paciente não encontrado na lista. Atualize e tente de novo.');
      return;
    }
    const meta = CONSULTATION_APPOINTMENT_STEP_META[values.stepKey];
    const start = combineLocalDateAndTime(
      values.expectedDate,
      values.appointmentTime
    );

    await createMutation.mutateAsync({
      patientId: patient.id,
      journeyStage: patient.currentStage as JourneyStage,
      stepKey: values.stepKey,
      stepName: meta.stepName,
      stepDescription: meta.stepDescription,
      expectedDate: start.toISOString(),
      scheduledProfessionalId: values.scheduledProfessionalId,
    });
    resetAndClose();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          aria-describedby="new-consultation-desc"
        >
          <DialogHeader>
            <DialogTitle>Nova consulta na agenda</DialogTitle>
            <DialogDescription id="new-consultation-desc">
              {slotPrefillComplete
                ? 'O horário e o profissional vêm do calendário. Escolha o paciente e salve.'
                : 'Registra uma etapa de consulta clínica com data agendada. Opcionalmente envia mensagem de confirmação por WhatsApp (se o paciente e o tenant estiverem elegíveis).'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              {slotPrefillComplete ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <FormField
                      control={form.control}
                      name="patientId"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Paciente</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              id="agenda-new-patient-slot"
                              aria-label="Buscar e selecionar paciente para este horário"
                              options={patientOptions}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder={
                                patientsLoading ? 'Carregando pacientes…' : 'Buscar paciente…'
                              }
                              disabled={patientsLoading}
                              emptyMessage="Nenhum paciente encontrado."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 gap-1"
                      onClick={() => setCreatePatientOpen(true)}
                    >
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Novo paciente
                    </Button>
                  </div>

                  {selectedPatient && (
                    <p className="text-sm text-muted-foreground" role="status">
                      Fase da jornada:{' '}
                      <span className="font-medium text-foreground">
                        {JOURNEY_STAGE_LABELS[selectedPatient.currentStage as JourneyStage] ??
                          selectedPatient.currentStage}
                      </span>
                    </p>
                  )}

                  <div
                    role="group"
                    aria-label="Horário e profissional já definidos pelo calendário"
                    className="space-y-3 rounded-md border border-dashed bg-muted/30 p-4"
                  >
                    <p className="text-sm font-medium text-foreground">Já definido</p>
                    <dl className="grid gap-3 text-sm">
                      <div className="flex gap-2">
                        <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                          <Stethoscope className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                          Tipo
                        </dt>
                        <dd className="min-w-0 font-medium text-foreground">
                          {CONSULTATION_APPOINTMENT_STEP_META[appointmentStepKey].stepName}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                          <User className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                          Profissional
                        </dt>
                        <dd className="min-w-0 font-medium text-foreground">
                          {usersLoading && !slotPrefillProfessionalLabel
                            ? 'Carregando…'
                            : (slotPrefillProfessionalLabel ??
                              (!isSecretary ? user?.name : null) ??
                              'Profissional selecionado')}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                          Data
                        </dt>
                        <dd className="min-w-0 font-medium text-foreground">
                          {watch('expectedDate')
                            ? format(watch('expectedDate') as Date, 'PPP', { locale: ptBR })
                            : '—'}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                          Horário
                        </dt>
                        <dd className="font-medium text-foreground tabular-nums">
                          {watch('appointmentTime') || '—'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="stepKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de consulta</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger aria-label="Tipo de consulta">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="specialist_consultation">
                              {
                                CONSULTATION_APPOINTMENT_STEP_META.specialist_consultation
                                  .stepName
                              }
                            </SelectItem>
                            <SelectItem value="navigation_consultation">
                              {
                                CONSULTATION_APPOINTMENT_STEP_META.navigation_consultation
                                  .stepName
                              }
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduledProfessionalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profissional responsável</FormLabel>
                        {isSecretary ? (
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                            disabled={usersLoading}
                          >
                            <FormControl>
                              <SelectTrigger aria-label="Profissional responsável pelo horário">
                                <SelectValue
                                  placeholder={
                                    usersLoading
                                      ? 'Carregando profissionais…'
                                      : 'Selecione o profissional'
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {schedulableProfessionals.length === 0 && !usersLoading ? (
                                <div
                                  className="px-2 py-1.5 text-sm text-muted-foreground"
                                  role="status"
                                >
                                  Nenhum profissional elegível neste tenant.
                                </div>
                              ) : (
                                schedulableProfessionals.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>
                            <div
                              className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-foreground"
                              aria-label="Profissional responsável (sua conta)"
                            >
                              {user?.name ?? '—'}
                            </div>
                          </FormControl>
                        )}
                        <FormDescription>
                          {isSecretary
                            ? appointmentStepKey === 'specialist_consultation'
                              ? 'Médicos e oncologistas; coordenadores e administradores apenas com subpapel médico.'
                              : 'Enfermeiros e enfermeiros chefes; coordenadores e administradores apenas com subpapel enfermagem.'
                            : 'A consulta fica na sua agenda; para outro profissional, peça a uma utilizadora com perfil secretaria.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expectedDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data agendada</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                                aria-label="Abrir calendário para data da consulta"
                              >
                                {field.value ? (
                                  format(field.value, 'PPP', { locale: ptBR })
                                ) : (
                                  <span>Escolher data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(d) => {
                                setUserSetExpectedDate(true);
                                field.onChange(d);
                              }}
                              locale={ptBR}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Ao escolher o profissional, sugerimos automaticamente a próxima data
                          com vaga (até {CONSULTATION_AVAILABLE_SLOTS_MAX_RANGE_DAYS} dias). Pode
                          alterar no calendário. Os horários livres aparecem abaixo quando há
                          configuração de agenda.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {scheduledProfessionalIdWatch &&
                    appointmentStepKey &&
                    watch('expectedDate') && (
                      <ConsultationFreeSlotsField
                        professionalId={scheduledProfessionalIdWatch}
                        stepKey={appointmentStepKey}
                        selectedDate={watch('expectedDate')}
                        formTimeHHmm={watch('appointmentTime')}
                        disabled={createMutation.isPending}
                        onApplySlot={({ calendarDate, timeHHmm }) => {
                          setValue('expectedDate', calendarDate, { shouldValidate: true });
                          setValue('appointmentTime', timeHHmm, { shouldValidate: true });
                        }}
                      />
                    )}

                  <FormField
                    control={form.control}
                    name="appointmentTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            aria-label="Horário da consulta"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Preenchido automaticamente ao escolher um botão acima; ou ajuste
                          manualmente (útil quando ainda não há configurada).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <FormField
                      control={form.control}
                      name="patientId"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Paciente</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              id="agenda-new-patient"
                              aria-label="Buscar e selecionar paciente"
                              options={patientOptions}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder={
                                patientsLoading ? 'Carregando pacientes…' : 'Buscar paciente…'
                              }
                              disabled={patientsLoading}
                              emptyMessage="Nenhum paciente encontrado."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 gap-1"
                      onClick={() => setCreatePatientOpen(true)}
                    >
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Novo paciente
                    </Button>
                  </div>

                  {selectedPatient && (
                    <p className="text-sm text-muted-foreground" role="status">
                      Fase da jornada:{' '}
                      <span className="font-medium text-foreground">
                        {JOURNEY_STAGE_LABELS[selectedPatient.currentStage as JourneyStage] ??
                          selectedPatient.currentStage}
                      </span>
                    </p>
                  )}
                </>
              )}

              <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                A confirmação por WhatsApp é enviada automaticamente com a antecedência definida
                em{' '}
                <span className="whitespace-nowrap font-medium text-foreground">
                  Agenda → Configuração da agenda
                </span>{' '}
                para este profissional (0 h = logo após guardar a consulta). Requer telefone,
                opt-in e canal ativo.
              </p>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
                <Button type="button" variant="outline" onClick={() => resetAndClose()}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Salvando…' : 'Salvar na agenda'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <PatientCreateDialog
        open={createPatientOpen}
        onOpenChange={setCreatePatientOpen}
        variant="agenda-quick"
        onPatientCreated={(created) => {
          form.setValue('patientId', created.id, { shouldValidate: true });
        }}
      />
    </>
  );
}
