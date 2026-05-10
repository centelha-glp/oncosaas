import {
  CONSULTATION_AGENDA_TIMEZONE,
  consultationIntervalBounds,
  filterSlotsByOccupiedAndBlocks,
  generateCandidateSlotStarts,
  intervalsOverlapSemiOpen,
  parseWeeklyPatternJson,
  slotFullyInsideShiftWindow,
} from './consultation-agenda-slot.utils';

describe('consultation-agenda-slot.utils', () => {
  const pattern = parseWeeklyPatternJson({
    activeWeekdays: [1, 2, 3, 4, 5],
    shifts: [{ startLocal: '9:00', endLocal: '12:00' }],
  });

  it('parseWeeklyPatternJson aceita aliases start/end', () => {
    const p = parseWeeklyPatternJson({
      activeWeekdays: [1],
      shifts: [{ start: '08:00', end: '10:00' }],
    });
    expect(p.shifts[0].startLocal).toBe('08:00');
    expect(p.shifts[0].endLocal).toBe('10:00');
  });

  it('intervalsOverlapSemiOpen respeita [start,end)', () => {
    const a = consultationIntervalBounds(new Date('2026-05-11T12:00:00.000Z'), 30);
    const b = consultationIntervalBounds(new Date('2026-05-11T12:30:00.000Z'), 30);
    expect(intervalsOverlapSemiOpen(a, b)).toBe(false);
    const c = consultationIntervalBounds(new Date('2026-05-11T12:29:00.000Z'), 30);
    expect(intervalsOverlapSemiOpen(a, c)).toBe(true);
  });

  it('generateCandidateSlotStarts gera passos de 30 min dentro do turno', () => {
    const from = new Date('2026-05-11T12:00:00.000Z');
    const to = new Date('2026-05-12T12:00:00.000Z');
    const slots = generateCandidateSlotStarts({
      rangeFromUtc: from,
      rangeToUtc: to,
      pattern,
      durationMinutes: 30,
      timeZone: CONSULTATION_AGENDA_TIMEZONE,
    });
    expect(slots.length).toBeGreaterThan(0);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].getTime() - slots[i - 1].getTime()).toBe(30 * 60_000);
    }
  });

  it('filterSlotsByOccupiedAndBlocks remove sobreposição', () => {
    const candidates = [
      new Date('2026-05-11T12:00:00.000Z'),
      new Date('2026-05-11T12:30:00.000Z'),
    ];
    const booked = [
      consultationIntervalBounds(new Date('2026-05-11T12:45:00.000Z'), 30),
    ];
    const free = filterSlotsByOccupiedAndBlocks({
      candidates,
      durationMinutes: 30,
      booked,
      blocks: [],
    });
    expect(free).toHaveLength(1);
    expect(free[0].toISOString()).toBe(candidates[0].toISOString());
  });

  it('slotFullyInsideShiftWindow rejeita fora do turno', () => {
    const candidates = generateCandidateSlotStarts({
      rangeFromUtc: new Date('2026-05-11T12:00:00.000Z'),
      rangeToUtc: new Date('2026-05-12T12:00:00.000Z'),
      pattern,
      durationMinutes: 30,
      timeZone: CONSULTATION_AGENDA_TIMEZONE,
    });
    expect(candidates.length).toBeGreaterThan(0);
    const ok = slotFullyInsideShiftWindow({
      slotStart: candidates[0],
      durationMinutes: 30,
      pattern,
      timeZone: CONSULTATION_AGENDA_TIMEZONE,
    });
    expect(ok).toBe(true);
  });
});
