import { addDays, addMinutes, isBefore, isAfter } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** Fuso MVP (alinhado a mensagens WhatsApp no serviço de navegação). */
export const CONSULTATION_AGENDA_TIMEZONE = 'America/Sao_Paulo';

/** Limite superior de duração (min) para consultas na grelha e janelas de conflito. */
export const MAX_CONSULTATION_DURATION_MINUTES = 120;

/** Comportamento legacy quando não existe `ConsultationAgendaConfig`. */
export const LEGACY_CONSULTATION_SLOT_MINUTES = 1;

/** Máximo de dias entre `from` e `to` na API de slots. */
export const CONSULTATION_AVAILABLE_SLOTS_MAX_RANGE_DAYS = 60;

export type AgendaShiftLocal = { startLocal: string; endLocal: string };

export type ConsultationWeeklyPattern = {
  activeWeekdays: number[];
  shifts: AgendaShiftLocal[];
};

export type IntervalUtc = { start: Date; end: Date };

export function consultationIntervalBounds(
  start: Date,
  durationMinutes: number
): IntervalUtc {
  return {
    start,
    end: addMinutes(start, durationMinutes),
  };
}

/** Intervalos [start,end) semiabertos. */
export function intervalsOverlapSemiOpen(a: IntervalUtc, b: IntervalUtc): boolean {
  return a.start < b.end && b.start < a.end;
}

