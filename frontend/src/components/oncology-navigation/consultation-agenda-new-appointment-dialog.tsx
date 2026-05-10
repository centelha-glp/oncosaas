'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, UserPlus } from 'lucide-react';
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
import { useUsers } from '@/hooks/useUsers';
import { useEnabledCancerTypes } from '@/hooks/useEnabledCancerTypes';
import { useCreateConsultationAppointment } from '@/hooks/useOncologyNavigation';
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
  type ConsultationAppointmentStepKey,
  userEligibleForConsultationStep,
} from '@/lib/utils/consultationAgenda';
import { oncologyNavigationApi } from '@/lib/api/oncology-navigation';
import { JOURNEY_STAGE_LABELS, type JourneyStage } from '@/lib/utils/journey-stage';
import { PatientCreateDialog } from '@/components/patients/patient-create-dialog';
import { ConsultationFreeSlotsField } from '@/components/oncology-navigation/consultation-free-slots-field';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';

export interface ConsultationAgendaNewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsultationAgendaNewAppointmentDialog({
  open,
  onOpenChange,
}: ConsultationAgendaNewAppointmentDialogProps) {
  const { user } = useAuthStore();
  const isSecretary = user?.role === 'SECRETARY';
  const { data: patients = [], isLoading: patientsLoading } = usePatients();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { labels: cancerLabels, keys: cancerKeys } = useEnabledCancerTypes();
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
    defaultValues: {
      patientId: '',
      stepKey: 'specialist_consultation',
      expectedDate: undefined,
      appointmentTime: '09:00',
      scheduledProfessionalId: '',
      cancerTypeFallback: '',
    },
  });
  const { watch, setValue } = form;
  const selectedPatientId = watch('patientId');
  const appointmentStepKey = watch('stepKey') as ConsultationAppointmentStepKey;
  const scheduledProfessionalIdWatch = watch('scheduledProfessionalId');
  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const schedulableProfessionals = useMemo(
    () => users.filter((u) => userEligibleForConsultationStep(u, appointmentStepKey)),
    [users, appointmentStepKey]
  );

  useEffect(() => {
    if (selectedPatient?.cancerType) {
      setValue('cancerTypeFallback', '');
    }
  }, [selectedPatientId, selectedPatient?.cancerType, setValue]);

  useEffect(() => {
    if (!isSecretary) return;
    if (
      scheduledProfessionalIdWatch &&
      !schedulableProfessionals.some((u) => u.id === scheduledProfessionalIdWatch)
    ) {
      setValue('scheduledProfessionalId', '', { shouldValidate: true });
    }
  }, [
    isSecretary,
    appointmentStepKey,
    schedulableProfessionals,
    scheduledProfessionalIdWatch,
    setValue,
  ]);

  useEffect(() => {
    if (!open || !user || isSecretary) return;
    if (userEligibleForConsultationStep(user, appointmentStepKey)) {
      setValue('scheduledProfessionalId', user.id, { shouldValidate: true });
    }
  }, [open, user, isSecretary, appointmentStepKey, setValue]);

  useEffect(() => {
    if (open) {
      setUserSetExpectedDate(false);
    }
  }, [open]);

  useEffect(() => {
    setUserSetExpectedDate(false);
  }, [scheduledProfessionalIdWatch, appointmentStepKey]);

  useEffect(() => {
    if (
      !open ||
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
    form.reset({
      patientId: '',
      stepKey: 'specialist_consultation',
      expectedDate: undefined,
      appointmentTime: '09:00',
      scheduledProfessionalId: '',
      cancerTypeFallback: '',
    });
    onOpenChange(false);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const patient = patients.find((p) => p.id === values.patientId);
    if (!patient) {
      toast.error('Paciente não encontrado na lista. Atualize e tente de novo.');
      return;
    }
    const cancerType =
      patient.cancerType?.trim() || values.cancerTypeFallback?.trim() || '';
    if (!cancerType) {
      toast.error('Informe o tipo de câncer (cadastro do paciente ou seleção abaixo).');
      return;
    }

    const meta = CONSULTATION_APPOINTMENT_STEP_META[values.stepKey];
    const start = combineLocalDateAndTime(
      values.expectedDate,
      values.appointmentTime
    );

    await createMutation.mutateAsync({
      patientId: patient.id,
      cancerType,
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          aria-describedby="new-consultation-desc"
        >
          <DialogHeader>
            <DialogTitle>Nova consulta na agenda</DialogTitle>
            <DialogDescription id="new-consultation-desc">
              Registra uma etapa de consulta clínica com data agendada. Opcionalmente envia
              mensagem de confirmação por WhatsApp (se o paciente e o tenant estiverem
              elegíveis).
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
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
                          {CONSULTATION_APPOINTMENT_STEP_META.specialist_consultation.stepName}
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
                          {schedulableProfessionals.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
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
                      Ao escolher o profissional, sugerimos automaticamente a próxima data com
                      vaga na grelha (até {CONSULTATION_AVAILABLE_SLOTS_MAX_RANGE_DAYS} dias).
                      Pode alterar no calendário. Os horários livres aparecem abaixo quando há
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
                      Preenchido automaticamente ao escolher um botão acima; ou ajuste manualmente
                      (útil quando ainda não há grelha configurada).
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

              {!selectedPatient?.cancerType && selectedPatient && (
                <FormField
                  control={form.control}
                  name="cancerTypeFallback"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de câncer</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        O cadastro deste paciente não tem tipo de câncer. Selecione o tipo
                        habilitado para o hospital.
                      </p>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger aria-label="Tipo de câncer">
                            <SelectValue placeholder="Selecione…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cancerKeys.map((key) => (
                            <SelectItem key={key} value={key}>
                              {cancerLabels[key] ?? key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
          if (created.cancerType) {
            form.setValue('cancerTypeFallback', created.cancerType);
          }
        }}
      />
    </>
  );
}
