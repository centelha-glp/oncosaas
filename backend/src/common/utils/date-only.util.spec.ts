import { parsePerformedAtDateOnly } from './date-only.util';

describe('parsePerformedAtDateOnly', () => {
  it('parses YYYY-MM-DD to noon UTC', () => {
    const d = parsePerformedAtDateOnly('2024-06-15');
    expect(d.toISOString()).toBe('2024-06-15T12:00:00.000Z');
  });

  it('accepts ISO string and uses first 10 chars', () => {
    const d = parsePerformedAtDateOnly('2024-06-15T00:00:00.000Z');
    expect(d.toISOString()).toBe('2024-06-15T12:00:00.000Z');
  });

  it('rejects invalid date', () => {
    expect(() => parsePerformedAtDateOnly('2024-13-40')).toThrow();
  });
});
