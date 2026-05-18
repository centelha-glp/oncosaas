'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ExternalLink } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
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
import { JOURNEY_STAGE_LABELS, type JourneyStage } from '@/lib/utils/journey-stage';
import type { ConsultationAgendaItem } from '@/lib/api/oncology-navigation';
import {
  APPOINTMENT_CONFIRMATION_LABEL,
  combineLocalDateAndTime,
  consultationAppointmentStepKeyFromString,
  CONSULTATION_AGENDA_STATUS_LABEL,
  appointmentConfirmationBadgeVariant,
  consultationAgendaItemBorderClass,
  consultationAgendaStatusBadgeVariant,
  formatAgendaDateTime,
  formatShortAgendaDate,
  isSchedulableConsultationRole,
  userEligibleForConsultationStep,
} from '@/lib/utils/consultationAgenda';
import type { ConsultationAgendaSchedulableProfessional } from '@/lib/api/oncology-navigation';
import {
  useSendConsultationConfirmation,
  useUpdateNavigationStep,
} from '@/hooks/useOncologyNavigation';
import { ConsultationFreeSlotsField } from '@/components/oncology-navigation/consultation-free-slots-field';
import { toast } from 'sonner';

export interface ConsultationAgendaItemCardProps {
  item: ConsultationAgendaItem;
  schedulableProfessionals: ConsultationAgendaSchedulableProfessional[];
  schedulableProfessionalsLoading?: boolean;
}