export function localWallTimeToUtc(
  dateYmd: string,
  hhmm: string,
  timeZone: string
): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) {
    throw new Error(`Horário inválido: ${hhmm}`);
  }
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (
    !Number.isFinite(hh) ||
    !Number.isFinite(mm) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59
  ) {
    throw new Error(`Horário inválido: ${hhmm}`);
  }
  const wall = `${dateYmd}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  return fromZonedTime(wall, timeZone);
}

export function parseWeeklyPatternJson(raw: unknown): ConsultationWeeklyPattern {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('weeklyPattern deve ser um objeto');
  }
  const o = raw as Record<string, unknown>;
  const aw = o.activeWeekdays;
  const sh = o.shifts;
  if (!Array.isArray(aw) || aw.length === 0) {
    throw new Error('activeWeekdays deve ser um array não vazio');
  }
  const weekdays = aw.map((d) => {
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 7) {
      throw new Error('activeWeekdays: use inteiros 1 (seg) a 7 (dom), ISO');
    }
    return d;
  });
  if (!Array.isArray(sh) || sh.length === 0) {
    throw new Error('shifts deve ser um array não vazio');
  }
  const shifts: AgendaShiftLocal[] = sh.map((s, i) => {
    if (s === null || typeof s !== 'object' || Array.isArray(s)) {
      throw new Error(`shift ${i} inválido`);
    }
    const r = s as Record<string, unknown>;
    const startLocal =
      typeof r.startLocal === 'string' ? r.startLocal : typeof r.start === 'string' ? r.start : null;
    const endLocal =
      typeof r.endLocal === 'string' ? r.endLocal : typeof r.end === 'string' ? r.end : null;
    if (!startLocal || !endLocal || !/^\d{1,2}:\d{2}$/.test(startLocal) || !/^\d{1,2}:\d{2}$/.test(endLocal)) {
      throw new Error(`shift ${i}: startLocal/endLocal como HH:mm`);
    }
    const t0 = startLocal.split(':').map((x) => parseInt(x, 10));
    const t1 = endLocal.split(':').map((x) => parseInt(x, 10));
    const startMin = t0[0] * 60 + t0[1];
    const endMin = t1[0] * 60 + t1[1];
    if (endMin <= startMin) {
      throw new Error(`shift ${i}: fim deve ser depois do início no mesmo dia`);
    }
    return { startLocal, endLocal };
  });
  return { activeWeekdays: weekdays, shifts };
}

/** Lista yyyy-MM-dd para cada dia civil entre os instantes (inclusivo) no fuso. */
export function eachCalendarYmdInUtcRange(
  fromUtc: Date,
  toUtc: Date,
  timeZone: string
): string[] {
  const out: string[] = [];
  let ymd = formatInTimeZone(fromUtc, timeZone, 'yyyy-MM-dd');
  const endYmd = formatInTimeZone(toUtc, timeZone, 'yyyy-MM-dd');
  while (ymd <= endYmd) {
    out.push(ymd);
    ymd = addCalendarDaysYmd(ymd, 1, timeZone);
  }
  return out;
}

export function addCalendarDaysYmd(ymd: string, days: number, timeZone: string): string {
  const noon = fromZonedTime(`${ymd}T12:00:00`, timeZone);
  return formatInTimeZone(addDays(noon, days), timeZone, 'yyyy-MM-dd');
}

export function zonedDayBounds(ymd: string, timeZone: string): IntervalUtc {
  const start = localWallTimeToUtc(ymd, '00:00', timeZone);
  const nextYmd = addCalendarDaysYmd(ymd, 1, timeZone);
  const end = localWallTimeToUtc(nextYmd, '00:00', timeZone);
  return { start, end };
}

/**
 * Gera inícios de slot UTC com passo = durationMinutes, dentro dos turnos e dias ativos.
 */
export function generateCandidateSlotStarts(params: {
  rangeFromUtc: Date;
  rangeToUtc: Date;
  pattern: ConsultationWeeklyPattern;
  durationMinutes: number;
  timeZone: string;
}): Date[] {
  const { rangeFromUtc, rangeToUtc, pattern, durationMinutes, timeZone } = params;
  const slots: Date[] = [];
  const ymds = eachCalendarYmdInUtcRange(rangeFromUtc, rangeToUtc, timeZone);
  for (const ymd of ymds) {
    const noon = fromZonedTime(`${ymd}T12:00:00`, timeZone);
    const isoDow = parseInt(formatInTimeZone(noon, timeZone, 'i'), 10);
    if (!pattern.activeWeekdays.includes(isoDow)) {
      continue;
    }
    for (const shift of pattern.shifts) {
      let t = localWallTimeToUtc(ymd, shift.startLocal, timeZone);
      const shiftEnd = localWallTimeToUtc(ymd, shift.endLocal, timeZone);
      while (addMinutes(t, durationMinutes).getTime() <= shiftEnd.getTime()) {
        if (
          !isBefore(t, rangeFromUtc) &&
          isBefore(t, rangeToUtc)
        ) {
          slots.push(new Date(t.getTime()));
        }
        t = addMinutes(t, durationMinutes);
      }
    }
  }
  slots.sort((a, b) => a.getTime() - b.getTime());
  return slots;
}

export function filterSlotsByOccupiedAndBlocks(params: {
  candidates: Date[];
  durationMinutes: number;
  booked: IntervalUtc[];
  blocks: IntervalUtc[];
}): Date[] {
  const { candidates, durationMinutes, booked, blocks } = params;
  return candidates.filter((start) => {
    const slot = consultationIntervalBounds(start, durationMinutes);
    for (const b of booked) {
      if (intervalsOverlapSemiOpen(slot, b)) {return false;}
    }
    for (const b of blocks) {
      if (intervalsOverlapSemiOpen(slot, b)) {return false;}
    }
    return true;
  });
}

export function slotFullyInsideShiftWindow(params: {
  slotStart: Date;
  durationMinutes: number;
  pattern: ConsultationWeeklyPattern;
  timeZone: string;
}): boolean {
  const { slotStart, durationMinutes, pattern, timeZone } = params;
  const ymd = formatInTimeZone(slotStart, timeZone, 'yyyy-MM-dd');
  const noon = fromZonedTime(`${ymd}T12:00:00`, timeZone);
  const isoDow = parseInt(formatInTimeZone(noon, timeZone, 'i'), 10);
  if (!pattern.activeWeekdays.includes(isoDow)) {
    return false;
  }
  const slot = consultationIntervalBounds(slotStart, durationMinutes);
  for (const shift of pattern.shifts) {
    const wStart = localWallTimeToUtc(ymd, shift.startLocal, timeZone);
    const wEnd = localWallTimeToUtc(ymd, shift.endLocal, timeZone);
    if (!isBefore(slot.start, wStart) && !isAfter(slot.end, wEnd)) {
      return true;
    }
  }
  return false;
}
