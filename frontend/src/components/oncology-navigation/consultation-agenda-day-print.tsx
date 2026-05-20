'use client';

import type { ConsultationAgendaItem } from '@/lib/api/oncology-navigation';
import {
  CONSULTATION_AGENDA_STATUS_LABEL,
  formatAgendaDateTime,
  formatAgendaDayLabel,
  sortConsultationAgendaItemsByExpectedDate,
} from '@/lib/utils/consultationAgenda';

export interface ConsultationAgendaDayPrintProps {
  dayKey: string;
  items: ConsultationAgendaItem[];
  professionalLabel?: string | null;
}

/** Conteúdo minimalista para impressão do dia (visível só em @media print). */
export function ConsultationAgendaDayPrint({
  dayKey,
  items,
  professionalLabel,
}: ConsultationAgendaDayPrintProps) {
  const sorted = sortConsultationAgendaItemsByExpectedDate(items);
  const dayLabel = formatAgendaDayLabel(`${dayKey}T12:00:00.000Z`);
  const printedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  return (
    <div
      className="hidden bg-white text-black print:block"
      aria-hidden
    >
      <header className="mb-4 border-b border-black pb-2">
        <h1 className="text-lg font-bold">Agenda de consultas — ONCONAV</h1>
        <p className="text-sm">{dayLabel}</p>
        {professionalLabel ? (
          <p className="text-sm">Profissional: {professionalLabel}</p>
        ) : null}
        <p className="text-xs text-neutral-600">
          Impresso em {printedAt} · {sorted.length} consulta
          {sorted.length === 1 ? '' : 's'}
        </p>
      </header>

      {sorted.length === 0 ? (
        <p className="text-sm">Nenhuma consulta neste dia.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1 pr-2 font-semibold">Hora</th>
              <th className="py-1 pr-2 font-semibold">Paciente</th>
              <th className="py-1 pr-2 font-semibold">Profissional</th>
              <th className="py-1 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id} className="border-b border-neutral-300">
                <td className="py-1.5 pr-2 align-top tabular-nums">
                  {formatAgendaDateTime(item.expectedDate)}
                </td>
                <td className="py-1.5 pr-2 align-top">{item.patient.name}</td>
                <td className="py-1.5 pr-2 align-top">
                  {item.scheduledProfessional?.name ?? '—'}
                </td>
                <td className="py-1.5 align-top">
                  {CONSULTATION_AGENDA_STATUS_LABEL[item.status] ?? item.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