export function ConsultationAgendaItemCard({
  item,
  schedulableProfessionals,
  schedulableProfessionalsLoading = false,
}: ConsultationAgendaItemCardProps) {
  const sendMut = useSendConsultationConfirmation();
  const updateMut = useUpdateNavigationStep();
  const consultationStepKey = consultationAppointmentStepKeyFromString(item.stepKey);
  const rescheduleProfessionals = useMemo(() => {
    if (consultationStepKey) {
      return schedulableProfessionals.filter((u) =>
        userEligibleForConsultationStep(u, consultationStepKey)
      );
    }
    return schedulableProfessionals.filter((u) =>
      isSchedulableConsultationRole(u.role)
    );
  }, [schedulableProfessionals, consultationStepKey]);

  const [sendOpen, setSendOpen] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [rescheduleProfessionalId, setRescheduleProfessionalId] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  const isCancelled = item.status === 'CANCELLED';
  const actionsDisabled = isCancelled || item.isCompleted;

  const openReschedule = () => {
    try {
      if (item.expectedDate) {
        const d = parseISO(item.expectedDate);
        setRescheduleDate(d);
        setRescheduleTime(format(d, 'HH:mm'));
      } else {
        setRescheduleDate(undefined);
        setRescheduleTime('09:00');
      }
    } catch {
      setRescheduleDate(undefined);
      setRescheduleTime('09:00');
    }
    setRescheduleProfessionalId(item.scheduledProfessional?.id ?? '');
    setRescheduleOpen(true);
  };

  const handleReschedule = async () => {
    if (!rescheduleDate) {
      toast.error('Escolha a nova data.');
      return;
    }
    if (!rescheduleProfessionalId) {
      toast.error('Selecione o profissional responsável pelo horário.');
      return;
    }
    const start = combineLocalDateAndTime(rescheduleDate, rescheduleTime);
    try {
      await updateMut.mutateAsync({
        stepId: item.id,
        data: {
          expectedDate: start.toISOString(),
          scheduledProfessionalId: rescheduleProfessionalId,
        },
      });
      toast.success('Consulta reagendada.');
      setRescheduleOpen(false);
    } catch {
      /* toast no hook */
    }
  };

  const handleCancelConsultation = async () => {
    try {
      await updateMut.mutateAsync({
        stepId: item.id,
        data: { status: 'CANCELLED' },
      });
      toast.success('Consulta cancelada na agenda.');
      setCancelOpen(false);
    } catch {
      /* hook trata erro */
    }
  };

  const handleConfirmationStatus = async (
    appointmentConfirmationStatus: 'CONFIRMED' | 'DECLINED'
  ) => {
    try {
      await updateMut.mutateAsync({
        stepId: item.id,
        data: { appointmentConfirmationStatus },
      });
      toast.success(
        appointmentConfirmationStatus === 'CONFIRMED'
          ? 'Marcado como confirmado pelo paciente.'
          : 'Marcado como recusado pelo paciente.'
      );
    } catch {
      /* hook trata erro */
    }
  };

  const handleSendSubmit = async () => {
    try {
      await sendMut.mutateAsync({
        stepId: item.id,
        message: sendMessage.trim() || undefined,
      });
      setSendOpen(false);
      setSendMessage('');
    } catch {
      /* hook trata erro */
    }
  };

  return (
    <>
      <Card
        className={cn(
          'border-l-4',
          consultationAgendaItemBorderClass(item.status)
        )}
      >
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{item.stepName}</span>
              <Badge variant={consultationAgendaStatusBadgeVariant(item.status)}>
                {CONSULTATION_AGENDA_STATUS_LABEL[item.status] ?? item.status}
              </Badge>
              <Badge
                variant={appointmentConfirmationBadgeVariant(
                  item.appointmentConfirmationStatus
                )}
              >
                {APPOINTMENT_CONFIRMATION_LABEL[item.appointmentConfirmationStatus]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{item.patient.name}</span>
              {' · '}
              {JOURNEY_STAGE_LABELS[item.journeyStage as JourneyStage] ??
                item.journeyStage}
            </p>
            <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="inline font-medium text-foreground">Agendada: </dt>
                <dd className="inline">{formatAgendaDateTime(item.expectedDate)}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground">Profissional: </dt>
                <dd className="inline">
                  {item.scheduledProfessional?.name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground">Limite: </dt>
                <dd className="inline">{formatShortAgendaDate(item.dueDate)}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground">Realizada: </dt>
                <dd className="inline">{formatShortAgendaDate(item.actualDate)}</dd>
              </div>
            </dl>

            {!actionsDisabled && (
              <div
                className="flex flex-wrap gap-2 pt-1"
                role="group"
                aria-label="Ações da consulta"
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={sendMut.isPending}
                  onClick={() => setSendOpen(true)}
                >
                  Enviar confirmação
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={updateMut.isPending}
                  onClick={openReschedule}
                >
                  Reagendar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={updateMut.isPending}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancelar consulta
                </Button>
                {item.appointmentConfirmationStatus === 'AWAITING_RESPONSE' && (
                  <>
                    <Button
                      type="button"
                      variant="success"
                      size="sm"
                      disabled={updateMut.isPending}
                      onClick={() => void handleConfirmationStatus('CONFIRMED')}
                    >
                      Paciente confirmou
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={updateMut.isPending}
                      onClick={() => void handleConfirmationStatus('DECLINED')}
                    >
                      Paciente recusou
                    </Button>
                  </>
                )}
              </div>
            )}
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

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent aria-describedby="send-confirm-desc">
          <DialogHeader>
            <DialogTitle>Enviar confirmação</DialogTitle>
            <DialogDescription id="send-confirm-desc">
              Envio por WhatsApp com texto padrão do sistema. Opcionalmente personalize a
              mensagem abaixo (sem dados clínicos desnecessários).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`confirm-msg-${item.id}`}>Mensagem (opcional)</Label>
            <Textarea
              id={`confirm-msg-${item.id}`}
              value={sendMessage}
              onChange={(e) => setSendMessage(e.target.value)}
              placeholder="Deixe em branco para usar o texto padrão."
              rows={4}
              maxLength={2000}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
            <Button type="button" variant="outline" onClick={() => setSendOpen(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSendSubmit()}
              disabled={sendMut.isPending}
            >
              {sendMut.isPending ? 'Enviando…' : 'Enviar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent aria-describedby="reschedule-desc">
          <DialogHeader>
            <DialogTitle>Reagendar consulta</DialogTitle>
            <DialogDescription id="reschedule-desc">
              Atualiza data, horário e profissional responsável. Lembretes pendentes ligados
              a esta consulta serão cancelados no servidor e recriados ao enviar nova
              confirmação, se aplicável.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor={`reschedule-prof-${item.id}`} className="mb-1.5 block">
                Profissional responsável
              </Label>
              <Select
                value={rescheduleProfessionalId || undefined}
                onValueChange={setRescheduleProfessionalId}
                disabled={schedulableProfessionalsLoading}
              >
                <SelectTrigger
                  id={`reschedule-prof-${item.id}`}
                  aria-label="Profissional responsável pelo horário"
                >
                  <SelectValue
                    placeholder={
                      schedulableProfessionalsLoading
                        ? 'Carregando…'
                        : 'Selecione o profissional'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {rescheduleProfessionals.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`reschedule-date-${item.id}`} className="mb-1.5 block">
                Data
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id={`reschedule-date-${item.id}`}
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !rescheduleDate && 'text-muted-foreground'
                    )}
                    aria-label="Escolher nova data"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rescheduleDate ? (
                      format(rescheduleDate, 'PPP', { locale: ptBR })
                    ) : (
                      'Escolher data'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rescheduleDate}
                    onSelect={setRescheduleDate}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {consultationStepKey &&
              rescheduleProfessionalId &&
              rescheduleDate && (
                <ConsultationFreeSlotsField
                  professionalId={rescheduleProfessionalId}
                  stepKey={consultationStepKey}
                  selectedDate={rescheduleDate}
                  formTimeHHmm={rescheduleTime}
                  disabled={updateMut.isPending}
                  onApplySlot={({ calendarDate, timeHHmm }) => {
                    setRescheduleDate(calendarDate);
                    setRescheduleTime(timeHHmm);
                  }}
                />
              )}
            <div>
              <Label htmlFor={`reschedule-time-${item.id}`} className="mb-1.5 block">
                Horário
              </Label>
              <Input
                id={`reschedule-time-${item.id}`}
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                aria-label="Horário da consulta"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use os botões acima quando existir; ou ajuste aqui manualmente.
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
            <Button type="button" variant="outline" onClick={() => setRescheduleOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleReschedule()}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? 'Salvando…' : 'Salvar nova data'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta consulta?</AlertDialogTitle>
            <AlertDialogDescription>
              A etapa será marcada como cancelada na navegação oncológica e sairá dos
              filtros padrão da agenda. Esta ação pode ser revertida editando a etapa na
              ficha do paciente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMut.isPending}>Voltar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={updateMut.isPending}
              onClick={() => void handleCancelConsultation()}
            >
              {updateMut.isPending ? 'Cancelando…' : 'Confirmar cancelamento'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
